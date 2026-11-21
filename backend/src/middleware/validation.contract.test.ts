import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { validate } from './validate.middleware.js';
import { errorHandler } from './error.middleware.js';
import { registerSchema } from '../api/auth/auth.validator.js';
import { listReviewsQuerySchema, createReviewSchema } from '../api/reviews/reviews.validator.js';
import { searchSchema } from '../api/content/content.validator.js';
import { updateMeSchema, changePasswordSchema } from '../api/users/users.validator.js';
import { env } from '../config/env.js';

// Zod sürüm yükseltmelerinde API sözleşmesinin (varsayılanlar, dönüşümler,
// özel mesajlar ve VALIDATION_ERROR yanıt şekli) korunduğunu doğrular.
function appWith(schema: Parameters<typeof validate>[0], source: 'body' | 'query') {
  const app = express();
  app.use(express.json());
  app.all('/t', validate(schema, source), (req, res) => {
    res.json(source === 'body' ? req.body : req.query);
  });
  app.use(errorHandler);
  return app;
}

describe('validate + errorHandler sözleşmesi', () => {
  it('doğrulama hatasında 400 ve formErrors/fieldErrors şeklini döner', async () => {
    const res = await request(appWith(registerSchema, 'body'))
      .post('/t')
      .send({ email: 'gecersiz', username: 'ab', password: 'kisa' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.details.formErrors).toEqual([]);
    expect(res.body.details.fieldErrors.email).toEqual(['Geçerli bir e-posta gerekli']);
    expect(res.body.details.fieldErrors.username).toEqual(['Kullanıcı adı en az 3 karakter']);
    expect(res.body.details.fieldErrors.password).toEqual(['Şifre en az 8 karakter']);
  });

  it('sorgu parametrelerinde varsayılanları ve sayı dönüşümünü uygular', async () => {
    const res = await request(appWith(listReviewsQuerySchema, 'query')).get('/t?page=3');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ sort: 'newest', page: 3, limit: 10 });
  });
});

describe('şema davranışı', () => {
  it('searchSchema varsayılanları uygular', () => {
    expect(searchSchema.parse({ q: 'x' })).toEqual({
      q: 'x',
      type: 'multi',
      page: 1,
      language: 'tr-TR',
    });
  });

  it('createReviewSchema containsSpoiler varsayılanını ve uuid doğrulamasını uygular', () => {
    const ok = createReviewSchema.parse({
      contentId: '3f0f6f7e-2b3a-4c5d-8e9f-0a1b2c3d4e5f',
      rating: 3.5,
    });
    expect(ok.containsSpoiler).toBe(false);
    expect(
      createReviewSchema.safeParse({ contentId: 'not-a-uuid', rating: 3 }).success,
    ).toBe(false);
  });

  it('updateMeSchema boş metin/URL alanlarını çıktıdan düşürür', () => {
    const out = updateMeSchema.parse({ displayName: '', avatarUrl: '', bio: 'merhaba' });
    expect(out).toEqual({ bio: 'merhaba' });
    const bad = updateMeSchema.safeParse({ avatarUrl: 'ftp://x' });
    expect(bad.error?.issues[0]?.message).toBe('Geçerli bir URL girin');
  });

  it('changePasswordSchema eşleşmeme hatasını confirmPassword yoluna yazar', () => {
    const r = changePasswordSchema.safeParse({
      currentPassword: 'x',
      newPassword: '12345678',
      confirmPassword: '87654321',
    });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(['confirmPassword']);
    expect(r.error?.issues[0]?.message).toBe('Şifreler eşleşmiyor');
  });

  it('env şeması varsayılanları ve dönüşümleri uygular', () => {
    expect(env.NODE_ENV).toBe('test');
    expect(typeof env.PORT).toBe('number');
    expect(typeof env.SMTP_SECURE).toBe('boolean');
    if (process.env.SMTP_SECURE === undefined) expect(env.SMTP_SECURE).toBe(false);
  });

  it('0.5 adımlı olmayan puanı özel mesajla reddeder', () => {
    const r = createReviewSchema.safeParse({
      contentId: '3f0f6f7e-2b3a-4c5d-8e9f-0a1b2c3d4e5f',
      rating: 3.3,
    });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe('0.5 adımlı puan giriniz');
  });
});
