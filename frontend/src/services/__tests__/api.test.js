import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getGuestUuid } from '../guestStorage.js';

const axiosMock = vi.hoisted(() => {
  const state = {
    requestHandlers: [],
    responseHandlers: [],
  };

  const instance = {
    interceptors: {
      request: {
        use: vi.fn((handler) => {
          state.requestHandlers.push(handler);
        }),
      },
      response: {
        use: vi.fn((onFulfilled, onRejected) => {
          state.responseHandlers.push({ onFulfilled, onRejected });
        }),
      },
    },
    get: vi.fn(),
    post: vi.fn(),
  };

  const axios = {
    create: vi.fn(() => instance),
  };

  return { axios, instance, state };
});

vi.mock('axios', () => ({
  default: axiosMock.axios,
}));

vi.mock('../guestStorage.js', () => ({
  getGuestUuid: vi.fn(),
}));

async function loadApiModule() {
  vi.resetModules();
  axiosMock.state.requestHandlers = [];
  axiosMock.state.responseHandlers = [];
  axiosMock.instance.interceptors.request.use.mockClear();
  axiosMock.instance.interceptors.response.use.mockClear();
  axiosMock.axios.create.mockClear();
  getGuestUuid.mockReset();
  getGuestUuid.mockReturnValue('11111111-1111-4111-8111-111111111111');

  const apiModule = await import('../api.js');
  const requestHandler = axiosMock.state.requestHandlers[0];
  return { apiModule, requestHandler };
}

describe('api guest identity header', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not attach X-Guest-ID before auth state is resolved', async () => {
    const { requestHandler } = await loadApiModule();

    const config = requestHandler({ url: '/api/game/today', headers: {} });

    expect(config.headers['X-Guest-ID']).toBeUndefined();
    expect(getGuestUuid).not.toHaveBeenCalled();
  });

  it('does not attach X-Guest-ID to auth endpoints in guest mode', async () => {
    const { apiModule, requestHandler } = await loadApiModule();
    apiModule.setAuthenticatedSession(false);

    const config = requestHandler({ url: '/api/auth/me', headers: {} });

    expect(config.headers['X-Guest-ID']).toBeUndefined();
    expect(getGuestUuid).not.toHaveBeenCalled();
  });

  it('does not attach X-Guest-ID when the user is authenticated', async () => {
    const { apiModule, requestHandler } = await loadApiModule();
    apiModule.setAuthenticatedSession(true);

    const config = requestHandler({ url: '/api/game/today', headers: {} });

    expect(config.headers['X-Guest-ID']).toBeUndefined();
    expect(getGuestUuid).not.toHaveBeenCalled();
  });

  it('attaches X-Guest-ID after guest mode is confirmed', async () => {
    const { apiModule, requestHandler } = await loadApiModule();
    apiModule.setAuthenticatedSession(false);

    const config = requestHandler({ url: '/api/game/today', headers: {} });

    expect(config.headers['X-Guest-ID']).toBe('11111111-1111-4111-8111-111111111111');
    expect(getGuestUuid).toHaveBeenCalledTimes(1);
  });
});
