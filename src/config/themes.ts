
export interface ThemeColors {
    background: string;
    foreground: string;
    card: string;
    cardForeground: string;
    popover: string;
    popoverForeground: string;
    primary: string;
    primaryForeground: string;
    secondary: string;
    secondaryForeground: string;
    muted: string;
    mutedForeground: string;
    accent: string;
    accentForeground: string;
    destructive: string;
    destructiveForeground: string;
    border: string;
    input: string;
    ring: string;
}

export interface Theme {
    name: string;
    label: string;
    description?: string;
    colors: ThemeColors;
}

export const themes: Record<string, Theme> = {
    light: {
        name: 'light',
        label: 'Light',
        colors: {
            background: '0 0% 100%',
            foreground: '222.2 84% 4.9%',
            card: '0 0% 100%',
            cardForeground: '222.2 84% 4.9%',
            popover: '0 0% 100%',
            popoverForeground: '222.2 84% 4.9%',
            primary: '222.2 47.4% 11.2%',
            primaryForeground: '210 40% 98%',
            secondary: '210 40% 96.1%',
            secondaryForeground: '222.2 47.4% 11.2%',
            muted: '210 40% 96.1%',
            mutedForeground: '215.4 16.3% 46.9%',
            accent: '210 40% 96.1%',
            accentForeground: '222.2 47.4% 11.2%',
            destructive: '0 84.2% 60.2%',
            destructiveForeground: '210 40% 98%',
            border: '214.3 31.8% 91.4%',
            input: '214.3 31.8% 91.4%',
            ring: '222.2 84% 4.9%',
        }
    },
    dark: {
        name: 'dark',
        label: 'Dark',
        colors: {
            background: '223 7% 21%',
            foreground: '210 9% 87%',
            card: '220 7% 18%',
            cardForeground: '210 9% 87%',
            popover: '220 7% 18%',
            popoverForeground: '210 9% 87%',
            primary: '235 86% 65%',
            primaryForeground: '210 40% 98%',
            secondary: '223 7% 21%',
            secondaryForeground: '210 9% 87%',
            muted: '225 6% 13%',
            mutedForeground: '214 8% 61%',
            accent: '225 6% 26%',
            accentForeground: '210 9% 87%',
            destructive: '0 62.8% 30.6%',
            destructiveForeground: '210 9% 87%',
            border: '225 6% 13%',
            input: '225 6% 13%',
            ring: '235 86% 65%',
        }
    },
    midnight: {
        name: 'midnight',
        label: 'Midnight',
        colors: {
            background: '0 0% 0%',
            foreground: '210 20% 98%',
            card: '0 0% 3%',
            cardForeground: '210 20% 98%',
            popover: '0 0% 3%',
            popoverForeground: '210 20% 98%',
            primary: '210 100% 50%',
            primaryForeground: '0 0% 100%',
            secondary: '0 0% 10%',
            secondaryForeground: '210 20% 98%',
            muted: '0 0% 7%',
            mutedForeground: '215 20% 65%',
            accent: '0 0% 15%',
            accentForeground: '210 20% 98%',
            destructive: '0 62.8% 30.6%',
            destructiveForeground: '210 20% 98%',
            border: '0 0% 12%',
            input: '0 0% 12%',
            ring: '210 100% 50%',
        }
    },
    sunset: {
        name: 'sunset',
        label: 'Sunset',
        colors: {
            background: '20 14% 10%',
            foreground: '20 10% 90%',
            card: '20 14% 12%',
            cardForeground: '20 10% 90%',
            popover: '20 14% 12%',
            popoverForeground: '20 10% 90%',
            primary: '15 85% 65%',
            primaryForeground: '210 40% 98%',
            secondary: '20 14% 15%',
            secondaryForeground: '20 10% 90%',
            muted: '20 10% 18%',
            mutedForeground: '20 5% 65%',
            accent: '20 10% 25%',
            accentForeground: '20 10% 90%',
            destructive: '0 62.8% 30.6%',
            destructiveForeground: '210 9% 87%',
            border: '20 10% 18%',
            input: '20 10% 18%',
            ring: '15 85% 65%',
        }
    },
    ocean: {
        name: 'ocean',
        label: 'Ocean',
        colors: {
            background: '220 30% 12%',
            foreground: '210 20% 90%',
            card: '220 30% 15%',
            cardForeground: '210 20% 90%',
            popover: '220 30% 15%',
            popoverForeground: '210 20% 90%',
            primary: '190 90% 50%',
            primaryForeground: '220 30% 10%',
            secondary: '220 30% 20%',
            secondaryForeground: '210 20% 90%',
            muted: '220 20% 25%',
            mutedForeground: '210 15% 70%',
            accent: '220 20% 30%',
            accentForeground: '210 20% 90%',
            destructive: '0 62.8% 30.6%',
            destructiveForeground: '210 9% 87%',
            border: '220 20% 25%',
            input: '220 20% 25%',
            ring: '190 90% 50%',
        }
    },
    forest: {
        name: 'forest',
        label: 'Forest',
        colors: {
            background: '150 10% 10%',
            foreground: '150 10% 90%',
            card: '150 10% 13%',
            cardForeground: '150 10% 90%',
            popover: '150 10% 13%',
            popoverForeground: '150 10% 90%',
            primary: '142 70% 50%',
            primaryForeground: '150 10% 5%',
            secondary: '150 10% 18%',
            secondaryForeground: '150 10% 90%',
            muted: '150 8% 20%',
            mutedForeground: '150 5% 65%',
            accent: '150 8% 25%',
            accentForeground: '150 10% 90%',
            destructive: '0 62.8% 30.6%',
            destructiveForeground: '210 9% 87%',
            border: '150 8% 20%',
            input: '150 8% 20%',
            ring: '142 70% 50%',
        }
    },
    default: {
        name: 'default',
        label: 'Default',
        colors: {
            background: '222.2 84% 4.9%',
            foreground: '210 40% 98%',
            card: '222.2 84% 4.9%',
            cardForeground: '210 40% 98%',
            popover: '222.2 84% 4.9%',
            popoverForeground: '210 40% 98%',
            primary: '221.2 83.2% 53.3%', // Vibrant Blue (e.g., #3b82f6)
            primaryForeground: '210 40% 98%',
            secondary: '217.2 32.6% 17.5%',
            secondaryForeground: '210 40% 98%',
            muted: '217.2 32.6% 17.5%',
            mutedForeground: '215 20.2% 65.1%',
            accent: '217.2 32.6% 17.5%',
            accentForeground: '210 40% 98%',
            destructive: '0 62.8% 30.6%',
            destructiveForeground: '210 40% 98%',
            border: '217.2 32.6% 17.5%',
            input: '217.2 32.6% 17.5%',
            ring: '221.2 83.2% 53.3%',
        }
    },
    discord: {
        name: 'discord',
        label: 'Discord',
        colors: {
            background: '223 7% 21%',
            foreground: '210 9% 87%',
            card: '220 7% 18%',
            cardForeground: '210 9% 87%',
            popover: '220 7% 18%',
            popoverForeground: '210 9% 87%',
            primary: '235 86% 65%',
            primaryForeground: '210 40% 98%',
            secondary: '223 7% 21%',
            secondaryForeground: '210 9% 87%',
            muted: '225 6% 13%',
            mutedForeground: '214 8% 61%',
            accent: '225 6% 26%',
            accentForeground: '210 9% 87%',
            destructive: '0 62.8% 30.6%',
            destructiveForeground: '210 9% 87%',
            border: '225 6% 13%',
            input: '225 6% 13%',
            ring: '235 86% 65%',
        }
    }
};
