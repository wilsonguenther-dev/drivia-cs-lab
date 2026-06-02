import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import netlify from '@astrojs/netlify';

export default defineConfig({
  output: 'server',
  adapter: netlify(),
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
