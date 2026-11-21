import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios, { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';
import { apiClient } from './client';
import { useAuthStore } from '../features/auth/authStore';

// Ağ kullanmadan axios interceptor'larının davranışını doğrular
// (Authorization ekleme ve 401'de tek seferlik token yenileme + yeniden deneme).
// axios sürüm yükseltmelerinde header/config birleştirme davranışını güvenceye alır.
type Seen = { url?: string; auth?: unknown };

function adapterWith(statusFor: (cfg: InternalAxiosRequestConfig) => number, seen: Seen[]) {
  const adapter: AxiosAdapter = async (config) => {
    seen.push({ url: config.url, auth: config.headers.Authorization });
    const status = statusFor(config);
    const response = { data: { ok: status === 200 }, status, statusText: '', headers: {}, config };
    if (status >= 400) {
      throw new AxiosError('fail', String(status), config, undefined, response);
    }
    return response;
  };
  return adapter;
}

const user = { id: 'u1', username: 'u', email: 'u@x.co' } as never;

beforeEach(() => {
  useAuthStore.setState({ accessToken: null, refreshToken: null, user: null });
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('apiClient interceptor', () => {
  it('store\'daki access token\'ı Bearer header olarak ekler', async () => {
    useAuthStore.setState({ accessToken: 'acc-1' });
    const seen: Seen[] = [];
    await apiClient.get('/me', { adapter: adapterWith(() => 200, seen) });
    expect(seen[0]?.auth).toBe('Bearer acc-1');
  });

  it('açıkça verilen Authorization header\'ını ezmez', async () => {
    useAuthStore.setState({ accessToken: 'acc-1' });
    const seen: Seen[] = [];
    await apiClient.get('/me', {
      adapter: adapterWith(() => 200, seen),
      headers: { Authorization: 'Bearer custom' },
    });
    expect(seen[0]?.auth).toBe('Bearer custom');
  });

  it('401 alınca token yeniler ve isteği yeni token ile tekrarlar', async () => {
    useAuthStore.setState({ accessToken: 'old', refreshToken: 'ref-1' });
    const post = vi.spyOn(axios, 'post').mockResolvedValue({
      data: { accessToken: 'new', refreshToken: 'ref-2', user },
    });
    const seen: Seen[] = [];
    const res = await apiClient.get('/lists', {
      adapter: adapterWith((cfg) => (cfg.headers.Authorization === 'Bearer new' ? 200 : 401), seen),
    });
    expect(res.status).toBe(200);
    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0]?.[0]).toBe(`${apiClient.defaults.baseURL}/auth/refresh`);
    expect(post.mock.calls[0]?.[1]).toEqual({ refreshToken: 'ref-1' });
    expect(seen.map((s) => s.auth)).toEqual(['Bearer old', 'Bearer new']);
    expect(useAuthStore.getState().accessToken).toBe('new');
  });

  it('yenileme başarısızsa oturumu temizler ve 401 hatasını iletir', async () => {
    useAuthStore.setState({ accessToken: 'old', refreshToken: 'ref-1' });
    vi.spyOn(axios, 'post').mockRejectedValue(new Error('refresh failed'));
    const seen: Seen[] = [];
    await expect(
      apiClient.get('/lists', { adapter: adapterWith(() => 401, seen) }),
    ).rejects.toMatchObject({ response: { status: 401 } });
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(seen).toHaveLength(1);
  });
});
