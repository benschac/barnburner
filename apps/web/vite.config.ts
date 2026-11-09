import react from '@vitejs/plugin-react'
import { tamaguiPlugin } from '@tamagui/cli/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [tamaguiPlugin(), react()],
})
