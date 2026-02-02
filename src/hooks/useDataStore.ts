import { create } from 'zustand';
import { useEffect } from 'react';
import { AppSettings, Project, DailyLog } from '@/types';
import { format } from 'date-fns';
import { useTodoStore } from './useTodoStore';

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

    searchQuery: string;
    setSearchQuery: (query: string) => void;
    // Undo/Redo State
    history: Project[][];
    future: Project[][];
    lastActionTime: number;
    undo: () => Promise<void>;
    redo: () => Promise<void>;
    addToHistory: () => void;
}

const useStore = create<DataStore>((set, get) => ({
    settings: null,
    projects: [],
    dailyLog: null,
    loading: true,
    initialized: false,

    history: [],
    future: [],
    lastActionTime: 0,

    isWidgetMode: false,
    setWidgetMode: (mode) => set({ isWidgetMode: mode }),

    searchQuery: '',
    setSearchQuery: (query) => set({ searchQuery: query }),

    addToHistory: () => {
        const { projects, history } = get();
        // Limit history size to 50
        const newHistory = [...history, projects].slice(-50);
        set({ history: newHistory, future: [], lastActionTime: Date.now() });
    },

    undo: async () => {
        const { history, future, projects } = get();
        if (history.length === 0) return;

        const previous = history[history.length - 1];
        const newHistory = history.slice(0, -1);

        set({ projects: previous, history: newHistory, future: [...future, projects], lastActionTime: Date.now() });

        // Persist the undone state
        if ((window as any).ipcRenderer) {
            await (window as any).ipcRenderer.saveProjects(previous);
        }
    },

    redo: async () => {
        const { history, future, projects } = get();
        if (future.length === 0) return;

        const next = future[future.length - 1];
        const newFuture = future.slice(0, -1);

        set({ projects: next, history: [...history, projects], future: newFuture, lastActionTime: Date.now() });

        // Persist the redone state
        if ((window as any).ipcRenderer) {
            await (window as any).ipcRenderer.saveProjects(next);
        }
    },

    loadData: async () => {
        if (get().initialized) return;
        try {
            const ipc = (window as any).ipcRenderer;
            if (ipc) {
                const DEFAULT_SETTINGS: Partial<AppSettings> = {
                    projectTags: ["Main", "Sub", "Practice"],
                    typeColors: {
                        "Main": "#3b82f6",
                        "Sub": "#22c55e",
                        "Practice": "#eab308"
                    },
                    enableCustomProjectColors: false,
                    showIndentationGuides: true,
                    customThemes: [],
                    workApps: [],
                    filterTimelineByWorkApps: false,
                    nightTimeStart: 22
                };

                const [settings, projects] = await Promise.all([
                    ipc.getSettings(),
                    ipc.getProjects()
                ]);

                // Merge defaults
                const mergedSettings = { ...DEFAULT_SETTINGS, ...settings };
                // Ensure deep merge for typeColors if it exists but is partial (though usually it's all or nothing if we save whole object)
                if (settings?.typeColors) {
                    mergedSettings.typeColors = { ...DEFAULT_SETTINGS.typeColors, ...settings.typeColors };
                }

                set({ settings: mergedSettings as AppSettings, projects, loading: false, initialized: true });

                // Load todos from daily log
                await useTodoStore.getState().loadTodos();
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
        return await (window as any).ipcRenderer.invoke('get-daily-log', dateStr);
    },
}));

export function useDataStore() {
    const store = useStore();

    useEffect(() => {
        store.loadData();
    }, []);

    return store;
}
