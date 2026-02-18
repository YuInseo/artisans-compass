import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useEffect } from 'react';
import { AppSettings, Project, DailyLog } from '@/types';
import { format } from 'date-fns';
import { useTodoStore } from './useTodoStore';

interface DataStore {
    settings: AppSettings | null;
    projects: Project[];
    dailyLog: DailyLog | null; // This seems unused or legacy?
    monthlyLogCache: Record<string, any>; // Cache key: yyyy-MM, Value: Record<dateStr, DailyLog>
    loading: boolean;
    initialized: boolean;

    loadData: () => Promise<void>;
    saveProjects: (projects: Project[]) => Promise<void>;
    saveSettings: (settings: AppSettings) => Promise<void>;
    previewSettings: (settings: Partial<AppSettings>) => void;
    loadDailyLog: (date: Date) => Promise<any | null>;
    getDailyLog: (dateStr: string) => Promise<any>;
    updateDailyLogCache: (dateStr: string, log: any) => void;

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

const useStore = create<DataStore>()(
    persist(
        (set, get) => ({
            settings: null,
            projects: [],
            dailyLog: null,
            monthlyLogCache: {},
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
                            ignoredApps: [],
                            ignoredAppsColor: '#808080', // Default gray
                            filterTimelineByWorkApps: false,
                            nightTimeStart: 22
                        };

                        // Check if we already have settings in state (from persist)
                        // But we should probably fetch fresh data from disk on startup to ensure sync?
                        // Actually, persist middleware loads from localStorage.
                        // If we have persisted data, we might not need to fetch, BUT
                        // file system defines truth. So we should fetch and update store.
                        // However, to avoid "Loading...", we can rely on initialized=true if persisted?

                        const [settings, projects] = await Promise.all([
                            ipc.getSettings(),
                            ipc.getProjects()
                        ]);

                        // Merge defaults
                        const mergedSettings = { ...DEFAULT_SETTINGS, ...settings };
                        if (settings?.typeColors) {
                            mergedSettings.typeColors = { ...DEFAULT_SETTINGS.typeColors, ...settings.typeColors };
                        }

                        set({ settings: mergedSettings as AppSettings, projects, loading: false, initialized: true });

                        // Load todos from daily log
                        await useTodoStore.getState().loadTodos();
                    } else {
                        console.warn("IPC not available");
                        set({ loading: false });
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
                    if (ipc.invoke) {
                        await ipc.invoke('reload-settings');
                    }
                }
            },

            previewSettings: (partialSettings: Partial<AppSettings>) => {
                const current = get().settings;
                if (current) {
                    set({ settings: { ...current, ...partialSettings } });
                }
            },

            loadDailyLog: async (date: Date) => {
                if (!(window as any).ipcRenderer) return null;
                const yearMonth = format(date, 'yyyy-MM');
                const cache = get().monthlyLogCache;

                // Return from cache if exists
                if (cache[yearMonth]) {
                    // Update cache in background
                    (window as any).ipcRenderer.getMonthlyLog(yearMonth).then((logs: any) => {
                        set((state) => ({
                            monthlyLogCache: { ...state.monthlyLogCache, [yearMonth]: logs }
                        }));
                    });
                    return cache[yearMonth];
                }

                // Fetch if not in cache
                const logs = await (window as any).ipcRenderer.getMonthlyLog(yearMonth);
                set((state) => ({
                    monthlyLogCache: { ...state.monthlyLogCache, [yearMonth]: logs }
                }));
                return logs;
            },

            getDailyLog: async (dateStr: string) => {
                // Try to find in monthly cache first
                // dateStr is usually YYYY-MM-DD
                const yearMonth = dateStr.substring(0, 7);
                const cache = get().monthlyLogCache;
                if (cache[yearMonth] && cache[yearMonth][dateStr]) {
                    return cache[yearMonth][dateStr];
                }

                if (!(window as any).ipcRenderer) return null;
                return await (window as any).ipcRenderer.invoke('get-daily-log', dateStr);
            },

            updateDailyLogCache: (dateStr: string, log: any) => {
                const yearMonth = dateStr.substring(0, 7);
                set((state) => {
                    const monthCache = state.monthlyLogCache[yearMonth] || {};
                    return {
                        monthlyLogCache: {
                            ...state.monthlyLogCache,
                            [yearMonth]: { ...monthCache, [dateStr]: log }
                        }
                    };
                });
            }
        }),
        {
            name: 'artisans-compass-storage', // unique name
            partialize: (state) => ({
                settings: state.settings,
                projects: state.projects,
                monthlyLogCache: state.monthlyLogCache
                // Don't persist history/future/loading
            }),
        }
    )
);

export function useDataStore() {
    const store = useStore();

    useEffect(() => {
        store.loadData();
    }, []);

    return store;
}
