import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { Trans, useTranslation } from 'react-i18next';
import HttpBackend from 'i18next-http-backend';
import type { i18n as I18n } from 'i18next';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Gerçek i18n yapılandırmasını (src/lib/i18n.ts) gerçek çeviri dosyalarıyla başlatır.
// HTTP backend'in yaptığı istekler fetch üzerinden public/locales'tan karşılanır.
const localesDir = path.resolve(__dirname, '../../public/locales');

const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
  const url = String(input);
  const match = /^\/locales\/(tr|en)\/translation\.json$/.exec(url);
  if (!match) return new Response('not found', { status: 404 });
  const body = readFileSync(path.join(localesDir, match[1]!, 'translation.json'), 'utf8');
  return new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } });
});

let i18n: I18n;

beforeAll(async () => {
  // Backend fetch'i modül yüklenirken yakalayabilir; bu yüzden import'tan önce değiştir.
  vi.stubGlobal('fetch', fetchMock);
  i18n = (await import('./i18n')).default;
  // init() asenkron çalışır (initAsync varsayılanı); uygulamadaki gibi tamamlanmasını bekle.
  if (!i18n.isInitialized) {
    await new Promise<void>((resolve) => i18n.on('initialized', () => resolve()));
  }
  await i18n.loadLanguages(['tr', 'en']);
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe('i18n yapılandırması', () => {
  it('çevirileri loadPath şablonundaki yoldan yükler', () => {
    const urls = fetchMock.mock.calls.map(([input]) => String(input));
    expect(urls).toContain('/locales/tr/translation.json');
    expect(urls).toContain('/locales/en/translation.json');
  });

  it('tr ve en anahtarlarını çözer', async () => {
    await i18n.changeLanguage('tr');
    expect(i18n.resolvedLanguage).toBe('tr');
    expect(i18n.t('profile.follow')).toBe('Takip et');

    await i18n.changeLanguage('en');
    expect(i18n.resolvedLanguage).toBe('en');
    expect(i18n.t('profile.follow')).toBe('Follow');
  });

  it('desteklenmeyen dilde İngilizceye geri döner', async () => {
    await i18n.changeLanguage('de');
    expect(i18n.resolvedLanguage).toBe('en');
    expect(i18n.t('profile.follow')).toBe('Follow');
  });

  it('değişkenleri yerleştirir ve HTML kaçışını React’e bırakır (escapeValue: false)', async () => {
    await i18n.changeLanguage('en');
    expect(i18n.t('profile.blockConfirm', { name: '<b>x</b>' })).toBe(
      'Block <b>x</b>? Mutual follows will be removed.',
    );
    // React metni kaçışlayarak basar: değişkendeki HTML etikete dönüşmez.
    function BlockConfirm() {
      const { t } = useTranslation();
      return createElement('p', null, t('profile.blockConfirm', { name: '<img src=x onerror=alert(1)>' }));
    }
    expect(renderToString(createElement(BlockConfirm))).toBe(
      '<p>Block &lt;img src=x onerror=alert(1)&gt;? Mutual follows will be removed.</p>',
    );
  });

  it('_one/_other çoğul anahtarlarını dile göre seçer', async () => {
    await i18n.changeLanguage('en');
    expect(i18n.t('discover.followerCount', { count: 1 })).toBe('1 follower');
    expect(i18n.t('discover.followerCount', { count: 2 })).toBe('2 followers');
    expect(i18n.t('person.showing', { count: 0 })).toBe('Showing 0 titles');
    // Çoğul eki olmayan anahtar count ile de çözülür.
    expect(i18n.t('list.items', { count: 3 })).toBe('3 items');

    await i18n.changeLanguage('tr');
    expect(i18n.t('discover.followerCount', { count: 1 })).toBe('1 takipçi');
    expect(i18n.t('person.creditCount', { count: 5 })).toBe('5 yapım');
  });

  it('eksik anahtarda defaultValue döner', async () => {
    await i18n.changeLanguage('en');
    expect(i18n.t('person.departments.Acting', { defaultValue: 'Acting' })).toBe('Acting');
    expect(i18n.t('person.departments.Lighting', { defaultValue: 'Lighting' })).toBe('Lighting');
  });

  it('react-i18next Trans bileşeni ve useTranslation çalışır', async () => {
    await i18n.changeLanguage('en');
    const prompt = createElement(Trans, {
      i18nKey: 'reviews.loginPrompt',
      components: [createElement('a', { key: 'login', href: '/login' })],
    });
    expect(renderToString(prompt)).toBe('<a href="/login">Sign in</a> to write a review.');

    function Showing() {
      const { t } = useTranslation();
      return createElement('span', null, t('person.showing', { count: 1 }));
    }
    expect(renderToString(createElement(Showing))).toBe('<span>Showing 1 title</span>');
  });
});

describe('i18next-http-backend URL doğrulaması', () => {
  it('yol geçişi içeren dil kodu için istek atmaz (GHSA-q89c-q3h5-w34g)', async () => {
    const backend = new HttpBackend(i18n.services, { loadPath: '/locales/{{lng}}/{{ns}}.json' });
    fetchMock.mockClear();
    const err = await new Promise<unknown>((resolve) => {
      backend.read('../../admin', 'translation', (error) => resolve(error));
    });
    expect(err).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('i18next deepExtend', () => {
  it('kalıtılmış yerleşik nesneleri bozmaz (GHSA-6jcc-5g8w-32mx)', async () => {
    const instance = i18n.createInstance();
    await instance.init({ lng: 'en', resources: {} });
    const hasOwn = Object.prototype.hasOwnProperty;
    try {
      instance.addResourceBundle('en', 'x', JSON.parse('{"hasOwnProperty":{"call":"x"}}'), true, true);
      expect(Object.getOwnPropertyNames(hasOwn)).not.toContain('call');
      expect(typeof hasOwn.call).toBe('function');
    } finally {
      // Eski sürümde bozulan yerleşiği geri al; diğer testler etkilenmesin.
      Reflect.deleteProperty(hasOwn, 'call');
    }
  });
});
