/**
 * ThemeProvider + useTheme.
 *
 * Resuelve el tema según:
 * 1. Override manual del usuario (guardado en AsyncStorage).
 * 2. Preferencia del sistema (useColorScheme de RN) si el usuario no overrideó.
 *
 * Expone `setMode('light' | 'dark' | 'system')` para el toggle de Ajustes.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { themes, type Theme } from './tokens';

type Mode = 'light' | 'dark' | 'system';

type ThemeContextValue = {
    theme: Theme;
    mode: Mode;
    setMode: (m: Mode) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = '@minimkt/theme-mode';

export function ThemeProvider({ children }: { children: ReactNode }) {
    const systemScheme = useColorScheme();
    const [mode, setModeState] = useState<Mode>('system');
    const [hydrated, setHydrated] = useState(false);

    // Hidratar override guardado
    useEffect(() => {
        AsyncStorage.getItem(STORAGE_KEY)
            .then((v) => {
                if (v === 'light' || v === 'dark' || v === 'system') setModeState(v);
            })
            .finally(() => setHydrated(true));
    }, []);

    const setMode = (m: Mode) => {
        setModeState(m);
        AsyncStorage.setItem(STORAGE_KEY, m).catch(() => undefined);
    };

    const resolved: 'light' | 'dark' = useMemo(() => {
        if (mode === 'system') return systemScheme === 'dark' ? 'dark' : 'light';
        return mode;
    }, [mode, systemScheme]);

    const value = useMemo<ThemeContextValue>(
        () => ({ theme: themes[resolved], mode, setMode }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [resolved, mode],
    );

    // Render children incluso sin hidratar — el tema por defecto (system) es correcto.
    // Evita flash de pantalla en blanco al bootear.
    void hydrated;

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error('useTheme debe usarse dentro de ThemeProvider');
    return ctx.theme;
}

export function useThemeMode(): { mode: Mode; setMode: (m: Mode) => void } {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error('useThemeMode debe usarse dentro de ThemeProvider');
    return { mode: ctx.mode, setMode: ctx.setMode };
}
