import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  handleParseLink,
  pickMeta,
  extractJsonLdProduct,
  decodeEntities,
  isPrivateOrReservedIp,
} from '../../server/routes/parseLink.js';
import { fakeReq, fakeRes } from './helpers.js';

test('pickMeta находит og:title независимо от порядка атрибутов', () => {
  const html = '<meta content="Тестовый товар" property="og:title">';
  assert.equal(pickMeta(html, ['og:title']), 'Тестовый товар');
});

test('pickMeta возвращает null, если тега нет', () => {
  assert.equal(pickMeta('<html></html>', ['og:title']), null);
});

test('extractJsonLdProduct находит Product в @graph', () => {
  const html = `<script type="application/ld+json">
    {"@graph": [{"@type": "Organization"}, {"@type": "Product", "name": "Штука", "offers": {"price": "100"}}]}
  </script>`;
  const product = extractJsonLdProduct(html);
  assert.equal(product?.name, 'Штука');
});

test('extractJsonLdProduct игнорирует битый JSON', () => {
  const html = '<script type="application/ld+json">{ not json </script>';
  assert.equal(extractJsonLdProduct(html), null);
});

test('decodeEntities разворачивает базовые html-сущности', () => {
  assert.equal(decodeEntities('Кофе &amp; чай &#39;премиум&#39;'), "Кофе & чай 'премиум'");
});

test('isPrivateOrReservedIp: блокирует loopback/private/link-local IPv4', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254']) {
    assert.equal(isPrivateOrReservedIp(ip, 4), true, ip);
  }
});

test('isPrivateOrReservedIp: пропускает обычные публичные IPv4', () => {
  for (const ip of ['93.184.216.34', '8.8.8.8']) {
    assert.equal(isPrivateOrReservedIp(ip, 4), false, ip);
  }
});

test('isPrivateOrReservedIp: блокирует IPv6 loopback/link-local/ULA и IPv4-mapped приватные', () => {
  for (const ip of ['::1', 'fe80::1', 'fd00::1', '::ffff:127.0.0.1']) {
    assert.equal(isPrivateOrReservedIp(ip, 6), true, ip);
  }
});

// SSRF-регрессия: /api/parse-link делает server-side fetch по адресу, присланному клиентом —
// см. server/routes/parseLink.ts. Локальные/служебные адреса должны отклоняться до fetch.
for (const url of [
  'http://127.0.0.1:65535/x',
  'http://169.254.169.254/latest/meta-data',
  'http://localhost:1/x',
  'http://10.0.0.5/internal',
]) {
  test(`parse-link отклоняет запрос к приватному/служебному адресу: ${url}`, async () => {
    const { res, state } = fakeRes();
    await handleParseLink(fakeReq({ body: { url } }), res);
    assert.equal(state.code, 400);
  });
}

test('parse-link отклоняет не-http(s) схему', async () => {
  const { res, state } = fakeRes();
  await handleParseLink(fakeReq({ body: { url: 'file:///etc/passwd' } }), res);
  assert.equal(state.code, 400);
});
