import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@tamagui/core/reset.css'
import './fonts'
import { AppTheme } from './ThemePreference'
import './tamagui.generated.css'
import App from './App.tsx'

const root = document.getElementById('root')

if (!root) throw new Error('Missing app root')

createRoot(root).render(
  <StrictMode>
    <AppTheme>
      <App />
    </AppTheme>
  </StrictMode>,
)
