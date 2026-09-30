import compression from 'compression';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleAuth } from './routes/auth.js';
import { handleTelegramWebhook } from './routes/telegramWebhook.js';
import { handleParseLink } from './routes/parseLink.js';
import { startReminderScheduler } from './notifications.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, '..', 'dist');

const app = express();
app.disable('x-powered-by');
app.use(compression());
app.use(express.json({ limit: '1mb' }));

app.post('/api/auth', handleAuth);
app.post('/api/telegram-webhook', handleTelegramWebhook);
app.post('/api/parse-link', handleParseLink);

// Файлы в assets/ содержат хэш в имени — кэшируем надолго; index.html всегда проверяем заново,
// чтобы после деплоя пользователь сразу получал новые хэши
app.use(express.static(distDir, {
  index: false,
  setHeaders(res, filePath) {
    const isHashedAsset = filePath.includes(`${path.sep}assets${path.sep}`);
    res.setHeader('Cache-Control', isHashedAsset ? 'public, max-age=31536000, immutable' : 'no-cache');
  },
}));
app.get('*', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(distDir, 'index.html'));
});

const port = Number(process.env.PORT) || 3001;
app.listen(port, () => {
  console.log(`wishlly server listening on :${port}`);
  startReminderScheduler();
});
