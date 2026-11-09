import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { TamaguiProvider, Text, View } from 'tamagui'
import { config } from '../tamagui.config'

type ThemePreference = 'system' | 'light' | 'dark'
const storageKey = 'glanceboard-theme'
const preferences = ['system', 'light', 'dark'] as const
const isPreference = (value: unknown): value is ThemePreference => preferences.some((item) => item === value)
const ThemePreferenceContext = createContext<{
  preference: ThemePreference
  setPreference: (preference: ThemePreference) => void
} | null>(null)

function readPreference(): ThemePreference {
  try {
    const saved = localStorage.getItem(storageKey)
    return isPreference(saved) ? saved : 'system'
  } catch {
    return 'system'
  }
}

export function AppTheme({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>(readPreference)
  const [systemDark, setSystemDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches)
  useEffect(() => {
    const query = matchMedia('(prefers-color-scheme: dark)')
    const update = () => setSystemDark(query.matches)
    query.addEventListener('change', update)
    const syncStorage = (event: StorageEvent) => {
      if (event.key === storageKey || event.key === null) setPreference(readPreference())
    }
    window.addEventListener('storage', syncStorage)
    return () => {
      query.removeEventListener('change', update)
      window.removeEventListener('storage', syncStorage)
    }
  }, [])
  const changePreference = (next: ThemePreference) => {
    setPreference(next)
    try { localStorage.setItem(storageKey, next) } catch { /* Theme switching remains available without storage. */ }
  }
  const theme = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference
  return (
    <ThemePreferenceContext value={{ preference, setPreference: changePreference }}>
      <TamaguiProvider config={config} defaultTheme={theme} disableInjectCSS>
        {children}
      </TamaguiProvider>
    </ThemePreferenceContext>
  )
}

export function ThemeControls() {
  const context = useContext(ThemePreferenceContext)
  if (!context) throw new Error('ThemeControls requires AppTheme')
  return (
    <View render="nav" aria-label="Appearance" w="100%" maxW="poster" px="4" py="3" gap="2" flexDirection="row" flexWrap="wrap" items="center" display="flex print:none">
      <Text fontFamily="body" color="muted" mr="auto">Appearance</Text>
      {preferences.map((preference) => (
        <View render="button" key={preference} aria-pressed={context.preference === preference}
          minH="badge" px="3" items="center" justify="center" rounded="sm" cursor="pointer"
          bg={context.preference === preference ? 'highlight' : 'surface hover:background-hover'}
          borderColor={context.preference === preference ? 'gold' : 'rule focus-visible:gold'} borderWidth={2}
          onClick={() => context.setPreference(preference)}>
          <Text fontFamily="body" fontSize="caption" lineHeight="caption" color="color">
            {preference === 'system' ? 'System' : preference === 'light' ? 'Light' : 'Dark'}
          </Text>
        </View>
      ))}
    </View>
  )
}
