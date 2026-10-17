import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { verifyRoomToken, signRoomToken, RoomTokenPayload, DEFAULT_WS_SECRET } from './src/lib/token-auth.js';
import { BranchRole, BranchScope } from './src/types/genealogy.js';
import { 
  sanitizePersonForPrivacy, 
  sanitizeGenealogyDataForPrivacy, 
  sanitizeArchiveForPrivacy,
  shouldProtectPerson 
} from './src/lib/privacy.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3000;
const WS_AUTH_SECRET = process.env.WS_AUTH_SECRET || DEFAULT_WS_SECRET;

app.use(express.json({ limit: '10mb' }));

interface ClientInfo {
  ws: WebSocket;
  clientId: string;
  roomId: string;
  userName?: string;
  branch: BranchScope;
  role: BranchRole;
  isAuthorized: boolean;
  isAlive: boolean;
  messageCount: number;
  rateLimitWindow: number;
}

const clients = new Map<WebSocket, ClientInfo>();
const rooms = new Map<string, Set<WebSocket>>();

const MAX_PAYLOAD_BYTES = 512 * 1024; // 512 KB max payload
const RATE_LIMIT_MAX_MSG = 60; // Max 60 messages per 10 seconds
const RATE_LIMIT_WINDOW_MS = 10000;

function isValidId(id: unknown): boolean {
  return typeof id === 'string' && id.length > 0 && id.length <= 128 && /^[a-zA-Z0-9_\-]+$/.test(id);
}

function sanitizeText(str: unknown, maxLen = 100): string {
  if (typeof str !== 'string') return '';
  return str.slice(0, maxLen).replace(/[<>]/g, '');
}

const wss = new WebSocketServer({ 
  server, 
  path: '/ws',
  maxPayload: MAX_PAYLOAD_BYTES
});

// Periodic ping/pong to clean up dead connections
const heartbeatInterval = setInterval(() => {
  for (const [ws, info] of clients.entries()) {
    if (!info.isAlive) {
      removeClient(ws);
      ws.terminate();
      continue;
    }
    info.isAlive = false;
    ws.ping();
  }
}, 30000);

wss.on('close', () => {
  clearInterval(heartbeatInterval);
});

function removeClient(ws: WebSocket) {
  const info = clients.get(ws);
  if (!info) return;

  const { roomId, clientId, userName } = info;
  const roomSet = rooms.get(roomId);
  if (roomSet) {
    roomSet.delete(ws);
    if (roomSet.size === 0) {
      rooms.delete(roomId);
    } else {
      broadcastToRoom(roomId, ws, {
        type: 'peer:left',
        clientId,
        userName,
        peerCount: roomSet.size,
        timestamp: Date.now(),
      });
    }
  }
  clients.delete(ws);
}

