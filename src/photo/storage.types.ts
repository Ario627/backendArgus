export type StorageDriverName = 'filesystem' | 's3' | 'cloudinary';

export interface StoredObject {
  readonly body: Buffer;
  readonly contentType: string | null;
}

export interface StorageProvider {
  readonly name: StorageDriverName;
  has(key: string): Promise<boolean>;
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<StoredObject | null>;
  delete(key: string): Promise<void>;
}
