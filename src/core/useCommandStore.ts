import { create } from 'zustand';
import { CommandResult } from './Command';

export interface CommandHistoryAction extends CommandResult {
    description: string;
}

export interface ICommandStore {
    history: CommandHistoryAction[];
    future: CommandHistoryAction[];
    lastActionTime: number;

    pushAction: (action: CommandHistoryAction) => void;
    undo: () => Promise<void>;
    redo: () => Promise<void>;
}

export const useCommandStoreInternal = create<ICommandStore>((set, get) => ({
    history: [],
    future: [],
    lastActionTime: 0,

    pushAction: (action) => {
        set((state) => {
            const newHistory = [...state.history, action];
            // Limit history to 50 items to prevent memory issues
            if (newHistory.length > 50) newHistory.shift();
            return {
                history: newHistory,
                future: [], // Clear future on new action
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
                future: [action, ...future],
                lastActionTime: Date.now()
            });
        } catch (error) {
            console.error("Failed to undo command action:", error);
        }
    },

    redo: async () => {
        const { history, future } = get();
        if (future.length === 0) return;

        const action = future[0];
        const newFuture = future.slice(1);

        try {
            await action.redo();
            set({
                history: [...history, action],
                future: newFuture,
                lastActionTime: Date.now()
            });
        } catch (error) {
            console.error("Failed to redo command action:", error);
        }
    }
}));

export function useCommandStore(): ICommandStore;
export function useCommandStore<T>(selector: (state: ICommandStore) => T): T;
export function useCommandStore<T>(selector?: (state: ICommandStore) => T) {
    return useCommandStoreInternal(selector as any);
}
