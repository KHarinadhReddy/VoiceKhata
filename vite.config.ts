import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Allow Cloudflare Quick Tunnel hostnames (https://*.trycloudflare.com) —
    // the dev server otherwise rejects them with a 403 for security.
    allowedHosts: ['.trycloudflare.com'],
  },
})
