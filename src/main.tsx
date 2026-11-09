import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { TamaguiProvider } from 'tamagui'
import { config } from '../tamagui.config'
import './index.css'
import './tamagui.generated.css'
import App from './App.tsx'

const root = document.getElementById('root')

if (!root) throw new Error('Missing app root')

createRoot(root).render(
  <StrictMode>
    <TamaguiProvider config={config} defaultTheme="light" disableInjectCSS>
      <App />
    </TamaguiProvider>
  </StrictMode>,
)
