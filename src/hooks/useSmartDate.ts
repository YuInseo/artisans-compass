import { useEffect } from 'react';
import { format } from 'date-fns';
import { useTodoStore } from './useTodoStore';
import { useDataStore } from './useDataStore';

export function useSmartDate() {
    const { settings } = useDataStore();
    const { loadTodos } = useTodoStore();

    useEffect(() => {
        const checkDate = () => {
            const now = new Date();
            const currentDay = format(now, 'yyyy-MM-dd');
            const lastLoadedDay = sessionStorage.getItem('lastLoadedDate');

            if (lastLoadedDay && lastLoadedDay !== currentDay) {
                console.log(`[App] Date changed from ${lastLoadedDay} to ${currentDay}`);

                const mode = settings?.dailyRecordMode || 'fixed';

                if (mode === 'fixed') {
                    console.log('[App] Fixed Mode Active: Auto-reloading for new day.');
                    loadTodos();
                    sessionStorage.setItem('lastLoadedDate', currentDay);
                } else {
                    console.log('[App] Dynamic Mode Active: Preserving previous day state.');
                }
            } else {
                if (!lastLoadedDay) {
                    sessionStorage.setItem('lastLoadedDate', currentDay);
                }
            }
        };

        const interval = setInterval(checkDate, 60000);
        checkDate(); // Initial check

        return () => clearInterval(interval);
    }, [loadTodos, settings?.dailyRecordMode]);
}
