import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'
import { resolve } from 'path'
import dotenv from 'dotenv'

dotenv.config()

// https://vite.dev/config/
export default defineConfig(({ command }) => {
  const isServe = command === 'serve'
  const isBuild = command === 'build'
  const sourcemap = isServe || !!process.env.VSCODE_DEBUG
  
  return {
    plugins: [
      react(),
      electron({
        main: {
          // Shortcut of `build.lib.entry`
          entry: 'electron/main.ts',
          vite: {
            build: {
              sourcemap,
              minify: isBuild,
              outDir: 'dist-electron',
              rollupOptions: {
                // Make sure to externalize Node.js built-in modules
                external: [
                  'electron', 
                  'electron-is-dev', 
                  'dotenv', 
                  'fs', 
                  'path', 
                  'url', 
                  'os', 
                  'events', 
                  'crypto', 
                  'firebase-admin',
                  'firebase-admin/app',
                  'firebase-admin/auth',
                  'firebase-admin/database'
                ],
                output: {
                  format: 'esm'
                }
              },
            },
          },
        },
        preload: {
          // Shortcut of `build.rollupOptions.input`
          input: 'electron/preload.ts',
          // Ensure preload script is built as CommonJS and has .js extension
          vite: {
            build: {
              sourcemap,
              minify: isBuild,
              outDir: 'dist-electron',
              rollupOptions: {
                external: ['electron'],
                output: {
                  format: 'cjs',
                  entryFileNames: '[name].js'
                },
              },
            },
          },
        },
        // Enable uses Electron in renderer process
        // renderer: {},
      }),
    ],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src')
      }
    },
    build: {
      outDir: 'dist', // Specify the output directory for the renderer process
      emptyOutDir: true,
      sourcemap,
      minify: isBuild,
    },
    define: {
      'process.env.FIREBASE_API_KEY': JSON.stringify(process.env.FIREBASE_API_KEY),
      'process.env.FIREBASE_AUTH_DOMAIN': JSON.stringify(process.env.FIREBASE_AUTH_DOMAIN),
      'process.env.FIREBASE_PROJECT_ID': JSON.stringify(process.env.FIREBASE_PROJECT_ID),
      'process.env.FIREBASE_STORAGE_BUCKET': JSON.stringify(process.env.FIREBASE_STORAGE_BUCKET),
      'process.env.FIREBASE_MESSAGING_SENDER_ID': JSON.stringify(process.env.FIREBASE_MESSAGING_SENDER_ID),
      'process.env.FIREBASE_APP_ID': JSON.stringify(process.env.FIREBASE_APP_ID),
      'process.env.FIREBASE_MEASUREMENT_ID': JSON.stringify(process.env.FIREBASE_MEASUREMENT_ID),
      'process.env.FIREBASE_DATABASE_URL': JSON.stringify(process.env.FIREBASE_DATABASE_URL),
      'process.env.GOOGLE_CLIENT_ID': JSON.stringify(process.env.GOOGLE_CLIENT_ID),
      'process.env.GOOGLE_CLIENT_SECRET': JSON.stringify(process.env.GOOGLE_CLIENT_SECRET),
      'process.env.AUTH_BASE_URL': JSON.stringify(process.env.AUTH_BASE_URL || 'http://localhost:5173/#/login')
    }
  }
})
