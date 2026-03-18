import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/ui'),
      '@shared': path.resolve(__dirname, './src/ui/shared'),
      '@entities': path.resolve(__dirname, './src/ui/entities'),
      '@features': path.resolve(__dirname, './src/ui/features'),
      '@widgets': path.resolve(__dirname, './src/ui/widgets'),
      '@pages': path.resolve(__dirname, './src/ui/pages'),
    },
  },
});
