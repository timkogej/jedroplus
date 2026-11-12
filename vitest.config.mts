// Testi glasovnega asistenta (lib/glas). Brez brskalnika in brez mreže:
// ponudniki, shramba in podatki salona so lažni (v pomnilniku).
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname) } },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
