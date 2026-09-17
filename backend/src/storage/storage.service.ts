import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';

/**
 * Object-storage abstraction. Business code calls put/get with opaque KEYS —
 * never filesystem paths — so swapping in S3 means implementing this same
 * interface against the AWS SDK (s3.putObject/getObject) and changing one
 * provider registration. Resume files never touch the database.
 */
export interface ObjectStorage {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
}

@Injectable()
export class LocalStorageService implements ObjectStorage {
  private root = join(process.cwd(), process.env.STORAGE_DIR ?? 'storage');

  async put(key: string, data: Buffer): Promise<void> {
    const filePath = join(this.root, key);
    await mkdir(join(this.root, key.split('/')[0]), { recursive: true });
    await writeFile(filePath, data);
  }

  async get(key: string): Promise<Buffer> {
    return readFile(join(this.root, key));
  }
}

export const STORAGE = Symbol('STORAGE');

/** Key convention mirrors S3: namespaced prefixes, random names (never user filenames). */
export function resumeKey(filename: string): string {
  const ext = filename.includes('.') ? filename.split('.').pop() : 'bin';
  return `resumes/${randomUUID()}.${ext}`;
}
