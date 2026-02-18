import { create } from 'zustand';

interface TimeStore {
    offset: number; // millisecond offset
    setTime: (date: Date) => void;
    resetTime: () => void;
    now: () => Date;
}

export const useTimeStore = create<TimeStore>((set, get) => ({
    offset: 0,
    setTime: (date: Date) => {
        const diff = date.getTime() - Date.now();
        set({ offset: diff });
    },
    resetTime: () => set({ offset: 0 }),
    now: () => new Date(Date.now() + get().offset)
}));
