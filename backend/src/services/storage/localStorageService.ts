import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import type { Express } from 'express';

export interface StoredFile {
  storagePath: string;
  fileName: string;
}

export interface StorageService {
  saveFile(file: Express.Multer.File, subDir: string): Promise<StoredFile>;
}

export class LocalStorageService implements StorageService {
  constructor(private baseDir: string) {}

  async saveFile(file: Express.Multer.File, subDir: string): Promise<StoredFile> {
    const extension = path.extname(file.originalname);
    const fileName = `${crypto.randomUUID()}${extension}`;
    const targetDir = path.join(this.baseDir, subDir);

    await fs.mkdir(targetDir, { recursive: true });

    const absolutePath = path.join(targetDir, fileName);
    await fs.writeFile(absolutePath, file.buffer);

    const storagePath = path.join(subDir, fileName).replace(/\\/g, '/');

    return {
      storagePath,
      fileName,
    };
  }
}
