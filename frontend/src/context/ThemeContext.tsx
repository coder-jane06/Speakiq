import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';
type AccentColor = 'green' | 'blue' | 'purple' | 'orange' | 'red';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  accentColor: AccentColor;
  setAccentColor: (color: AccentColor) => void;
  borderRadius: number;
  setBorderRadius: (radius: number) => void;
  uiDensity: 'Comfortable' | 'Compact';
  setUiDensity: (density: 'Comfortable' | 'Compact') => void;
}

// ── Accent palettes ────────────────────────────────────────────────────────
const ACCENT_PALETTES: Record<AccentColor, {
  dark:  { accent: string; accentText: string; accentDim: string; accentGlow: string; borderAccent: string };
  light: { accent: string; accentText: string; accentDim: string; accentGlow: string; borderAccent: string };
}> = {
  green: {
    dark:  { accent: '#C8F97D', accentText: '#09090F', accentDim: 'rgba(200,249,125,0.10)', accentGlow: 'rgba(200,249,125,0.18)', borderAccent: 'rgba(200,249,125,0.22)' },
    light: { accent: '#3E8C00', accentText: '#FFFFFF',  accentDim: 'rgba(62,140,0,0.10)',    accentGlow: 'rgba(62,140,0,0.15)',    borderAccent: 'rgba(74,140,0,0.22)' },
  },
  blue: {
    dark:  { accent: '#60A5FA', accentText: '#09090F', accentDim: 'rgba(96,165,250,0.10)', accentGlow: 'rgba(96,165,250,0.18)', borderAccent: 'rgba(96,165,250,0.22)' },
    light: { accent: '#2563EB', accentText: '#FFFFFF',  accentDim: 'rgba(37,99,235,0.10)',  accentGlow: 'rgba(37,99,235,0.15)',  borderAccent: 'rgba(37,99,235,0.22)' },
  },
  purple: {
    dark:  { accent: '#C084FC', accentText: '#09090F', accentDim: 'rgba(192,132,252,0.10)', accentGlow: 'rgba(192,132,252,0.18)', borderAccent: 'rgba(192,132,252,0.22)' },
    light: { accent: '#7C3AED', accentText: '#FFFFFF',  accentDim: 'rgba(124,58,237,0.10)',  accentGlow: 'rgba(124,58,237,0.15)',  borderAccent: 'rgba(124,58,237,0.22)' },
  },
  orange: {
    dark:  { accent: '#FB923C', accentText: '#09090F', accentDim: 'rgba(251,146,60,0.10)', accentGlow: 'rgba(251,146,60,0.18)', borderAccent: 'rgba(251,146,60,0.22)' },
    light: { accent: '#EA580C', accentText: '#FFFFFF',  accentDim: 'rgba(234,88,12,0.10)',  accentGlow: 'rgba(234,88,12,0.15)',  borderAccent: 'rgba(234,88,12,0.22)' },
  },
  red: {
    dark:  { accent: '#F87171', accentText: '#09090F', accentDim: 'rgba(248,113,113,0.10)', accentGlow: 'rgba(248,113,113,0.18)', borderAccent: 'rgba(248,113,113,0.22)' },
    light: { accent: '#DC2626', accentText: '#FFFFFF',  accentDim: 'rgba(220,38,38,0.10)',   accentGlow: 'rgba(220,38,38,0.15)',   borderAccent: 'rgba(220,38,38,0.22)' },
  },
};

function applyAccentToDOM(color: AccentColor, theme: Theme) {
  const root = document.documentElement;
  const palette = ACCENT_PALETTES[color]?.[theme] ?? ACCENT_PALETTES.green[theme];
  root.style.setProperty('--accent',        palette.accent);
  root.style.setProperty('--accent-text',   palette.accentText);
  root.style.setProperty('--accent-dim',    palette.accentDim);
  root.style.setProperty('--accent-glow',   palette.accentGlow);
  root.style.setProperty('--border-accent', palette.borderAccent);
}

function applyRadiusToDOM(radius: number) {
  const root = document.documentElement;
  // Scale from base: sm = radius*0.4, md = radius*0.67, lg = radius, xl = radius*1.2
  root.style.setProperty('--radius-sm', `${Math.round(radius * 0.4)}px`);
  root.style.setProperty('--radius-md', `${Math.round(radius * 0.67)}px`);
  root.style.setProperty('--radius-lg', `${radius}px`);
  root.style.setProperty('--radius-xl', `${Math.round(radius * 1.2)}px`);
}

function applyDensityToDOM(density: 'Comfortable' | 'Compact') {
  document.documentElement.setAttribute('data-density', density.toLowerCase());
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const params = new URLSearchParams(window.location.search);
    const urlTheme = params.get('theme');
    if (urlTheme === 'dark' || urlTheme === 'light') return urlTheme;
    const saved = localStorage.getItem('fluently_theme') as Theme;
    if (saved === 'dark' || saved === 'light') return saved;
    return 'dark';
  });

  const [accentColor, setAccentColorState] = useState<AccentColor>(() => {
    return (localStorage.getItem('fluently_accent') as AccentColor) || 'green';
  });

  const [borderRadius, setBorderRadiusState] = useState<number>(() => {
    const saved = localStorage.getItem('fluently_radius');
    return saved ? Number(saved) : 22;
  });

  const [uiDensity, setUiDensityState] = useState<'Comfortable' | 'Compact'>(() => {
    return (localStorage.getItem('fluently_density') as 'Comfortable' | 'Compact') || 'Comfortable';
  });

  // ── Apply theme class ──────────────────────────────────────────────────────
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    localStorage.setItem('fluently_theme', theme);

    const url = new URL(window.location.href);
    if (url.searchParams.get('theme') !== theme) {
      url.searchParams.set('theme', theme);
      window.history.replaceState({}, '', url.toString());
    }

    // Re-apply accent when theme switches (dark/light palettes differ)
    applyAccentToDOM(accentColor, theme);
  }, [theme, accentColor]);

  // ── Apply accent color ─────────────────────────────────────────────────────
  useEffect(() => {
    applyAccentToDOM(accentColor, theme);
    localStorage.setItem('fluently_accent', accentColor);
  }, [accentColor, theme]);

  // ── Apply border radius ────────────────────────────────────────────────────
  useEffect(() => {
    applyRadiusToDOM(borderRadius);
    localStorage.setItem('fluently_radius', String(borderRadius));
  }, [borderRadius]);

  // ── Apply density ──────────────────────────────────────────────────────────
  useEffect(() => {
    applyDensityToDOM(uiDensity);
    localStorage.setItem('fluently_density', uiDensity);
  }, [uiDensity]);

  // ── On first mount, apply all saved values immediately ────────────────────
  useEffect(() => {
    applyAccentToDOM(accentColor, theme);
    applyRadiusToDOM(borderRadius);
    applyDensityToDOM(uiDensity);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleTheme = () => setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));

  const setAccentColor = (color: AccentColor) => setAccentColorState(color);
  const setBorderRadius = (r: number) => setBorderRadiusState(r);
  const setUiDensity = (d: 'Comfortable' | 'Compact') => setUiDensityState(d);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, accentColor, setAccentColor, borderRadius, setBorderRadius, uiDensity, setUiDensity }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}