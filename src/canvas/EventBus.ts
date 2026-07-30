export type EventListener<T> = (payload: T) => void;

/** 供 Canvas 核心与专题模块解耦通信的轻量类型安全事件总线。 */
export class EventBus<Events extends object> {
  private readonly listeners = new Map<keyof Events, Set<EventListener<unknown>>>();

  on<Key extends keyof Events>(type: Key, listener: EventListener<Events[Key]>): () => void {
    const listeners = this.listeners.get(type) ?? new Set<EventListener<unknown>>();
    listeners.add(listener as EventListener<unknown>);
    this.listeners.set(type, listeners);

    return () => {
      listeners.delete(listener as EventListener<unknown>);
      if (listeners.size === 0) {
        this.listeners.delete(type);
      }
    };
  }

  emit<Key extends keyof Events>(type: Key, payload: Events[Key]): void {
    const listeners = this.listeners.get(type);
    if (!listeners) return;

    for (const listener of [...listeners]) {
      listener(payload);
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}
