// Vite configuration file.
// Vite is the build tool/dev server we use to run this React app.
// WebStorm understands Vite projects natively, so no extra IDE config is needed.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './tests/setup.js',
    coverage: {
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/main.jsx'],
    },
  },
  server: {
    // Dev server port. Change this if 5173 is already used on your machine.
    port: 5173,
    open: true, // automatically opens the browser when you run "npm run dev"
  },
});
