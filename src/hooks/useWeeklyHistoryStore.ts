import { create } from 'zustand';

export interface WeeklyHistoryAction {
    description: string;
    undo: () => Promise<void>;
    redo: () => Promise<void>;
}

interface WeeklyHistoryStore {
    history: WeeklyHistoryAction[];
    future: WeeklyHistoryAction[];
    lastActionTime: number;

    pushAction: (action: WeeklyHistoryAction) => void;
    undo: () => Promise<void>;
    redo: () => Promise<void>;
}

const MAX_HISTORY = 50;

export const useWeeklyHistoryStore = create<WeeklyHistoryStore>((set, get) => ({
    history: [],
    future: [],
    lastActionTime: 0,

    pushAction: (action: WeeklyHistoryAction) => {
        set((state) => {
            const newHistory = [...state.history, action].slice(-MAX_HISTORY);
            return {
                history: newHistory,
                future: [],
                lastActionTime: Date.now()
            };
        });
    },

    undo: async () => {
        const { history, future } = get();
        if (history.length === 0) return;

        const action = history[history.length - 1];
        const newHistory = history.slice(0, -1);

        try {
            await action.undo();
            set({
                history: newHistory,
                future: [...future, action],
                lastActionTime: Date.now()
            });
        } catch (error) {
            console.error("Failed to undo weekly action:", error);
        }
    },

    redo: async () => {
        const { history, future } = get();
        if (future.length === 0) return;

        const action = future[future.length - 1];
        const newFuture = future.slice(0, -1);

        try {
            await action.redo();
            set({
                history: [...history, action],
                future: newFuture,
                lastActionTime: Date.now()
            });
        } catch (error) {
            console.error("Failed to redo weekly action:", error);
        }
    }
}));
