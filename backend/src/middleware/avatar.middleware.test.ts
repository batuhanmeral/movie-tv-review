import { describe, it, expect, vi, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import request from 'supertest';
import { AVATAR_DIR } from '../config/uploads.js';
import { avatarUpload } from './avatar.middleware.js';
import { errorHandler } from './error.middleware.js';

// Yüklemeler gerçek uploads/ yerine geçici bir klasöre yazılır.
vi.mock('../config/uploads.js', async () => {
  const fsm = await import('node:fs');
  const osm = await import('node:os');
  const pathm = await import('node:path');
  const dir = fsm.mkdtempSync(pathm.join(osm.tmpdir(), 'avatar-test-'));
  return { UPLOADS_DIR: dir, AVATAR_DIR: dir };
});

function makeApp() {
  const app = express();
  app.post('/avatar', avatarUpload, (req, res) => {
    res.json({ filename: req.file?.filename ?? null });
  });
  app.use(errorHandler);
  return app;
}

afterAll(() => {
  fs.rmSync(AVATAR_DIR, { recursive: true, force: true });
});

describe('avatarUpload (multer)', () => {
  it('PNG dosyasını kabul eder ve diske yazar', async () => {
    const res = await request(makeApp())
      .post('/avatar')
      .attach('avatar', Buffer.from('fake-png'), { filename: 'a.png', contentType: 'image/png' });
    expect(res.status).toBe(200);
    expect(res.body.filename).toMatch(/^anon-\d+\.png$/);
    expect(fs.existsSync(path.join(AVATAR_DIR, res.body.filename))).toBe(true);
  });

  it('izin verilmeyen türü 400 ile reddeder', async () => {
    const res = await request(makeApp())
      .post('/avatar')
      .attach('avatar', Buffer.from('hello'), { filename: 'a.txt', contentType: 'text/plain' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Yalnızca JPG, PNG veya WEBP yükleyebilirsiniz');
  });

  it('2MB üstü dosyayı 400 ile reddeder', async () => {
    const big = Buffer.alloc(2 * 1024 * 1024 + 1, 0);
    const res = await request(makeApp())
      .post('/avatar')
      .attach('avatar', big, { filename: 'b.png', contentType: 'image/png' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Dosya en fazla 2MB olabilir');
  });
});
