import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from './password.js';

// Gerçek bcrypt ile hash/doğrulama; mevcut ($2b$10$) hash'lerin yeni bcrypt
// sürümlerinde de doğrulanabildiğini güvenceye alır.
describe('password', () => {
  it('hashler ve doğru şifreyi doğrular, yanlışı reddeder', async () => {
    const hash = await hashPassword('dogru-sifre-123');
    expect(hash).toMatch(/^\$2b\$10\$/);
    expect(await verifyPassword('dogru-sifre-123', hash)).toBe(true);
    expect(await verifyPassword('yanlis-sifre', hash)).toBe(false);
  });

  it('önceden üretilmiş bir $2b$10$ hash\'ini doğrular', async () => {
    // bcrypt 5.1.1 ile üretilmiş sabit hash ("legacy-pass")
    const legacy = '$2b$10$rausOa8C.M6/MKmep8BJse8cFfmiL7O4E8nQfSQESxEwMmdAD/R6O';
    expect(await verifyPassword('legacy-pass', legacy)).toBe(true);
  });
});
