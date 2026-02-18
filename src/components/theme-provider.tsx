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
        const root = window.document.documentElement;

        let effectiveThemeName = theme;

        if (theme === "system") {
            const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
                .matches
                ? "dark"
                : "light";
            effectiveThemeName = systemTheme;
        }

        const isDark = effectiveThemeName !== 'light';

        // 1. Disable transitions to prevent flash
        root.classList.add('no-transitions');

        // 2. Apply CSS Variables FIRST
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

        // 3. Atomically update classes
        if (isDark) {
            root.classList.remove('light');
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
            root.classList.add('light');
        }

        // 4. Re-enable transitions after a frame
        // Force reflow
        // void root.offsetWidth; 
        // requestAnimationFrame(() => root.classList.remove('no-transitions'));

        // Actually, for "White Flash", it's usually because the background color is white by default.
        // If we set the color scheme property, browsers handle it better.
        root.style.colorScheme = isDark ? 'dark' : 'light';

        const timer = setTimeout(() => {
            root.classList.remove('no-transitions');
        }, 0);

        return () => clearTimeout(timer);

    }, [theme, settings?.themePreset]);

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
