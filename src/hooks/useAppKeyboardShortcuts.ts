import { useEffect } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useDataStore } from './useDataStore';
import { useTodoStore } from './useTodoStore';
import { useWeeklyHistoryStore } from './useWeeklyHistoryStore';
import { useArtisansCompass } from '@/core/ArtisansCompassProvider';

export function useAppKeyboardShortcuts() {
    const { t } = useTranslation();
    const { undo: dataUndo, redo: dataRedo, lastActionTime: dataTime } = useDataStore();
    const { undo: todoUndo, redo: todoRedo, lastActionTime: todoTime } = useTodoStore();
    const { undo: weeklyUndo, redo: weeklyRedo, lastActionTime: weeklyTime } = useWeeklyHistoryStore();

    // Consume from the new Core SDK Provider
    const { undo: commandUndo, redo: commandRedo, lastActionTime: commandTime } = useArtisansCompass();

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Undo: Ctrl+Z
            if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ' && !e.shiftKey) {
                e.preventDefault();
                // Global Undo Coordination
                const maxTime = Math.max(dataTime, todoTime, weeklyTime, commandTime);
                if (maxTime === 0) return;

                if (maxTime === commandTime) {
                    toast.info(t('undo.general', `Undo`));
                    commandUndo();
                } else if (maxTime === weeklyTime) {
                    toast.info(t('undo.calendarAction', "Undo: Calendar Action"));
                    weeklyUndo();
                } else if (maxTime === todoTime) {
                    toast.info(t('undo.taskAction', "Undo: Task Action"));
                    todoUndo();
                } else {
                    toast.info(t('undo.projectAction', "Undo: Project Action"));
                    dataUndo();
                }
            }
            // Redo: Ctrl+Shift+Z or Ctrl+Y
            if ((e.ctrlKey || e.metaKey) && ((e.code === 'KeyZ' && e.shiftKey) || e.code === 'KeyY')) {
                e.preventDefault();
                // Global Redo Coordination
                const maxTime = Math.max(dataTime, todoTime, weeklyTime, commandTime);
                if (maxTime === 0) return;

                if (maxTime === commandTime) {
                    toast.info(t('redo.general', `Redo`));
                    commandRedo();
                } else if (maxTime === weeklyTime) {
                    toast.info(t('redo.calendarAction', "Redo: Calendar Action"));
                    weeklyRedo();
                } else if (maxTime === todoTime) {
                    toast.info(t('redo.taskAction', "Redo: Task Action"));
                    todoRedo();
                } else {
                    toast.info(t('redo.projectAction', "Redo: Project Action"));
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
    }, [dataUndo, dataRedo, todoUndo, todoRedo, weeklyUndo, weeklyRedo, commandUndo, commandRedo, dataTime, todoTime, weeklyTime, commandTime]);
}
