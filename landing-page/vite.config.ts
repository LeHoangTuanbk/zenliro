import { defineConfig } from 'vite';
import handlebars from 'vite-plugin-handlebars';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  plugins: [
    tailwindcss(),
    handlebars({
      partialDirectory: resolve(__dirname, 'partials'),
    }),
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
