import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => ({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        org_chart: path.resolve(__dirname, 'org_chart.html'),
        job_application: path.resolve(__dirname, 'job_application.html'),
        payroll: path.resolve(__dirname, 'payroll.html'),
        procurement: path.resolve(__dirname, 'procurement.html'),
      },
    },
  },
  server: {
    hmr: process.env.DISABLE_HMR !== 'true',
    watch: process.env.DISABLE_HMR === 'true' ? null : {},
  },
}));
