/// <reference types="vite/client" />

export { };

declare global {
    interface Window {
        ipcRenderer: {
            on(channel: string, listener: (event: any, ...args: any[]) => void): void;
            off(channel: string, ...args: any[]): void;
            send(channel: string, ...args: any[]): void;
            invoke(channel: string, ...args: any[]): Promise<any>;

            // Specific APIs
            getSettings: () => Promise<any>;
            saveSettings: (settings: any) => Promise<boolean>;
            getProjects: () => Promise<any[]>;
            saveProjects: (projects: any[]) => Promise<boolean>;
            getMonthlyLog: (yearMonth: string) => Promise<any>;
            saveMonthlyLog: (yearMonth: string, data: any) => Promise<boolean>;
            getUserDataPath: () => Promise<string>;

            onTrackingUpdate: (callback: (state: any) => void) => () => void;
        }
    }
}
