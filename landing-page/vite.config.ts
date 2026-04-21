import './vite-plugin-handlebars.d.ts';
import { defineConfig, type Plugin } from 'vite';
import handlebars from 'vite-plugin-handlebars';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';
import { readFileSync, writeFileSync } from 'fs';

function sitemapLastmod(): Plugin {
  return {
    name: 'sitemap-lastmod',
    apply: 'build',
    writeBundle() {
      const out = resolve(__dirname, 'dist/sitemap.xml');
      try {
        const today = new Date().toISOString().slice(0, 10);
        const xml = readFileSync(out, 'utf8').replace(
          /<lastmod>[^<]*<\/lastmod>/g,
          `<lastmod>${today}</lastmod>`,
        );
        writeFileSync(out, xml);
        console.log(`[sitemap-lastmod] lastmod → ${today}`);
      } catch {
        // sitemap may not exist; ignore
      }
    },
  };
}

export default defineConfig({
  root: '.',
  plugins: [
    tailwindcss(),
    handlebars({
      partialDirectory: resolve(__dirname, 'partials'),
    }),
    sitemapLastmod(),
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
