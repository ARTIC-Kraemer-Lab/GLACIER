import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  root: 'src/renderer', // React app source folder
  plugins: [react()],
  base: './',
  build: {
    outDir: '../../dist/renderer', // Output folder for built frontend
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'src/renderer/index.html'),
        loading: path.resolve(__dirname, 'src/renderer/loading.html')
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/renderer')
    }
  }
});
