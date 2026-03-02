import { useState } from 'react';
import { Todo, Session } from '@/types';
import { useDataStore } from './useDataStore';
import { format, addDays } from 'date-fns';

export function useClosingRitual() {
    const { settings } = useDataStore();

    const [isRitualOpen, setIsRitualOpen] = useState(false);
    const [lastSessionTodos, setLastSessionTodos] = useState<Todo[]>([]);
    const [lastSessionSessions, setLastSessionSessions] = useState<Session[]>([]);
    const [lastSessionScreenshots, setLastSessionScreenshots] = useState<string[]>([]);
    const [lastSessionPlannedSessions, setLastSessionPlannedSessions] = useState<any[]>([]); // PlannedSession type inferred or any
    const [lastSessionFirstOpenedAt, setLastSessionFirstOpenedAt] = useState<number | undefined>(undefined);
    const [currentStats, setCurrentStats] = useState({ totalSeconds: 0, questAchieved: false, screenshotCount: 0 });

    const handleOpenRitual = async (todos: Todo[] = [], screenshots: string[] = [], sessions: Session[] = [], plannedSessions: any[] = [], firstOpenedAt?: number) => {
        setLastSessionTodos(todos);
        setLastSessionSessions(sessions);
        setLastSessionScreenshots(screenshots);
        setLastSessionPlannedSessions(plannedSessions);
        setLastSessionFirstOpenedAt(firstOpenedAt);

        // Fetch today's stats from IPC or store
        if ((window as any).ipcRenderer) {
            const now = new Date();
            const yearMonth = format(now, 'yyyy-MM');
            const dateStr = format(now, 'yyyy-MM-dd');
            const logs = await (window as any).ipcRenderer.getMonthlyLog(yearMonth);
            const todayLog = logs[dateStr];

            if (todayLog) {
                // Calculate total seconds from sessions
                const totalSeconds = todayLog.sessions ? todayLog.sessions.reduce((acc: number, s: any) => acc + s.duration, 0) : 0;
                setCurrentStats({
                    totalSeconds,
                    questAchieved: todayLog.quest_cleared || false,
                    screenshotCount: todayLog.screenshots?.length || 0
                });
            }
        }
        setIsRitualOpen(true);
    };

    const handleSaveLog = async (plan: string) => {
        const now = new Date();
        const tomorrow = addDays(now, 1);
        const yearMonth = format(now, 'yyyy-MM');
        // Handle month boundary for tomorrow's log? 
        const tmrYearMonth = format(tomorrow, 'yyyy-MM');
        const dateStr = format(now, 'yyyy-MM-dd');
        const tmrDateStr = format(tomorrow, 'yyyy-MM-dd');

        // Parse Plan into Todos
        const newTodos: Todo[] = plan
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .map((text, i) => ({
                id: `${Date.now()}-${i}`,
                text: text.replace(/^- [ ] /, '').replace(/^- /, ''), // Remove markdown checkbox/bullet if present
                completed: false
            }));

        if ((window as any).ipcRenderer) {
            // 1. Save Today's Log (Closing Note, Quest Cleared)
            const logs = await (window as any).ipcRenderer.getMonthlyLog(yearMonth);
            if (!logs[dateStr]) logs[dateStr] = {};

            console.log("[App] Saving Log - Plan:", plan);
            console.log("[App] Saving Log - Logs Obj:", logs[dateStr]);

            logs[dateStr].closingNote = plan;
            logs[dateStr].todos = lastSessionTodos;
            logs[dateStr].quest_cleared = true;
            if (settings?.nightTimeStart !== undefined) {
                logs[dateStr].nightTimeStart = settings.nightTimeStart;
            }

            await (window as any).ipcRenderer.saveMonthlyLog({ yearMonth, data: logs });

            // 1.5 Sync to Notion (Manual Trigger)
            if (settings?.notionTokens?.accessToken && settings?.notionTokens?.databaseId) {
                const syncData = {
                    ...logs[dateStr],
                    closingNote: plan,
                    quest_cleared: true
                };
                // Log to Main Process for visibility
                (window as any).ipcRenderer.send('log-message', `[App] Triggering Sync. Plan len: ${plan?.length}`);

                console.log("[App] Triggering Sync. Plan length:", plan?.length);
                console.log("[App] Sync Payload Keys:", Object.keys(syncData));
                console.log("[App] Payload.closingNote:", syncData.closingNote);

                (window as any).ipcRenderer.invoke('manual-sync-notion', {
                    token: settings.notionTokens.accessToken,
                    databaseId: settings.notionTokens.databaseId,
                    dateStr,
                    data: syncData
                }).catch((e: any) => {
                    console.error("Notion sync trigger failed", e);
                    (window as any).ipcRenderer.send('log-message', `[App] Sync Failed: ${e.message}`);
                });
            } else {
                (window as any).ipcRenderer.send('log-message', `[App] Sync Skipped: Missing Token/DB. Token: ${!!settings?.notionTokens?.accessToken}, DB: ${!!settings?.notionTokens?.databaseId}`);
            }

            // 2. Save Tomorrow's Todos (Handle Month Boundary)
            if (yearMonth === tmrYearMonth) {
                if (!logs[tmrDateStr]) logs[tmrDateStr] = {};
                const existingTodos = logs[tmrDateStr].todos || [];
                logs[tmrDateStr].todos = [...existingTodos, ...newTodos];
                await (window as any).ipcRenderer.saveMonthlyLog({ yearMonth, data: logs });
            } else {
                // Different month
                const tmrLogs = await (window as any).ipcRenderer.getMonthlyLog(tmrYearMonth);
                if (!tmrLogs[tmrDateStr]) tmrLogs[tmrDateStr] = {};
                const existingTodos = tmrLogs[tmrDateStr].todos || [];
                tmrLogs[tmrDateStr].todos = [...existingTodos, ...newTodos];
                await (window as any).ipcRenderer.saveMonthlyLog({ yearMonth: tmrYearMonth, data: tmrLogs });
            }

            console.log("Day ended. Plan saved & parsed to tomorrow:", newTodos);
        }
        setIsRitualOpen(false);
    };

    return {
        isRitualOpen,
        setIsRitualOpen,
        lastSessionTodos,
        lastSessionSessions,
        lastSessionScreenshots,
        lastSessionPlannedSessions,
        lastSessionFirstOpenedAt,
        currentStats,
        handleOpenRitual,
        handleSaveLog
    };
}
