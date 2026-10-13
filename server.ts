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

app.use(express.json({ limit: '50mb' }));

// In-memory Room WebSocket manager for real-time zero-knowledge P2P relay
interface ClientInfo {
  ws: WebSocket;
  clientId: string;
  roomId: string;
  userName?: string;
  branch?: string;
}

const clients = new Map<WebSocket, ClientInfo>();
const rooms = new Map<string, Set<WebSocket>>();

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws) => {
  ws.on('message', (data: string) => {
    try {
      const msg = JSON.parse(data.toString());

      if (msg.type === 'join') {
        const { roomId, clientId, userName, branch } = msg;
        const info: ClientInfo = { ws, clientId, roomId, userName, branch };
        clients.set(ws, info);

        if (!rooms.has(roomId)) {
          rooms.set(roomId, new Set());
        }
        rooms.get(roomId)!.add(ws);

        // Notify other room members
        broadcastToRoom(roomId, ws, {
          type: 'peer:joined',
          clientId,
          userName,
          branch,
          peerCount: rooms.get(roomId)!.size,
          timestamp: Date.now(),
        });

        // Send current room info back to joined peer
        ws.send(JSON.stringify({
          type: 'room:info',
          roomId,
          peerCount: rooms.get(roomId)!.size,
        }));
      } else if (msg.type === 'sync:action') {
        const info = clients.get(ws);
        if (info && info.roomId) {
          broadcastToRoom(info.roomId, ws, {
            type: 'sync:action',
            clientId: info.clientId,
            action: msg.action,
            payload: msg.payload, // Encrypted payload
            timestamp: Date.now(),
          });
        }
      } else if (msg.type === 'presence:ping') {
        const info = clients.get(ws);
        if (info && info.roomId) {
          broadcastToRoom(info.roomId, ws, {
            type: 'presence:update',
            clientId: info.clientId,
            userName: info.userName,
            cursor: msg.cursor,
            activeView: msg.activeView,
            activePersonId: msg.activePersonId,
          });
        }
      }
    } catch (e) {
      console.error('Error parsing WebSocket message', e);
    }
  });

  ws.on('close', () => {
    const info = clients.get(ws);
    if (info) {
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

// Healthcheck & WebSocket room status endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', activeRooms: rooms.size, totalClients: clients.size });
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
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
