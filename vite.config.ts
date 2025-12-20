import { defineConfig } from 'vite'
import path from 'node:path'
import electron from 'vite-plugin-electron/simple'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import * as dotenv from 'dotenv'

// Load .env file
dotenv.config()

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    // Inject environment variables at build time
    'process.env.CLIENT_ID': JSON.stringify(process.env.CLIENT_ID || ''),
    'process.env.CLIENT_SECRET': JSON.stringify(process.env.CLIENT_SECRET || ''),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tiptap/extensions': '@tiptap/extensions',
    },
  },
  plugins: [
    react(),
    electron({
      main: {
        // Shortcut of `build.lib.entry`.
        entry: 'electron/main.ts',
        vite: {
          build: {
            rollupOptions: {
              external: ['active-win', 'screenshot-desktop', 'jpeg-js'],
              input: {
                main: path.resolve(__dirname, 'electron/main.ts'),
                'screenshot-worker': path.resolve(__dirname, 'electron/tracking/screenshot-worker.ts')
              }
            },
          },
        },
      },
      preload: {
        // Shortcut of `build.rollupOptions.input`.
        // Preload scripts may contain Web assets, so use the `build.rollupOptions.input` instead `build.lib.entry`.
        input: path.join(__dirname, 'electron/preload.ts'),
      },
      // Ployfill the Electron and Node.js API for Renderer process.
      // If you want use Node.js in Renderer process, the `nodeIntegration` needs to be enabled in the Main process.
      // See 👉 https://github.com/electron-vite/vite-plugin-electron-renderer
      renderer: process.env.NODE_ENV === 'test'
        // https://github.com/electron-vite/vite-plugin-electron-renderer/issues/78#issuecomment-2053600808
        ? undefined
        : {},
    }),
  ],
})
