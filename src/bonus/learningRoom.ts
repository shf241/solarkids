import type { LanguageCode } from '../storage/index.js';
import { showModal } from '../ui/index.js';

export type LearningRoomStatus = 'idle' | 'connecting' | 'connected' | 'local' | 'closed';
export type LearningRoomTransport = 'websocket' | 'broadcast' | 'none';

export interface LearningRoomActivity {
  id: string;
  kind: string;
  user: string;
  label: string;
  at: number;
}

export interface LearningRoomSnapshot {
  status: LearningRoomStatus;
  transport: LearningRoomTransport;
  room: string;
  user: string;
  peerCount: number;
  activities: readonly LearningRoomActivity[];
}

export type LearningRoomMessage =
  | { type: 'join' | 'leave'; clientId: string; room: string; user: string }
  | { type: 'activity'; clientId: string; room: string; user: string; kind: string; label: string; at: number }
  | { type: 'presence'; room: string; peerCount: number };

export interface LearningRoomClientOptions {
  websocketUrl?: string;
}

type SnapshotListener = (snapshot: LearningRoomSnapshot) => void;

const MAX_ACTIVITIES = 20;

function createId(prefix: string): string {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
  return `${prefix}-${random}`;
}

function normalizeRoom(room: string): string {
  return room.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 24) || 'STAR-ROOM';
}

