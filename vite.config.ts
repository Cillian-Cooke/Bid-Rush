import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  appType: 'spa',
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        film: fileURLToPath(new URL('./film.html', import.meta.url)),
      },
    },
  },
  plugins: [
    react(),
    {
      name: 'film-studio-alias',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = req.url ?? ''
          const path = url.split('?')[0] ?? ''
          if (path === '/film' || path === '/film/') {
            const qs = url.includes('?') ? url.slice(url.indexOf('?')) : ''
            res.statusCode = 302
            res.setHeader('Location', `/film.html${qs}`)
            res.end()
            return
          }
          next()
        })
      },
    },
  ],
})
