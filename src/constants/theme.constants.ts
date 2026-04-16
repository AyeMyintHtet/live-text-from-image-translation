export type ThemeMode = 'light' | 'dark'

type ThemePalette = {
  background: {
    base: string
    canvas: string
    muted: string
    elevated: string
    overlay: string
  }
  text: {
    primary: string
    secondary: string
    muted: string
    accent: string
    inverse: string
  }
  border: {
    default: string
    strong: string
    subtle: string
    accent: string
  }
  button: {
    primaryBg: string
    primaryHover: string
    primaryActive: string
    primaryText: string
    secondaryBg: string
    secondaryHover: string
    secondaryActive: string
    secondaryText: string
    ghostHover: string
  }
  status: {
    success: string
    warning: string
    error: string
    info: string
  }
  focusRing: string
  shadow: {
    soft: string
    medium: string
  }
}

export const THEME_STORAGE_KEY = 'ltfit-theme'

export const THEME_PALETTES: Record<ThemeMode, ThemePalette> = {
  light: {
    background: {
      base: '#edf4f3',
      canvas: '#f7fbfb',
      muted: '#e2eceb',
      elevated: '#ffffff',
      overlay: '#d7e4e2',
    },
    text: {
      primary: '#0f172a',
      secondary: '#334155',
      muted: '#64748b',
      accent: '#0f766e',
      inverse: '#f8fafc',
    },
    border: {
      default: '#b7c9c7',
      strong: '#6f8a86',
      subtle: '#d8e4e2',
      accent: '#0f766e',
    },
    button: {
      primaryBg: '#0f766e',
      primaryHover: '#115e59',
      primaryActive: '#134e4a',
      primaryText: '#f8fafc',
      secondaryBg: '#e2eceb',
      secondaryHover: '#d2e2df',
      secondaryActive: '#c4d8d4',
      secondaryText: '#0f172a',
      ghostHover: '#dbe8e6',
    },
    status: {
      success: '#15803d',
      warning: '#b45309',
      error: '#b91c1c',
      info: '#0369a1',
    },
    focusRing: '#14b8a6',
    shadow: {
      soft: '0 10px 30px rgba(15, 23, 42, 0.08)',
      medium: '0 18px 45px rgba(15, 23, 42, 0.12)',
    },
  },
  dark: {
    background: {
      base: '#0a1314',
      canvas: '#0f1a1c',
      muted: '#132328',
      elevated: '#1a2d31',
      overlay: '#274046',
    },
    text: {
      primary: '#e5f4f2',
      secondary: '#c0d6d2',
      muted: '#8ca8a4',
      accent: '#2dd4bf',
      inverse: '#042f2e',
    },
    border: {
      default: '#2d4b50',
      strong: '#4f7379',
      subtle: '#1f363b',
      accent: '#2dd4bf',
    },
    button: {
      primaryBg: '#2dd4bf',
      primaryHover: '#14b8a6',
      primaryActive: '#0d9488',
      primaryText: '#032b29',
      secondaryBg: '#1a2d31',
      secondaryHover: '#22383d',
      secondaryActive: '#29434a',
      secondaryText: '#e5f4f2',
      ghostHover: '#1d3238',
    },
    status: {
      success: '#4ade80',
      warning: '#f59e0b',
      error: '#f87171',
      info: '#38bdf8',
    },
    focusRing: '#2dd4bf',
    shadow: {
      soft: '0 12px 32px rgba(2, 10, 12, 0.46)',
      medium: '0 20px 50px rgba(2, 10, 12, 0.56)',
    },
  },
}

export const THEME_STATIC_TOKENS = {
  layoutMaxWidth: '1280px',
  layoutGutter: '1rem',
  borderRadiusSm: '10px',
  borderRadiusMd: '16px',
  borderRadiusLg: '22px',
} as const

