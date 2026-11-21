import { describe, it, expect } from 'vitest';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from './schemas';

// Formlar hata mesajı olarak i18n anahtarı gösterir; zod / @hookform/resolvers
// sürüm yükseltmelerinde anahtarların ve alan yollarının korunduğunu doğrular.
const resolverOpts = { fields: {}, shouldUseNativeValidation: false } as const;

describe('auth şemaları', () => {
  it('login: boş alanlarda i18n anahtarlarını döndürür', () => {
    const r = loginSchema.safeParse({ identifier: '', password: '' });
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => i.message)).toEqual([
      'auth.errors.identifierRequired',
      'auth.errors.passwordRequired',
    ]);
  });

  it('register: displayName boş string veya yok olabilir', () => {
    const base = { email: 'a@b.co', username: 'abc_1', password: '12345678' };
    expect(registerSchema.safeParse(base).success).toBe(true);
    expect(registerSchema.safeParse({ ...base, displayName: '' }).success).toBe(true);
    expect(registerSchema.safeParse({ ...base, username: 'ABC' }).success).toBe(false);
  });

  it('forgotPassword: geçersiz e-postada emailInvalid anahtarı', () => {
    const r = forgotPasswordSchema.safeParse({ email: 'nope' });
    expect(r.error?.issues[0]?.message).toBe('auth.errors.emailInvalid');
  });
});

describe('zodResolver entegrasyonu', () => {
  it('resetPassword eşleşmeme hatasını confirmPassword alanına yazar', async () => {
    const resolver = zodResolver(resetPasswordSchema);
    const res = await resolver(
      { password: '12345678', confirmPassword: '87654321' },
      undefined,
      resolverOpts,
    );
    expect(res.values).toEqual({});
    expect(res.errors.confirmPassword?.message).toBe('auth.errors.passwordMismatch');
  });

  it('geçerli girdide değerleri döndürür', async () => {
    const resolver = zodResolver(loginSchema);
    const res = await resolver({ identifier: 'u', password: 'p' }, undefined, resolverOpts);
    expect(res.errors).toEqual({});
    expect(res.values).toEqual({ identifier: 'u', password: 'p' });
  });
});
