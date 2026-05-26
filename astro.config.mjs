import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import node from '@astrojs/node';

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [react()],
  server: {
    host: '127.0.0.1',
    port: 4321,
  },
  vite: {
    server: {
      // Allow Kokori on :3000 to be hit from the dev origin
      cors: true,
    },
  },
});
