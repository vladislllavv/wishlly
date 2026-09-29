// Просмотр интерфейса локально без Firebase: npm run dev:mock (см. dev/firebase-mock.ts)
import { defineConfig, mergeConfig } from 'vite';
import base from './vite.config.ts';

const mock = new URL('./dev/firebase-mock.ts', import.meta.url).pathname;

export default mergeConfig(base, defineConfig({
  resolve: {
    alias: [
      { find: /^firebase\/(app|auth|firestore)$/, replacement: mock },
    ],
  },
  server: { host: '127.0.0.1', port: 5173 },
}));