function normalizeUser(user: string): string {
  return user.trim().replace(/[<>]/g, '').slice(0, 18) || '小探险家';
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function getDefaultWebSocketUrl(): string {
  if (typeof window === 'undefined') return 'ws://127.0.0.1:8787';
  const configured = (window as Window & { SOLARKIDS_WS_URL?: unknown }).SOLARKIDS_WS_URL;
  if (typeof configured === 'string' && configured.trim()) return configured.trim();
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return `ws://${window.location.hostname}:8787`;
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws`;
}

export class LearningRoomClient {
  readonly #clientId = createId('learner');
  readonly #websocketUrl: string;
  readonly #listeners = new Set<SnapshotListener>();
  readonly #activities: LearningRoomActivity[] = [];
  socket: WebSocket | null = null;
  channel: BroadcastChannel | null = null;
  status: LearningRoomStatus = 'idle';
  transport: LearningRoomTransport = 'none';
  room = '';
  user = '';
  peerCount = 0;

  constructor(options: LearningRoomClientOptions = {}) {
    this.#websocketUrl = options.websocketUrl ?? getDefaultWebSocketUrl();
  }

  getSnapshot(): LearningRoomSnapshot {
    return {
      status: this.status,
      transport: this.transport,
      room: this.room,
      user: this.user,
      peerCount: this.peerCount,
      activities: [...this.#activities],
    };
  }

  subscribe(listener: SnapshotListener): () => void {
    this.#listeners.add(listener);
    listener(this.getSnapshot());
    return () => this.#listeners.delete(listener);
  }

  connect(room: string, user: string): void {
    this.disconnect();
    this.room = normalizeRoom(room);
    this.user = normalizeUser(user);
    this.peerCount = 1;
    this.#activities.splice(0);
    this.status = 'connecting';
    this.transport = 'none';
    this.notify();

    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.channel = new BroadcastChannel(`solarkids-learning:${this.room}`);
      this.channel.addEventListener('message', event => {
        this.receive(event.data, 'broadcast');
      });
      this.transport = 'broadcast';
      this.status = 'local';
      this.notify();
    }

    if (typeof WebSocket === 'undefined') {
      this.status = this.channel ? 'local' : 'closed';
      this.notify();
      return;
    }

    try {
      this.socket = new WebSocket(this.#websocketUrl);
      this.socket.addEventListener('open', () => {
        this.transport = 'websocket';
        this.status = 'connected';
        this.send({ type: 'join', clientId: this.#clientId, room: this.room, user: this.user });
        this.notify();
      });
      this.socket.addEventListener('message', event => {
        try {
          this.receive(JSON.parse(String(event.data)), 'websocket');
        } catch {
          // Ignore malformed messages so one peer cannot break the room.
        }
      });
      this.socket.addEventListener('error', () => {
        if (this.status === 'connecting' || this.status === 'connected') {
          this.status = this.channel ? 'local' : 'closed';
          this.transport = this.channel ? 'broadcast' : 'none';
          this.notify();
        }
      });
      this.socket.addEventListener('close', () => {
        this.socket = null;
        if (this.status !== 'closed') {
          this.status = this.channel ? 'local' : 'closed';
          this.transport = this.channel ? 'broadcast' : 'none';
          this.notify();
        }
      });
    } catch {
      this.status = this.channel ? 'local' : 'closed';
      this.transport = this.channel ? 'broadcast' : 'none';
      this.notify();
    }
  }

  disconnect(): void {
    if (
      this.socket &&
      typeof WebSocket !== 'undefined' &&
      this.socket.readyState === WebSocket.OPEN
    ) {
      this.send({ type: 'leave', clientId: this.#clientId, room: this.room, user: this.user });
    }
    this.socket?.close();
    this.socket = null;
    this.channel?.close();
    this.channel = null;
    this.status = this.room ? 'closed' : 'idle';
    this.transport = 'none';
    this.peerCount = 0;
    this.notify();
  }

  publish(label: string, kind = 'learning'): void {
    if (!this.room || !label.trim()) return;
    const message = {
      type: 'activity' as const,
      clientId: this.#clientId,
      room: this.room,
      user: this.user,
      kind,
      label: label.trim().slice(0, 80),
      at: Date.now(),
    };
    if (this.transport === 'websocket' && this.socket?.readyState === WebSocket.OPEN) {
      this.send(message);
      return;
    }
    this.channel?.postMessage(message);
    this.addActivity({
      id: `${this.#clientId}-${message.at}`,
      kind: message.kind,
      user: message.user,
      label: message.label,
      at: message.at,
    });
  }

  dispose(): void {
    this.disconnect();
    this.#listeners.clear();
  }

  private send(message: LearningRoomMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  private receive(value: unknown, transport: LearningRoomTransport): void {
    if (!value || typeof value !== 'object') return;
    const message = value as {
      type?: LearningRoomMessage['type'];
      clientId?: string;
      room?: string;
      user?: string;
      kind?: string;
      label?: string;
      at?: number;
      peerCount?: number;
    };
    if (message.room && message.room !== this.room) return;
    if (message.clientId === this.#clientId && transport === 'broadcast') return;
    if (message.type === 'activity' && typeof message.label === 'string') {
      this.addActivity({
        id: message.clientId ? `${message.clientId}-${message.at ?? Date.now()}` : createId('activity'),
        kind: message.kind ?? 'learning',
        user: message.user ?? '小探险家',
        label: message.label,
        at: message.at ?? Date.now(),
      });
    } else if (message.type === 'presence') {
      this.peerCount = Math.max(1, Math.round(message.peerCount ?? 1));
      this.notify();
    }
  }

  private addActivity(activity: LearningRoomActivity): void {
    if (!activity.label || this.#activities.some(item => item.id === activity.id)) return;
    this.#activities.unshift(activity);
    this.#activities.splice(MAX_ACTIVITIES);
    this.notify();
  }

  private notify(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.#listeners) listener(snapshot);
  }
}

function roomStrings(language: LanguageCode): Record<string, string> {
  return language === 'en'
    ? {
        title: 'WebSocket Learning Room',
        intro: 'Join the same room with classmates and see learning actions in real time.',
        name: 'Your name',
        room: 'Room code',
        join: 'Join room',
        leave: 'Leave room',
        online: 'online learners',
        idle: 'Not in a room',
        connecting: 'Connecting…',
        connected: 'WebSocket connected',
        local: 'Same-browser demo sync',
        closed: 'Offline',
        hint: 'For real WebSocket sharing, run npm run collab and open two browser tabs.',
        empty: 'Learning actions will appear here.',
      }
    : {
        title: 'WebSocket 多人学习房',
        intro: '和同学输入同一个房间号，实时看到彼此的学习动作。',
        name: '你的名字',
        room: '房间号',
        join: '加入房间',
        leave: '离开房间',
        online: '位同学在线',
        idle: '尚未加入房间',
        connecting: '正在连接……',
        connected: 'WebSocket 已连接',
        local: '同浏览器演示同步',
        closed: '暂未连接',
        hint: '要进行真正的 WebSocket 多人共享，请运行 npm run collab 后打开两个浏览器标签页。',
        empty: '同学们的学习动作会出现在这里。',
      };
}

function statusText(snapshot: LearningRoomSnapshot, strings: Record<string, string>): string {
  if (snapshot.status === 'connected') return strings.connected;
  if (snapshot.status === 'connecting') return strings.connecting;
  if (snapshot.status === 'local') return strings.local;
  if (snapshot.status === 'closed') return strings.closed;
  return strings.idle;
}

export function openLearningRoom(
  client: LearningRoomClient,
  language: LanguageCode = 'zh-CN',
): void {
  const strings = roomStrings(language);
  const snapshot = client.getSnapshot();
  let unsubscribe = (): void => undefined;
  const modal = showModal(
    `🛰️ ${strings.title}`,
    `<div class="learning-room" data-room-root>
      <p class="learning-room__intro">${strings.intro}</p>
      <div class="learning-room__form">
        <label>${strings.name}<input class="learning-room__input" data-room-user maxlength="18" value="${escapeAttribute(snapshot.user || (language === 'en' ? 'Space learner' : '小探险家'))}"></label>
        <label>${strings.room}<input class="learning-room__input" data-room-code maxlength="24" value="${escapeAttribute(snapshot.room || 'STAR-ROOM')}" spellcheck="false"></label>
        <button type="button" class="btn btn--accent" data-room-toggle>${snapshot.status === 'connected' || snapshot.status === 'local' || snapshot.status === 'connecting' ? strings.leave : strings.join}</button>
      </div>
      <div class="learning-room__status" data-room-status aria-live="polite">${statusText(snapshot, strings)}</div>
      <div class="learning-room__online"><strong data-room-count>${snapshot.peerCount}</strong> ${strings.online}</div>
      <p class="tooltip learning-room__hint">${strings.hint}</p>
      <div class="learning-room__feed" data-room-feed aria-live="polite"></div>
    </div>`,
    () => unsubscribe(),
  );

  const root = modal.querySelector<HTMLElement>('[data-room-root]');
  const userInput = root?.querySelector<HTMLInputElement>('[data-room-user]');
  const roomInput = root?.querySelector<HTMLInputElement>('[data-room-code]');
  const toggle = root?.querySelector<HTMLButtonElement>('[data-room-toggle]');
  const status = root?.querySelector<HTMLElement>('[data-room-status]');
  const count = root?.querySelector<HTMLElement>('[data-room-count]');
  const feed = root?.querySelector<HTMLElement>('[data-room-feed]');
  const render = (next: LearningRoomSnapshot): void => {
    if (!root?.isConnected) return;
    if (status) status.textContent = statusText(next, strings);
    if (count) count.textContent = String(next.peerCount);
    if (toggle) toggle.textContent = next.status === 'connected' || next.status === 'local' || next.status === 'connecting' ? strings.leave : strings.join;
    if (feed) {
      feed.replaceChildren();
      if (!next.activities.length) {
        const empty = document.createElement('p');
        empty.className = 'tooltip';
        empty.textContent = strings.empty;
        feed.appendChild(empty);
      } else {
        next.activities.slice(0, 10).forEach(activity => {
          const item = document.createElement('p');
          item.className = 'learning-room__activity';
          const user = document.createElement('strong');
          user.textContent = activity.user;
          const label = document.createElement('span');
          label.textContent = `：${activity.label}`;
          item.append(user, label);
          feed.appendChild(item);
        });
      }
    }
  };
  unsubscribe = client.subscribe(render);
  toggle?.addEventListener('click', () => {
    const current = client.getSnapshot();
    if (current.status === 'connected' || current.status === 'local' || current.status === 'connecting') {
      client.disconnect();
    } else {
      client.connect(roomInput?.value ?? '', userInput?.value ?? '');
    }
  });
  render(snapshot);
}
