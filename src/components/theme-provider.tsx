import { createContext, useContext, useEffect, useState } from "react"
import { themes } from "@/config/themes"
import { useDataStore } from "@/hooks/useDataStore";

type ThemeName = string; // "light" | "dark" | "midnight" | ...

type ThemeProviderProps = {
    children: React.ReactNode
    defaultTheme?: ThemeName
    storageKey?: string
}

type ThemeProviderState = {
    theme: ThemeName
    setTheme: (theme: ThemeName) => void
}

const initialState: ThemeProviderState = {
    theme: "system",
    setTheme: () => null,
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

export function ThemeProvider({
    children,
    defaultTheme = "system",
    storageKey = "vite-ui-theme",
}: ThemeProviderProps) {
    const [theme, setTheme] = useState<ThemeName>(
        () => (localStorage.getItem(storageKey) as ThemeName) || defaultTheme
    )

    const { settings } = useDataStore();

    useEffect(() => {
        const root = window.document.documentElement
        root.classList.remove("light", "dark")

        let effectiveThemeName = theme;

        if (theme === "system") {
            const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
                .matches
                ? "dark"
                : "light"
            effectiveThemeName = systemTheme;
        }

        const isDark = effectiveThemeName !== 'light';
        root.classList.add(isDark ? 'dark' : 'light');

        // Apply CSS Variables
        // If dark mode, use the preset from settings, otherwise default to 'default' (dark)
        // If light mode, use 'light'
        let themeKey = effectiveThemeName;

        if (isDark) {
            themeKey = settings?.themePreset || 'default';
        }

        const themeConfig = themes[themeKey] || themes['default'] || themes['dark'];

        if (themeConfig) {
            Object.entries(themeConfig.colors).forEach(([key, value]) => {
                const cssVar = `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
                root.style.setProperty(cssVar, value);
            });
        }

    }, [theme, settings?.themePreset])

    const value = {
        theme,
        setTheme: (theme: ThemeName) => {
            localStorage.setItem(storageKey, theme)
            setTheme(theme)
        },
    }

    return (
        <ThemeProviderContext.Provider value={value}>
            {children}
        </ThemeProviderContext.Provider>
    )
}

export const useTheme = () => {
    const context = useContext(ThemeProviderContext)

    if (context === undefined)
        throw new Error("useTheme must be used within a ThemeProvider")

    return context
}
