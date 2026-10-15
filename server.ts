import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));

interface ClientInfo {
  ws: WebSocket;
  clientId: string;
  roomId: string;
  userName?: string;
  branch?: string;
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
        const { roomId, clientId, userName, branch, roomToken } = msg;

        if (!isValidId(roomId) || !isValidId(clientId)) {
          ws.send(JSON.stringify({ type: 'error', code: 'INVALID_ID', message: 'Invalid roomId or clientId format' }));
          return;
        }

        if (roomToken && (typeof roomToken !== 'string' || !/^[a-zA-Z0-9_\-]{8,64}$/.test(roomToken))) {
          ws.send(JSON.stringify({ type: 'error', code: 'INVALID_TOKEN', message: 'Invalid roomToken format' }));
          return;
        }

        // Leave existing room if any
        if (info.roomId && info.roomId !== roomId) {
          removeClient(ws);
        }

        info.roomId = roomId;
        info.clientId = clientId;
        info.userName = sanitizeText(userName, 50) || 'Visiteur';
        info.branch = sanitizeText(branch, 20) || 'all';

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
          peerCount: rooms.get(roomId)!.size,
          timestamp: Date.now(),
        });

        // Send confirmation back to joined peer
        ws.send(JSON.stringify({
          type: 'room:info',
          roomId,
          peerCount: rooms.get(roomId)!.size,
        }));

      } else if (msg.type === 'sync:action') {
        // Enforce that client has legitimately joined the room
        if (!info.roomId || !rooms.has(info.roomId) || !rooms.get(info.roomId)!.has(ws)) {
          ws.send(JSON.stringify({ type: 'error', code: 'NOT_IN_ROOM', message: 'Must join room before sending actions' }));
          return;
        }

        const allowedActions = ['tree:update', 'person:edit', 'archive:add', 'archive:delete', 'access:update'];
        if (!allowedActions.includes(msg.action)) {
          ws.send(JSON.stringify({ type: 'error', code: 'UNAUTHORIZED_ACTION', message: 'Action not permitted' }));
          return;
        }

        // Relay action to peers in the same room
        broadcastToRoom(info.roomId, ws, {
          type: 'sync:action',
          clientId: info.clientId,
          action: msg.action,
          payload: msg.payload,
          timestamp: Date.now(),
        });

      } else if (msg.type === 'presence:ping') {
        if (!info.roomId || !rooms.has(info.roomId)) return;

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
  const str = JSON.stringify(payload);
  for (const client of roomSet) {
    if (client !== sender && client.readyState === WebSocket.OPEN) {
      client.send(str);
    }
  }
}

// Healthcheck & WebSocket room status endpoint (without exposing private room ids)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', activeRoomsCount: rooms.size, totalClientsCount: clients.size });
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
