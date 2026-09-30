import type { Request, Response } from 'express';

// Мок express Response — достаточно для хендлеров, которые вызывают только status/json/send.
export function fakeRes() {
  const state: { code: number; body: unknown } = { code: 200, body: undefined };
  const res = {
    status(code: number) {
      state.code = code;
      return res;
    },
    json(body: unknown) {
      state.body = body;
      return res;
    },
    send(body: unknown) {
      state.body = body;
      return res;
    },
  };
  return { res: res as unknown as Response, state };
}

export function fakeReq(overrides: Partial<Request> = {}): Request {
  return { headers: {}, body: {}, ...overrides } as unknown as Request;
}
