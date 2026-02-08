import { useEffect, useRef } from 'react';
import { useDataStore } from './useDataStore';
import { useTodoStore } from './useTodoStore';
import { useTranslation } from 'react-i18next';

export function useNightTimeNotification() {
    const { settings } = useDataStore();
    const { projectTodos } = useTodoStore();
    const { t } = useTranslation();
    const lastCheckMinute = useRef<number | null>(null);

    // ... (existing useEffect for reset)

    useEffect(() => {
        if (!settings?.enableUnresolvedTodoNotifications || !settings?.nightTimeStart) return;

        const checkTime = () => {
            const now = new Date();
            const currentHour = now.getHours();
            const currentMinute = now.getMinutes();
            const totalCurrentHours = currentHour + (currentMinute / 60);

            // Avoid multiple checks in the same minute
            if (lastCheckMinute.current === currentMinute) return;
            lastCheckMinute.current = currentMinute;

            const nightStart = settings.nightTimeStart!;
            const diff = Math.abs(totalCurrentHours - nightStart);

            if (diff < 0.025) {
                const todayStr = now.toDateString();
                const lastNotified = localStorage.getItem('lastNightTimeNotification');

                if (lastNotified !== todayStr) {
                    // Count unresolved todos across ALL projects
                    const allTodos = Object.values(projectTodos).flat();

                    // Recursive function to count unresolved in a tree
                    const countUnresolved = (list: any[]): number => {
                        let count = 0;
                        for (const todo of list) {
                            if (!todo.completed) count++;
                            if (todo.children) count += countUnresolved(todo.children);
                        }
                        return count;
                    };

                    const unresolvedCount = countUnresolved(allTodos);

                    if (unresolvedCount > 0) {
                        try {
                            const title = t('notifications.unresolvedTodosTitle');
                            const body = t('notifications.unresolvedTodosBody', { count: unresolvedCount });

                            // ... (IPC call)
                            // @ts-ignore
                            if (window.ipcRenderer && window.ipcRenderer.showNotification) {
                                // @ts-ignore
                                window.ipcRenderer.showNotification({ title, body });
                            } else {
                                new Notification(title, { body, icon: '/appLOGO.png' });
                            }

                            localStorage.setItem('lastNightTimeNotification', todayStr);
                            console.log("[NightTimeNotification] Notification sent via IPC!");
                        } catch (e) {
                            console.error("Failed to send notification", e);
                        }
                    }
                }
            }
        };
        // ...


        // Check every 10 seconds (instead of 60s) for better responsiveness during testing
        const intervalId = setInterval(checkTime, 10000);

        // requestPermission if needed
        if (Notification.permission === 'default') {
            Notification.requestPermission();
        }

        // Run immediately on mount/update to catch if we opened app exactly at time
        checkTime();

        return () => clearInterval(intervalId);
    }, [settings?.enableUnresolvedTodoNotifications, settings?.nightTimeStart, projectTodos, t]);
}
