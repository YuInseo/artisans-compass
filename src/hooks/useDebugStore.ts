import { create } from 'zustand';

export interface LogEntry {
    id: string;
    timestamp: number;
    level: 'info' | 'warn' | 'error' | 'debug';
    source: 'frontend' | 'backend';
    message: string;
    data?: any[];
}

interface DebugStore {
    logs: LogEntry[];
    filter: 'all' | 'frontend' | 'backend';
    setFilter: (filter: 'all' | 'frontend' | 'backend') => void;
    addLog: (level: LogEntry['level'], message: string, source: LogEntry['source'], ...data: any[]) => void;
    clearLogs: () => void;
}

export const useDebugStore = create<DebugStore>((set) => ({
    logs: [],
    filter: 'all',
    setFilter: (filter) => set({ filter }),
    addLog: (level, message, source, ...data) => {
        const newLog: LogEntry = {
            id: Math.random().toString(36).substr(2, 9),
            timestamp: Date.now(),
            level,
            source,
            message,
            data: data.length > 0 ? data : undefined,
        };

        set((state) => ({
            logs: [newLog, ...state.logs].slice(0, 100) // Keep last 100 logs
        }));
    },
    clearLogs: () => set({ logs: [] }),
}));
