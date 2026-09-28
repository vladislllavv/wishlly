import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleAuth } from './routes/auth.js';
import { handleTelegramWebhook } from './routes/telegramWebhook.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, '..', 'dist');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

app.post('/api/auth', handleAuth);
app.post('/api/telegram-webhook', handleTelegramWebhook);

app.use(express.static(distDir));
app.get('*', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));

const port = Number(process.env.PORT) || 3001;
app.listen(port, () => console.log(`wishlly server listening on :${port}`));