wss.on('connection', (ws) => {
  const initialInfo: ClientInfo = {
    ws,
    clientId: '',
    roomId: '',
    branch: 'all',
    role: 'viewer',
    isAuthorized: false,
    isAlive: true,
    messageCount: 0,
    rateLimitWindow: Date.now(),
  };
  clients.set(ws, initialInfo);

  ws.on('pong', () => {
    const info = clients.get(ws);
    if (info) info.isAlive = true;
  });

  ws.on('message', (rawData: Buffer | string) => {
    const info = clients.get(ws);
    if (!info) return;

    // Rate limiting check
    const now = Date.now();
    if (now - info.rateLimitWindow > RATE_LIMIT_WINDOW_MS) {
      info.rateLimitWindow = now;
      info.messageCount = 0;
    }
    info.messageCount++;
    if (info.messageCount > RATE_LIMIT_MAX_MSG) {
      ws.send(JSON.stringify({ type: 'error', code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' }));
      return;
    }

    try {
      const dataStr = rawData.toString();
      if (dataStr.length > MAX_PAYLOAD_BYTES) {
        ws.send(JSON.stringify({ type: 'error', code: 'PAYLOAD_TOO_LARGE', message: 'Payload exceeds 512KB' }));
        return;
      }

      const msg = JSON.parse(dataStr);
      if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') {
        ws.send(JSON.stringify({ type: 'error', code: 'INVALID_FORMAT', message: 'Invalid message structure' }));
        return;
      }

      if (msg.type === 'join') {
        const { roomId, clientId, userName, roomToken } = msg;

        if (!isValidId(roomId) || !isValidId(clientId)) {
          ws.send(JSON.stringify({ type: 'error', code: 'INVALID_ID', message: 'Identifiant de salle ou client invalide' }));
          return;
        }

        // P0 : Vérification cryptographique formelle du jeton de salle (HMAC-SHA256)
        const verification = verifyRoomToken(roomToken, roomId, WS_AUTH_SECRET);
        if (!verification.valid || !verification.payload) {
          ws.send(JSON.stringify({
            type: 'error',
            code: 'UNAUTHORIZED_TOKEN',
            message: `Accès refusé au relais WebSocket : ${verification.error || 'Jeton manquant ou non valide'}.`,
          }));
          return;
        }

        // Leave existing room if any
        if (info.roomId && info.roomId !== roomId) {
          removeClient(ws);
        }

        // Client formellement autorisé avec rôle et périmètre vérifiés
        info.roomId = roomId;
        info.clientId = clientId;
        info.isAuthorized = true;
        info.role = verification.payload.role;
        info.branch = verification.payload.branch;
        info.userName = sanitizeText(userName, 50) || 'Membre';

        if (!rooms.has(roomId)) {
          rooms.set(roomId, new Set());
        }
        rooms.get(roomId)!.add(ws);

        // Broadcast to other authorized peers in the room
        broadcastToRoom(roomId, ws, {
          type: 'peer:joined',
          clientId: info.clientId,
          userName: info.userName,
          branch: info.branch,
          role: info.role,
          peerCount: rooms.get(roomId)!.size,
          timestamp: Date.now(),
        });

        // Send confirmation back to joined peer
        ws.send(JSON.stringify({
          type: 'room:info',
          roomId,
          role: info.role,
          branch: info.branch,
          peerCount: rooms.get(roomId)!.size,
        }));

      } else if (msg.type === 'sync:action') {
        const opId = msg.id || msg.opId || ('op-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6));

        // Enforce that client has legitimately joined and is authorized in the room
        if (!info.isAuthorized || !info.roomId || !rooms.has(info.roomId) || !rooms.get(info.roomId)!.has(ws)) {
          ws.send(JSON.stringify({
            type: 'action:ack',
            opId,
            status: 'error',
            code: 'NOT_IN_ROOM',
            message: 'Non autorisé à diffuser des modifications. Rejoignez la salle avec un jeton valide.',
          }));
          return;
        }

        // 1. Contrôle RBAC : les lecteurs n'ont AUCUN droit d'écriture
        if (info.role === 'viewer') {
          ws.send(JSON.stringify({
            type: 'action:ack',
            opId,
            status: 'error',
            code: 'FORBIDDEN_ROLE',
            message: 'Accès refusé : le rôle Lecteur n’autorise aucune modification ou diffusion en direct.',
          }));
          return;
        }

        // 2. Contrôle de l'action demandée
        const allowedActions = ['tree:update', 'person:edit', 'archive:add', 'archive:delete', 'access:update'];
        if (!allowedActions.includes(msg.action)) {
          ws.send(JSON.stringify({
            type: 'action:ack',
            opId,
            status: 'error',
            code: 'UNAUTHORIZED_ACTION',
            message: 'Type d\'action non permis.',
          }));
          return;
        }

        // 3. Contrôle des actions critiques (tree:update et access:update réservés à l'admin)
        if ((msg.action === 'tree:update' || msg.action === 'access:update') && info.role !== 'admin') {
          ws.send(JSON.stringify({
            type: 'action:ack',
            opId,
            status: 'error',
            code: 'FORBIDDEN_ACTION',
            message: 'Action critique réservée aux administrateurs de l\'arbre.',
          }));
          return;
        }

        // 4. Contrôle de périmètre de branche pour les éditeurs
        if (info.role === 'editor' && info.branch !== 'all' && msg.action === 'person:edit' && msg.payload) {
          const targetBranch = msg.payload.branch;
          if (targetBranch && targetBranch !== 'all' && targetBranch !== info.branch) {
            ws.send(JSON.stringify({
              type: 'action:ack',
              opId,
              status: 'error',
              code: 'FORBIDDEN_BRANCH',
              message: `Votre rôle d'éditeur est restreint à la branche ${info.branch}. Modification de la branche ${targetBranch} refusée.`,
            }));
            return;
          }
        }

        // 5. Action validée : relais aux autres pairs de la même salle
        broadcastToRoom(info.roomId, ws, {
          type: 'sync:action',
          id: opId,
          clientId: info.clientId,
          action: msg.action,
          payload: msg.payload,
          timestamp: Date.now(),
        });

        // 6. Accusé de réception (ACK) immédiat au client émetteur
        ws.send(JSON.stringify({
          type: 'action:ack',
          opId,
          status: 'success',
          action: msg.action,
          timestamp: Date.now(),
        }));

      } else if (msg.type === 'presence:ping') {
        if (!info.isAuthorized || !info.roomId || !rooms.has(info.roomId)) return;

        broadcastToRoom(info.roomId, ws, {
          type: 'presence:update',
          clientId: info.clientId,
          userName: info.userName,
          cursor: typeof msg.cursor === 'object' ? msg.cursor : undefined,
          activeView: sanitizeText(msg.activeView, 30),
          activePersonId: isValidId(msg.activePersonId) ? msg.activePersonId : undefined,
        });

      } else {
        ws.send(JSON.stringify({ type: 'error', code: 'UNKNOWN_TYPE', message: 'Unknown message type' }));
      }

    } catch (e) {
      ws.send(JSON.stringify({ type: 'error', code: 'MALFORMED_JSON', message: 'JSON parsing failed' }));
    }
  });

  ws.on('close', () => {
    removeClient(ws);
  });
});

function broadcastToRoom(roomId: string, sender: WebSocket, payload: any) {
  const roomSet = rooms.get(roomId);
  if (!roomSet) return;

  for (const client of roomSet) {
    if (client !== sender && client.readyState === WebSocket.OPEN) {
      const recipientInfo = clients.get(client);
      let clientPayload = payload;

      // Protection stricte de la confidentialité en temps réel pour les observateurs / lecteurs
      if (recipientInfo && recipientInfo.role === 'viewer' && payload.type === 'sync:action') {
        if (payload.action === 'person:edit' && payload.payload) {
          const rawPerson = payload.payload;
          if (shouldProtectPerson(rawPerson)) {
            clientPayload = {
              ...payload,
              payload: sanitizePersonForPrivacy(rawPerson),
            };
          }
        } else if (payload.action === 'tree:update' && payload.payload) {
          clientPayload = {
            ...payload,
            payload: sanitizeGenealogyDataForPrivacy(payload.payload),
          };
        } else if (payload.action === 'archive:add' && payload.payload) {
          const rawArchive = payload.payload;
          const sanitizedArc = sanitizeArchiveForPrivacy(rawArchive, new Set(rawArchive.linkedPersonIds || []));
          if (!sanitizedArc) {
            // Document confidentiel de personne vivante : ne pas relayer au lecteur
            continue;
          }
          clientPayload = {
            ...payload,
            payload: sanitizedArc,
          };
        }

        // Contrôle de branche pour les observateurs restreints
        if (recipientInfo.branch !== 'all' && payload.action === 'person:edit' && payload.payload?.branch) {
          if (payload.payload.branch !== recipientInfo.branch) {
            continue;
          }
        }
      }

      client.send(JSON.stringify(clientPayload));
    }
  }
}

// Healthcheck & WebSocket room status endpoint (without exposing private room ids)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', activeRoomsCount: rooms.size, totalClientsCount: clients.size });
});

// Endpoint d'émission de jeton de salle sécurisé et signé (HMAC-SHA256)
app.post('/api/auth/room-token', (req, res) => {
  try {
    const { roomId, role = 'admin', branch = 'all', expiresInHours = 72, userName } = req.body || {};
    if (!isValidId(roomId)) {
      return res.status(400).json({ error: 'Identifiant de salle invalide' });
    }
    const validRoles: BranchRole[] = ['admin', 'editor', 'viewer'];
    const validBranches: BranchScope[] = ['all', 'paternal', 'maternal', 'custom'];
    const safeRole: BranchRole = validRoles.includes(role) ? role : 'viewer';
    const safeBranch: BranchScope = validBranches.includes(branch) ? branch : 'all';
    const exp = typeof expiresInHours === 'number' && expiresInHours > 0 
      ? Date.now() + expiresInHours * 3600 * 1000 
      : 0;

    const token = signRoomToken({
      roomId,
      role: safeRole,
      branch: safeBranch,
      exp,
      iat: Date.now(),
      sub: sanitizeText(userName, 50) || undefined,
    }, WS_AUTH_SECRET);

    res.json({ token, roomId, role: safeRole, branch: safeBranch, exp });
  } catch (e: any) {
    res.status(500).json({ error: 'Échec de génération du jeton' });
  }
});

// Configure Vite middleware in development or static serving in production
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: process.env.DISABLE_HMR !== 'true' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, () => {
    console.log(`Server running securely on port ${PORT}`);
  });
}

startServer();
