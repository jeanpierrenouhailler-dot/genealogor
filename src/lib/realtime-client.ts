import { PeerPresence } from '../types/genealogy';

export type SyncCallback = (data: any) => void;

class RealtimeClient {
  private ws: WebSocket | null = null;
  private channel: BroadcastChannel | null = null;
  private roomId: string = '';
  private clientId: string = '';
  private userName: string = 'Visiteur';
  private branch: string = 'all';
  private listeners: Map<string, Set<SyncCallback>> = new Map();
  private isConnected: boolean = false;
  private reconnectTimer: any = null;

  constructor() {
    this.clientId = 'client-' + Math.random().toString(36).substring(2, 9);
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.channel = new BroadcastChannel('genealogor_channel');
      this.channel.onmessage = (event) => {
        this.dispatch(event.data.type, event.data);
      };
    }
  }

  private roomToken: string = '';

  public init(roomId: string, userName: string = 'Membre de la famille', branch: string = 'all', roomToken: string = '') {
    this.roomId = roomId;
    this.userName = userName;
    this.branch = branch;
    this.roomToken = roomToken;

    this.connectWs();
  }

  private connectWs() {
    if (typeof window === 'undefined') return;

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.ws?.send(JSON.stringify({
          type: 'join',
          roomId: this.roomId,
          clientId: this.clientId,
          userName: this.userName,
          branch: this.branch,
          roomToken: this.roomToken,
        }));
        this.dispatch('connection:change', { connected: true, isWs: true });
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.dispatch(msg.type, msg);
        } catch (e) {
          console.error('WS parse error', e);
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.dispatch('connection:change', { connected: false, isWs: true });
        this.scheduleReconnect();
      };

      this.ws.onerror = (err) => {
        console.warn('WebSocket connection error, fallback to BroadcastChannel', err);
        this.ws?.close();
      };
    } catch (e) {
      console.warn('Could not establish WebSocket, running in local channel mode', e);
      this.dispatch('connection:change', { connected: true, isWs: false });
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      if (this.roomId && !this.isConnected) {
        this.connectWs();
      }
    }, 4000);
  }

  public sendAction(action: string, payload: any) {
    const message = {
      type: 'sync:action',
      roomId: this.roomId,
      clientId: this.clientId,
      action,
      payload,
      timestamp: Date.now(),
    };

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
    // Also broadcast to local tabs via BroadcastChannel
    if (this.channel) {
      this.channel.postMessage(message);
    }
  }

  public sendPresence(activeView?: string, activePersonId?: string) {
    const ping = {
      type: 'presence:ping',
      roomId: this.roomId,
      clientId: this.clientId,
      userName: this.userName,
      activeView,
      activePersonId,
      timestamp: Date.now(),
    };

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(ping));
    }
    if (this.channel) {
      this.channel.postMessage({ ...ping, type: 'presence:update' });
    }
  }

  public on(event: string, callback: SyncCallback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  private dispatch(event: string, data: any) {
    const cbs = this.listeners.get(event);
    if (cbs) {
      cbs.forEach(cb => cb(data));
    }
  }

  public getClientId() {
    return this.clientId;
  }

  public isWsConnected() {
    return this.isConnected;
  }
}

export const realtimeClient = new RealtimeClient();
