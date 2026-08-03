import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// Native ESM Vite plugin (JS)
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error no types for .mjs plugin side-car
import { shortsGeneratePlugin } from './vite.shortsPlugin.mjs'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), shortsGeneratePlugin()],
})
