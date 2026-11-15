import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' so the built app works from any folder (GitHub Pages, Netlify, a USB stick...)
export default defineConfig({
  base: './',
  plugins: [react()],
});
