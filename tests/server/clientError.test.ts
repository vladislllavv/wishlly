import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleClientError } from '../../server/routes/clientError.js';
import { fakeReq, fakeRes } from './helpers.js';

test('client-error принимает отчёт и отвечает 204', async () => {
  const { res, state } = fakeRes();
  await handleClientError(
    fakeReq({ body: { context: 'render', message: 'boom', stack: 'at x', url: 'https://wishlly.ru/', userAgent: 'test-ua', inTelegram: true } }),
    res,
  );
  assert.equal(state.code, 204);
});

test('client-error не падает на пустом или кривом теле', async () => {
  const { res, state } = fakeRes();
  await handleClientError(fakeReq({ body: {} }), res);
  assert.equal(state.code, 204);
});
