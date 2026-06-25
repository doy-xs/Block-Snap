import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/sys-user': {
        target: 'http://localhost:80',
        changeOrigin: true,
      },
      '/svc-instance': {
        target: 'http://localhost:80',
        changeOrigin: true,
      },
      '/svc-snapshot': {
        target: 'http://localhost:80',
        changeOrigin: true,
      },
      '/svc-mod': {
        target: 'http://localhost:80',
        changeOrigin: true,
      },
    },
  },
});
