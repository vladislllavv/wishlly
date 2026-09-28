import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { requireEnv } from '../env.js';

const MAX_AUTH_AGE_SECONDS = 24 * 60 * 60;

function getAdminAuth() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: requireEnv('FIREBASE_ADMIN_PROJECT_ID'),
        clientEmail: requireEnv('FIREBASE_ADMIN_CLIENT_EMAIL'),
        // Секрет хранит переносы строк как "\n" — восстанавливаем их
        privateKey: requireEnv('FIREBASE_ADMIN_PRIVATE_KEY').replace(/\\n/g, '\n'),
      }),
    });
  }
  return getAuth();
}

// Проверка подписи Telegram WebApp initData
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
function verifyInitData(initData: string, botToken: string) {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expectedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (
    expectedHash.length !== hash.length ||
    !crypto.timingSafeEqual(Buffer.from(expectedHash), Buffer.from(hash))
  ) {
    return null;
  }

  const authDate = Number(params.get('auth_date'));
  if (!authDate || Date.now() / 1000 - authDate > MAX_AUTH_AGE_SECONDS) return null;

  const user = JSON.parse(params.get('user') || 'null');
  return user?.id ? user : null;
}

export async function handleAuth(req: Request, res: Response) {
  try {
    const initData = typeof req.body?.initData === 'string' ? req.body.initData : '';
    if (!initData || initData.length > 4096) {
      res.status(400).json({ error: 'initData is required' });
      return;
    }

    const tgUser = verifyInitData(initData, requireEnv('TELEGRAM_BOT_TOKEN'));
    if (!tgUser) {
      res.status(401).json({ error: 'Invalid initData' });
      return;
    }

    const token = await getAdminAuth().createCustomToken(`tg_${tgUser.id}`, {
      telegramId: tgUser.id,
    });
    res.json({ token });
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
}