export const CSS_VARIABLE_NAMES = {
  backgroundBase: '--color-bg-base',
  backgroundCanvas: '--color-bg-canvas',
  backgroundMuted: '--color-bg-muted',
  backgroundElevated: '--color-bg-elevated',
  backgroundOverlay: '--color-bg-overlay',
  textPrimary: '--color-text-primary',
  textSecondary: '--color-text-secondary',
  textMuted: '--color-text-muted',
  textAccent: '--color-text-accent',
  textInverse: '--color-text-inverse',
  borderDefault: '--color-border-default',
  borderStrong: '--color-border-strong',
  borderSubtle: '--color-border-subtle',
  borderAccent: '--color-border-accent',
  buttonPrimaryBg: '--color-button-primary-bg',
  buttonPrimaryHover: '--color-button-primary-hover',
  buttonPrimaryActive: '--color-button-primary-active',
  buttonPrimaryText: '--color-button-primary-text',
  buttonSecondaryBg: '--color-button-secondary-bg',
  buttonSecondaryHover: '--color-button-secondary-hover',
  buttonSecondaryActive: '--color-button-secondary-active',
  buttonSecondaryText: '--color-button-secondary-text',
  buttonGhostHover: '--color-button-ghost-hover',
  statusSuccess: '--color-status-success',
  statusWarning: '--color-status-warning',
  statusError: '--color-status-error',
  statusInfo: '--color-status-info',
  focusRing: '--color-focus-ring',
  shadowSoft: '--shadow-soft',
  shadowMedium: '--shadow-medium',
} as const

export const resolveThemeVariables = (mode: ThemeMode): Record<string, string> => {
  const palette = THEME_PALETTES[mode]

  return {
    [CSS_VARIABLE_NAMES.backgroundBase]: palette.background.base,
    [CSS_VARIABLE_NAMES.backgroundCanvas]: palette.background.canvas,
    [CSS_VARIABLE_NAMES.backgroundMuted]: palette.background.muted,
    [CSS_VARIABLE_NAMES.backgroundElevated]: palette.background.elevated,
    [CSS_VARIABLE_NAMES.backgroundOverlay]: palette.background.overlay,
    [CSS_VARIABLE_NAMES.textPrimary]: palette.text.primary,
    [CSS_VARIABLE_NAMES.textSecondary]: palette.text.secondary,
    [CSS_VARIABLE_NAMES.textMuted]: palette.text.muted,
    [CSS_VARIABLE_NAMES.textAccent]: palette.text.accent,
    [CSS_VARIABLE_NAMES.textInverse]: palette.text.inverse,
    [CSS_VARIABLE_NAMES.borderDefault]: palette.border.default,
    [CSS_VARIABLE_NAMES.borderStrong]: palette.border.strong,
    [CSS_VARIABLE_NAMES.borderSubtle]: palette.border.subtle,
    [CSS_VARIABLE_NAMES.borderAccent]: palette.border.accent,
    [CSS_VARIABLE_NAMES.buttonPrimaryBg]: palette.button.primaryBg,
    [CSS_VARIABLE_NAMES.buttonPrimaryHover]: palette.button.primaryHover,
    [CSS_VARIABLE_NAMES.buttonPrimaryActive]: palette.button.primaryActive,
    [CSS_VARIABLE_NAMES.buttonPrimaryText]: palette.button.primaryText,
    [CSS_VARIABLE_NAMES.buttonSecondaryBg]: palette.button.secondaryBg,
    [CSS_VARIABLE_NAMES.buttonSecondaryHover]: palette.button.secondaryHover,
    [CSS_VARIABLE_NAMES.buttonSecondaryActive]: palette.button.secondaryActive,
    [CSS_VARIABLE_NAMES.buttonSecondaryText]: palette.button.secondaryText,
    [CSS_VARIABLE_NAMES.buttonGhostHover]: palette.button.ghostHover,
    [CSS_VARIABLE_NAMES.statusSuccess]: palette.status.success,
    [CSS_VARIABLE_NAMES.statusWarning]: palette.status.warning,
    [CSS_VARIABLE_NAMES.statusError]: palette.status.error,
    [CSS_VARIABLE_NAMES.statusInfo]: palette.status.info,
    [CSS_VARIABLE_NAMES.focusRing]: palette.focusRing,
    [CSS_VARIABLE_NAMES.shadowSoft]: palette.shadow.soft,
    [CSS_VARIABLE_NAMES.shadowMedium]: palette.shadow.medium,
  }
}
