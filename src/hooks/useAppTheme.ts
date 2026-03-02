import { useEffect } from 'react';
import { useDataStore } from './useDataStore';

export function useAppTheme() {
    const { settings } = useDataStore();

    // Apply Theme Preset
    useEffect(() => {
        const root = document.documentElement;
        // Remove all theme preset classes
        root.classList.remove('theme-discord', 'theme-midnight', 'theme-sunset', 'theme-ocean', 'theme-forest', 'theme-custom');

        // Add current preset if set and not default
        if (settings?.themePreset && settings.themePreset !== 'default') {
            root.classList.add(`theme-${settings.themePreset}`);
        }
    }, [settings?.themePreset]);

    // Apply Custom CSS
    useEffect(() => {
        const styleId = 'custom-user-css';
        let styleTag = document.getElementById(styleId);

        if (settings?.themePreset === 'custom' && settings?.customCSS) {
            if (!styleTag) {
                styleTag = document.createElement('style');
                styleTag.id = styleId;
                document.head.appendChild(styleTag);
            }
            styleTag.textContent = settings.customCSS;
        } else {
            if (styleTag) {
                styleTag.remove();
            }
        }
    }, [settings?.customCSS, settings?.themePreset]);
}
