import { PlannedSession } from '@/types';
import { format } from 'date-fns';

export function useWeeklyBulkActions({
    viewMode,
    settings,
    saveSettings,
    selectedSessionIds,
    setSelectedSessionIds,
    effectivePlanned,
    handleSavePlan,
    loadData
}: {
    viewMode: 'calendar' | 'routine';
    settings: any;
    saveSettings: (settings: any) => Promise<void>;
    selectedSessionIds: Set<string>;
    setSelectedSessionIds: (ids: Set<string>) => void;
    effectivePlanned: PlannedSession[];
    handleSavePlan: (session: Partial<PlannedSession>, originalStart?: number) => Promise<void>;
    loadData: () => Promise<void>;
}) {
    const handleBulkDelete = async () => {
        if (selectedSessionIds.size === 0) return;

        if (viewMode === 'routine') {
            if (!settings) return;
            const updatedRoutine = (settings.weeklyRoutine || []).filter((r: any) => !selectedSessionIds.has(r.id));
            await saveSettings({ ...settings, weeklyRoutine: updatedRoutine });
            setSelectedSessionIds(new Set());
            return;
        }

        const sessionsToDelete = effectivePlanned.filter(s => selectedSessionIds.has(s.id));
        const updatesByMonth = new Map<string, Set<string>>();

        sessionsToDelete.forEach(s => {
            const date = new Date(s.start);
            const key = format(date, 'yyyy-MM');
            if (!updatesByMonth.has(key)) {
                updatesByMonth.set(key, new Set());
            }
            updatesByMonth.get(key)!.add(s.id);
        });

        if ((window as any).ipcRenderer) {
            for (const [yearMonth, ids] of updatesByMonth) {
                const logs = await (window as any).ipcRenderer.getMonthlyLog(yearMonth);
                let changed = false;

                Object.keys(logs).forEach(dateKey => {
                    const log = logs[dateKey];
                    if (log.plannedSessions) {
                        const originalLen = log.plannedSessions.length;
                        log.plannedSessions = log.plannedSessions.filter((p: PlannedSession) => !ids.has(p.id));
                        if (log.plannedSessions.length !== originalLen) {
                            changed = true;
                        }
                    }
                });

                if (changed) {
                    await (window as any).ipcRenderer.saveMonthlyLog({ yearMonth, data: logs });
                }
            }
            loadData();
        }

        setSelectedSessionIds(new Set());
    };

    const handleBulkPriority = async (priority: 'high' | 'medium' | 'low' | undefined) => {
        if (selectedSessionIds.size === 0) return;

        const updates = effectivePlanned
            .filter(s => selectedSessionIds.has(s.id))
            .map(s => ({ ...s, priority }));

        for (const session of updates) {
            await handleSavePlan(session);
        }
    };

    const handleBulkDateChange = async (newDate: Date | undefined) => {
        if (!newDate || selectedSessionIds.size === 0) return;

        const sessionsToMove = effectivePlanned
            .filter(s => selectedSessionIds.has(s.id))
            .map(s => {
                const start = new Date(s.start);
                const target = new Date(newDate);
                target.setHours(start.getHours(), start.getMinutes(), start.getSeconds(), start.getMilliseconds());
                return { updated: { ...s, start: target.getTime() }, originalStart: s.start };
            });

        for (const { updated, originalStart } of sessionsToMove) {
            await handleSavePlan(updated, originalStart);
        }
        setSelectedSessionIds(new Set());
    };

    return {
        handleBulkDelete,
        handleBulkPriority,
        handleBulkDateChange
    };
}
