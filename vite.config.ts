import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rolldownOptions: {
      output: {
        // Тяжёлые библиотеки — в отдельные файлы: после обновления приложения
        // они не меняются и берутся из кэша браузера (см. Cache-Control в server/index.ts)
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'firebase', test: /node_modules[\\/](@firebase|firebase)[\\/]/ },
          ],
        },
      },
    },
  },
});
