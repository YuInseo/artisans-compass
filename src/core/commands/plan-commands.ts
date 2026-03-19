import { BaseCommand } from '../Command';
import { PlannedSession } from '@/types';
import { useDataStoreInternal } from '@/hooks/useDataStore';
import { format, isSameDay } from 'date-fns';
import { PlanSavePayload, PlanDeletePayload } from '../../plugins/api';

export class SavePlanCommand extends BaseCommand<PlanSavePayload> {
    id = 'cmd.savePlan';
    name = 'Save Plan';

    async execute(payload: PlanSavePayload) {
        if (!(window as any).ipcRenderer) return;
        const ipc = (window as any).ipcRenderer;

        const { session, originalStart } = payload;
        if (!session.start || !session.title) return;

        const newStart = new Date(session.start);
        const newDateKey = format(newStart, 'yyyy-MM-dd');
        const newMonthKey = format(newStart, 'yyyy-MM');

        let oldDateKey: string | null = null;
        let oldMonthKey: string | null = null;

        // Since we are decoupling from the local state array, we trust originalStart
        const actualOriginalStart = originalStart;

        if (actualOriginalStart && !isSameDay(actualOriginalStart, newStart)) {
            const oldStart = new Date(actualOriginalStart);
            oldDateKey = format(oldStart, 'yyyy-MM-dd');
            oldMonthKey = format(oldStart, 'yyyy-MM');
        }

        const newSession = {
            id: session.id || crypto.randomUUID(),
            start: session.start,
            duration: session.duration || 3600,
            title: session.title,
            description: session.description,
            color: session.color,
            location: session.location,
            alert: session.alert,
            priority: session.priority,
            isCompleted: session.isCompleted || false
        } as PlannedSession;

        // Fetch old state to store in memory for undo
        let oldSessionDeepCopy: PlannedSession | null = null;
        if (session.id && actualOriginalStart) {
            const oldStartFallback = new Date(actualOriginalStart);
            const fallbackMonth = format(oldStartFallback, 'yyyy-MM');
            const fallbackDate = format(oldStartFallback, 'yyyy-MM-dd');
            const logs = await ipc.getMonthlyLog(fallbackMonth);
            if (logs[fallbackDate] && logs[fallbackDate].plannedSessions) {
                const found = logs[fallbackDate].plannedSessions.find((p: PlannedSession) => p.id === session.id);
                if (found) oldSessionDeepCopy = JSON.parse(JSON.stringify(found));
            }
        }

        // Apply new changes directly via IPC
        if (oldMonthKey === newMonthKey || !oldMonthKey) {
            const logs = await ipc.getMonthlyLog(newMonthKey);

            if (oldDateKey && logs[oldDateKey] && logs[oldDateKey].plannedSessions) {
                logs[oldDateKey].plannedSessions = logs[oldDateKey].plannedSessions.filter((p: PlannedSession) => p.id !== session.id);
            }

            if (!logs[newDateKey]) {
                logs[newDateKey] = { date: newDateKey, sessions: [], todos: [], stats: { totalWorkSeconds: 0, questAchieved: false }, assets: [], isRestDay: false };
            }
            const log = logs[newDateKey];
            const planned = log.plannedSessions || [];

            if (oldDateKey && oldDateKey !== newDateKey) {
                log.plannedSessions = [...planned, newSession];
            } else {
                if (session.id && planned.some((p: PlannedSession) => p.id === session.id)) {
                    log.plannedSessions = planned.map((p: PlannedSession) => p.id === session.id ? newSession : p);
                } else {
                    log.plannedSessions = [...planned, newSession];
                }
            }

            await ipc.saveMonthlyLog({ yearMonth: newMonthKey, data: logs });
        } else {
            if (oldMonthKey && oldDateKey) {
                const oldLogs = await ipc.getMonthlyLog(oldMonthKey);
                if (oldLogs && oldLogs[oldDateKey] && oldLogs[oldDateKey].plannedSessions) {
                    oldLogs[oldDateKey].plannedSessions = oldLogs[oldDateKey].plannedSessions.filter((p: PlannedSession) => p.id !== session.id);
                    await ipc.saveMonthlyLog({ yearMonth: oldMonthKey, data: oldLogs });
                }
            }

            const newLogs = await ipc.getMonthlyLog(newMonthKey);
            if (!newLogs[newDateKey]) {
                newLogs[newDateKey] = { date: newDateKey, sessions: [], todos: [], stats: { totalWorkSeconds: 0, questAchieved: false }, assets: [], isRestDay: false };
            }
            const log = newLogs[newDateKey];
            const planned = log.plannedSessions || [];

            log.plannedSessions = [...planned, newSession];
            await ipc.saveMonthlyLog({ yearMonth: newMonthKey, data: newLogs });
        }

        // Trigger react refresh
        useDataStoreInternal.getState().loadData(); // This is just a cheap flush

        return {
            undo: async () => {
                if (oldSessionDeepCopy && actualOriginalStart) {
                    // It was an edit, restore the old session.
                    await new SavePlanCommand().execute({ session: oldSessionDeepCopy, originalStart: newStart.getTime() });
                } else {
                    // It was a creation, so delete it.
                    await new DeletePlanCommand().execute({ id: newSession.id, dateKey: newDateKey });
                }
            },
            redo: async () => {
                await new SavePlanCommand().execute({ session: newSession, originalStart: actualOriginalStart });
            }
        };
    }
}

export class DeletePlanCommand extends BaseCommand<PlanDeletePayload> {
    id = 'cmd.deletePlan';
    name = 'Delete Plan';

    async execute(payload: PlanDeletePayload) {
        if (!(window as any).ipcRenderer) return;
        const ipc = (window as any).ipcRenderer;

        const { id, dateKey } = payload;
        const yearMonth = dateKey.substring(0, 7);

        const logs = await ipc.getMonthlyLog(yearMonth);
        let oldSessionDeepCopy: PlannedSession | null = null;

        if (logs[dateKey] && logs[dateKey].plannedSessions) {
            const found = logs[dateKey].plannedSessions.find((p: PlannedSession) => p.id === id);
            if (found) {
                oldSessionDeepCopy = JSON.parse(JSON.stringify(found));
            }

            logs[dateKey].plannedSessions = logs[dateKey].plannedSessions.filter((p: PlannedSession) => p.id !== id);
            await ipc.saveMonthlyLog({ yearMonth, data: logs });
            useDataStoreInternal.getState().loadData();

            if (oldSessionDeepCopy) {
                return {
                    undo: async () => {
                        await new SavePlanCommand().execute({ session: oldSessionDeepCopy! });
                    },
                    redo: async () => {
                        await new DeletePlanCommand().execute({ id, dateKey });
                    }
                };
            }
        }
    }
}
