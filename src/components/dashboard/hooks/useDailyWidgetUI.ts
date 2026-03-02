import { useState, useEffect, useRef } from 'react';
import { themes } from "@/config/themes";

export function useDailyWidgetUI(
    settings: any,
    isWidgetMode: boolean,
    setWidgetMode: (mode: boolean) => void,
    saveSettings: (settings: any) => void,
    theme: string | undefined,
    setTheme: (theme: string) => void,
    todos: any[]
) {
    const [isWidgetLocked, setIsWidgetLocked] = useState(false);
    const [isPinned, setIsPinned] = useState(false);
    const headerRef = useRef<HTMLDivElement>(null);
    const editorContentRef = useRef<HTMLDivElement>(null);

    const lastHeightRef = useRef<number>(0);
    const resizeTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

    useEffect(() => {
        if (!isWidgetMode || !headerRef.current || !editorContentRef.current || !(window as any).ipcRenderer) return;

        if (settings?.widgetAutoResize === false || settings?.widgetPositionLocked) return;

        const calculateAndResize = () => {
            const headerHeight = headerRef.current?.offsetHeight || 0;
            const contentHeight = editorContentRef.current?.offsetHeight || 0;
            const totalHeight = headerHeight + contentHeight + 40;

            const maxHeight = settings?.widgetMaxHeight || 800;
            const finalHeight = Math.min(totalHeight, maxHeight);

            if (Math.abs(finalHeight - lastHeightRef.current) > 2) {
                lastHeightRef.current = finalHeight;
                (window as any).ipcRenderer.send('resize-widget', { width: 435, height: finalHeight });
            }
        };

        const observer = new ResizeObserver(() => {
            if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);
            resizeTimeoutRef.current = setTimeout(() => {
                calculateAndResize();
            }, 100);
        });

        observer.observe(headerRef.current);
        observer.observe(editorContentRef.current);

        calculateAndResize();

        return () => {
            observer.disconnect();
            if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);
        };
    }, [isWidgetMode, todos, settings?.widgetMaxHeight, settings?.widgetAutoResize, settings?.widgetPositionLocked]);

    useEffect(() => {
        if (!isWidgetMode || settings?.widgetAutoResize || settings?.widgetPositionLocked) return;

        let resizeTimeout: NodeJS.Timeout;
        const onResize = () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                const currentHeight = window.innerHeight;
                if (currentHeight > 100 && settings) {
                    saveSettings({ ...settings, widgetCustomHeight: currentHeight });
                }
            }, 500);
        };

        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, [isWidgetMode, settings?.widgetAutoResize, settings?.widgetPositionLocked, saveSettings]);

    useEffect(() => {
        if (!settings) return;

        let targetTheme = settings.mainTheme || 'dark';
        let targetPreset = settings.themePreset || 'standard';

        if (settings.separateWidgetTheme && isWidgetMode) {
            targetTheme = settings.widgetTheme || 'dark';
            targetPreset = settings.widgetThemePreset || settings.themePreset || 'standard';

            if (!settings.mainTheme && theme && theme !== targetTheme) {
                saveSettings({ ...settings, mainTheme: theme as 'dark' | 'light' | 'system' });
            }
        }

        if (theme !== targetTheme) {
            setTheme(targetTheme);
        }

        if (isWidgetMode && settings.separateWidgetTheme && settings.widgetThemePreset && settings.widgetThemePreset !== settings.themePreset) {
            const themeConfig = themes[targetPreset] || themes['default'];
            const root = window.document.documentElement;
            if (themeConfig) {
                Object.entries(themeConfig.colors).forEach(([key, value]) => {
                    const cssVar = `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
                    root.style.setProperty(cssVar, value);
                });
            }
        } else if (!isWidgetMode) {
            let effectiveThemeName = theme;
            if (theme === "system") {
                const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
                effectiveThemeName = systemTheme;
            }
            const isDark = effectiveThemeName !== 'light';

            let themeKey = 'light';
            if (isDark) {
                themeKey = settings.themePreset || 'default';
            }

            const themeConfig = themes[themeKey] || themes['default'] || themes['dark'];
            const root = window.document.documentElement;
            if (themeConfig) {
                Object.entries(themeConfig.colors).forEach(([key, value]) => {
                    const cssVar = `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
                    root.style.setProperty(cssVar, value);
                });
            }
        }
    }, [isWidgetMode, settings?.widgetTheme, settings?.mainTheme, settings?.separateWidgetTheme, settings?.themePreset, settings?.widgetThemePreset, theme, saveSettings, setTheme]);

    useEffect(() => {
        if ((window as any).ipcRenderer && settings) {
            (window as any).ipcRenderer.send('set-window-locked', settings.widgetPositionLocked || false);
        }
    }, [settings?.widgetPositionLocked]);

    const togglePin = async () => {
        const newState = !isPinned;

        if (newState) {
            setIsPinned(true);
            setWidgetMode(true);
        }

        let targetHeight = 800;
        let bounds = undefined;

        if (newState) {
            if (settings?.widgetCustomHeight && !settings.widgetAutoResize) {
                targetHeight = settings.widgetCustomHeight;
            } else if (headerRef.current && editorContentRef.current) {
                const headerHeight = headerRef.current?.offsetHeight || 0;
                const contentHeight = editorContentRef.current?.offsetHeight || 0;
                const calculated = headerHeight + contentHeight + 40;
                targetHeight = Math.min(calculated, settings?.widgetMaxHeight || 800);
            } else {
                targetHeight = settings?.widgetMaxHeight || 800;
            }

            if (settings?.widgetBounds) {
                bounds = settings.widgetBounds;
            }
        } else {
            if ((window as any).ipcRenderer) {
                const currentBounds = await (window as any).ipcRenderer.invoke('get-window-bounds');
                if (currentBounds && settings) {
                    await saveSettings({ ...settings, widgetBounds: currentBounds });
                }
            }
        }

        if ((window as any).ipcRenderer) {
            await (window as any).ipcRenderer.send('set-widget-mode', {
                mode: newState,
                height: targetHeight,
                locked: settings?.widgetPositionLocked,
                bounds: bounds
            });
        }

        if (!newState) {
            setTimeout(() => {
                setIsPinned(false);
                setWidgetMode(false);
            }, 50);
        }
    };

    return {
        isWidgetLocked,
        setIsWidgetLocked,
        isPinned,
        headerRef,
        editorContentRef,
        togglePin
    };
}
