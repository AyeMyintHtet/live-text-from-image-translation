import path from 'node:path'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

import { mangaOcrVitePlugin } from './manga-ocr.vite-plugin'

export default defineConfig({
  plugins: [react(), tailwindcss(), mangaOcrVitePlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
