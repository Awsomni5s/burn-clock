import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({define:{__APP_BUILT_AT__:JSON.stringify(new Date().toISOString())},plugins:[react()], build:{chunkSizeWarningLimit:1100}});
