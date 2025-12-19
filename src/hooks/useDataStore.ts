import { create } from 'zustand';
import { useEffect } from 'react';
import { AppSettings, Project, DailyLog } from '@/types';
import { format } from 'date-fns';

interface DataStore {
    settings: AppSettings | null;
    projects: Project[];
    dailyLog: DailyLog | null;
    loading: boolean;
    initialized: boolean;

    loadData: () => Promise<void>;
    saveProjects: (projects: Project[]) => Promise<void>;
    saveSettings: (settings: AppSettings) => Promise<void>;
    loadDailyLog: (date: Date) => Promise<DailyLog | null>;
    getDailyLog: (dateStr: string) => Promise<any>;
    isWidgetMode: boolean;
    setWidgetMode: (isWidgetMode: boolean) => void;
}

const useStore = create<DataStore>((set, get) => ({
    settings: null,
    projects: [],
    dailyLog: null,
    loading: true,
    initialized: false,

    isWidgetMode: false,
    setWidgetMode: (mode) => set({ isWidgetMode: mode }),

    loadData: async () => {
        if (get().initialized) return;
        try {
            const ipc = (window as any).ipcRenderer;
            if (ipc) {
                const [settings, projects] = await Promise.all([
                    ipc.getSettings(),
                    ipc.getProjects()
                ]);
                set({ settings, projects, loading: false, initialized: true });
            } else {
                console.warn("IPC not available");
                set({ loading: false }); // Stop loading even if no IPC
            }
        } catch (err) {
            console.error("Failed to load data", err);
            set({ loading: false });
        }
    },

    saveProjects: async (newProjects: Project[]) => {
        set({ projects: newProjects });
        if ((window as any).ipcRenderer) {
            await (window as any).ipcRenderer.saveProjects(newProjects);
        }
    },

    saveSettings: async (newSettings: AppSettings) => {
        set({ settings: newSettings });
        const ipc = (window as any).ipcRenderer;
        if (ipc) {
            await ipc.saveSettings(newSettings);
            // Notify tracker to reload settings immediately (e.g. update screenshot timer)
            if (ipc.invoke) {
                await ipc.invoke('reload-settings');
            }
        }
    },

    loadDailyLog: async (date: Date) => {
        if (!(window as any).ipcRenderer) return null;
        const yearMonth = format(date, 'yyyy-MM');
        return await (window as any).ipcRenderer.getMonthlyLog(yearMonth);
    },

    getDailyLog: async (dateStr: string) => {
        if (!(window as any).ipcRenderer) return null;
        const date = new Date(dateStr);
        const yearMonth = format(date, 'yyyy-MM');
        const monthlyData = await (window as any).ipcRenderer.getMonthlyLog(yearMonth);
        return monthlyData?.[dateStr] || null;
    },
}));

export function useDataStore() {
    const store = useStore();

    useEffect(() => {
        store.loadData();
    }, []);

    return store;
}
