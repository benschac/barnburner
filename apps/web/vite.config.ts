import react from '@vitejs/plugin-react'
import { tamaguiPlugin } from '@tamagui/cli/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [tamaguiPlugin(), react()],
  server: { proxy: { '/api': 'http://127.0.0.1:3001' } },
  preview: { proxy: { '/api': 'http://127.0.0.1:3001' } },
})
