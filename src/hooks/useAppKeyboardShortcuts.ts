import { useEffect } from 'react';
import { toast } from 'sonner';
import { useDataStore } from './useDataStore';
import { useTodoStore } from './useTodoStore';

export function useAppKeyboardShortcuts() {
    const { undo: dataUndo, redo: dataRedo, lastActionTime: dataTime } = useDataStore();
    const { undo: todoUndo, redo: todoRedo, lastActionTime: todoTime } = useTodoStore();

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Undo: Ctrl+Z
            if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ' && !e.shiftKey) {
                e.preventDefault();
                // Global Undo Coordination
                if (todoTime > dataTime) {
                    toast.info("Undo: Task Action");
                    todoUndo();
                } else {
                    toast.info("Undo: Project Action");
                    dataUndo();
                }
            }
            // Redo: Ctrl+Shift+Z or Ctrl+Y
            if ((e.ctrlKey || e.metaKey) && ((e.code === 'KeyZ' && e.shiftKey) || e.code === 'KeyY')) {
                e.preventDefault();
                // Global Redo Coordination
                if (todoTime > dataTime) {
                    toast.info("Redo: Task Action");
                    todoRedo();
                } else {
                    toast.info("Redo: Project Action");
                    dataRedo();
                }
            }

            // Prevent Refresh (Ctrl+R, F5)
            if ((e.ctrlKey || e.metaKey) && e.code === 'KeyR') {
                e.preventDefault();
            }
            if (e.code === 'F5') {
                e.preventDefault();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [dataUndo, dataRedo, todoUndo, todoRedo, dataTime, todoTime]);
}
