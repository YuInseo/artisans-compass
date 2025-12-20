import { create } from 'zustand';
import { Project } from '@/types';

interface SelectionBox {
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
}

interface TimelineStore {
    // Selection State
    selectedIds: Set<string>;
    selectionBox: SelectionBox | null;
    isDeleting: boolean;

    // Actions
    setSelectedIds: (ids: Set<string>) => void;
    toggleSelection: (id: string) => void;
    clearSelection: () => void;
    selectSingle: (id: string) => void;

    setSelectionBox: (box: SelectionBox | null) => void;
    updateSelectionBox: (currentX: number, currentY: number) => void;

    // Delete Actions
    deleteSelected: (projects: Project[], saveProjects: (p: Project[]) => Promise<void>, idsToDelete?: Set<string>) => Promise<void>;
}

export const useTimelineStore = create<TimelineStore>((set, get) => ({
    // Initial State
    selectedIds: new Set<string>(),
    selectionBox: null,
    isDeleting: false,

    // Selection Actions
    setSelectedIds: (ids) => set({ selectedIds: ids }),

    toggleSelection: (id) => {
        const newSet = new Set(get().selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        set({ selectedIds: newSet });
    },

    clearSelection: () => set({ selectedIds: new Set() }),

    selectSingle: (id) => set({ selectedIds: new Set([id]) }),

    // Selection Box Actions
    setSelectionBox: (box) => set({ selectionBox: box }),

    updateSelectionBox: (currentX, currentY) => {
        const prev = get().selectionBox;
        if (prev) {
            set({ selectionBox: { ...prev, currentX, currentY } });
        }
    },

    // Delete Actions
    deleteSelected: async (projects, saveProjects, idsToDelete) => {
        // Use passed IDs or fall back to current selection
        // We defer to passed IDs because local selection state might have cleared if user clicked outside
        const targetIds = idsToDelete || get().selectedIds;
        if (targetIds.size === 0) return;

        set({ isDeleting: true });

        try {
            const updated = projects.filter(p => !targetIds.has(p.id));
            set({ selectedIds: new Set() });
            await saveProjects(updated);
        } finally {
            // Reset deleting state after a short delay to prevent ghost menu
            setTimeout(() => set({ isDeleting: false }), 100);
        }
    },
}));
