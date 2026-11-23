import { describe, it, expect } from 'vitest';
import { prettyFactory } from 'pino-pretty';

// Geliştirme ortamında logger (utils/logger.ts) pino-pretty transport'unu kullanır.
// pino-pretty, varsayılan `ignore: 'hostname'` filtresini uygularken log nesnesini
// fast-copy ile kopyalar. Bu test, fast-copy güncellemelerinden sonra (ör. 3.1.0'daki
// maxDepth sınırı) iç içe log alanlarının hâlâ doğru biçimlendirildiğini doğrular.
describe('pino-pretty (geliştirme log biçimi)', () => {
  const pretty = prettyFactory({ colorize: false, translateTime: 'SYS:HH:MM:ss' });

  it('iç içe alanları yazar, hostname alanını çıkarır', () => {
    const line = {
      level: 30,
      time: 1_700_000_000_000,
      pid: 1,
      hostname: 'gizli-host',
      service: 'movie-tv-review-api',
      req: { method: 'GET', url: '/api/health', headers: { accept: 'application/json' } },
      tags: ['a', 'b'],
      msg: 'istek tamamlandı',
    };

    const out = pretty(line);

    expect(out).toContain('istek tamamlandı');
    expect(out).toContain('service: "movie-tv-review-api"');
    expect(out).toContain('"url": "/api/health"');
    expect(out).toContain('"accept": "application/json"');
    expect(out).not.toContain('gizli-host');
  });

  it('girdi log nesnesini değiştirmez', () => {
    const line = { level: 30, time: 1, hostname: 'h', nested: { deep: { value: 1 } }, msg: 'x' };
    const snapshot = structuredClone(line);

    pretty(line);

    expect(line).toEqual(snapshot);
  });
});
