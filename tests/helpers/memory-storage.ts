import type { StorageLike } from "../../src/storage/index.ts";

export class MemoryStorage implements StorageLike {
  readonly #values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.#values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.#values.set(key, value);
  }

  removeItem(key: string): void {
    this.#values.delete(key);
  }
}

export class ThrowingStorage implements StorageLike {
  constructor(
    private readonly operation: "get" | "set" | "remove",
    private readonly fallback = new MemoryStorage(),
  ) {}

  getItem(key: string): string | null {
    if (this.operation === "get") {
      throw new Error("Storage read is blocked");
    }

    return this.fallback.getItem(key);
  }

  setItem(key: string, value: string): void {
    if (this.operation === "set") {
      throw new Error("Storage write is blocked");
    }

    this.fallback.setItem(key, value);
  }

  removeItem(key: string): void {
    if (this.operation === "remove") {
      throw new Error("Storage removal is blocked");
    }

    this.fallback.removeItem(key);
  }
}
