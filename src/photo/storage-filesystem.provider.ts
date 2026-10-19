import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import type { StorageProvider, StoredObject } from './storage.types.js';

const KEY_PATTERN = /^[0-9a-f]{64}$/;

const assertKey = (key: string): void => {
  if (!KEY_PATTERN.test(key)) {
    throw new Error('STORAGE_KEY_INVALID');
  }
};

export class FilesystemStorageProvider implements StorageProvider {
  readonly name = 'filesystem' as const;
  private readonly root: string;

  constructor(dir: string) {
    this.root = resolve(dir);
  }

  private pathOf(key: string, extension: string): string {
    assertKey(key);
    return join(this.root, key.slice(0, 2), `${key}.${extension}`);
  }

  private async findPath(key: string): Promise<string | null> {
    assertKey(key);
    for (const extension of ['webp', 'jpg', 'jpeg', 'bin']) {
      const candidate = this.pathOf(key, extension);
      try {
        await stat(candidate);
        return candidate;
      } catch {
        continue;
      }
    }
    return null;
  }

  async has(key: string): Promise<boolean> {
    return (await this.findPath(key)) !== null;
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    const extension =
      contentType === 'image/webp'
        ? 'webp'
        : contentType === 'image/jpeg'
          ? 'jpg'
          : 'bin';
    const target = this.pathOf(key, extension);
    await mkdir(dirname(target), { recursive: true, mode: 0o700 });
    const temporary = `${target}.tmp-${process.pid}-${Date.now()}`;
    await writeFile(temporary, body, { mode: 0o600 });
    await rename(temporary, target);
  }

  async get(key: string): Promise<StoredObject | null> {
    const path = await this.findPath(key);
    if (path === null) return null;
    const body = await readFile(path);
    const extension = path.slice(path.lastIndexOf('.') + 1);
    const contentType =
      extension === 'webp'
        ? 'image/webp'
        : extension === 'jpg' || extension === 'jpeg'
          ? 'image/jpeg'
          : null;
    return { body, contentType };
  }

  async delete(key: string): Promise<void> {
    const path = await this.findPath(key);
    if (path !== null) await rm(path, { force: true });
  }
}
