import { BaseCommand } from '../Command';
import { useDataStoreInternal } from '@/hooks/useDataStore';
import { RoutineSession } from '@/types';
import { getDay } from 'date-fns';
import { RoutineSavePayload, RoutineDeletePayload } from '../../plugins/api';

export class SaveRoutineCommand extends BaseCommand<RoutineSavePayload> {
    id = 'cmd.saveRoutine';
    name = 'Save Routine';

    async execute(payload: RoutineSavePayload) {
        const { session, originalStart } = payload;
        const store = useDataStoreInternal.getState();
        const settings = store.settings;

        if (!settings || !session.start || !session.title) return;

        const date = new Date(session.start);
        const dayOfWeek = getDay(date);
        const startSeconds = date.getHours() * 3600 + date.getMinutes() * 60;
        const durationSeconds = session.duration || 3600;

        const oldRoutineList = [...(settings.weeklyRoutine || [])];
        const oldRoutine = oldRoutineList.find(r => r.id === session.id);
        const oldRoutineDeepCopy = oldRoutine ? JSON.parse(JSON.stringify(oldRoutine)) : null;

        const newRoutine: RoutineSession = {
            id: session.id || crypto.randomUUID(),
            dayOfWeek,
            startSeconds,
            durationSeconds,
            title: session.title,
            description: session.description,
            color: session.color,
            location: session.location,
            alert: session.alert,
            priority: session.priority
        };

        let updatedRoutine = [...oldRoutineList];

        if (session.id && updatedRoutine.some(r => r.id === session.id)) {
            if (originalStart) {
                const originalDay = getDay(new Date(originalStart));
                const targetIndex = updatedRoutine.findIndex(r => r.id === session.id && r.dayOfWeek === originalDay);

                if (targetIndex >= 0) {
                    updatedRoutine[targetIndex] = newRoutine;
                } else {
                    const idMatchIndex = updatedRoutine.findIndex(r => r.id === session.id);
                    if (idMatchIndex >= 0) updatedRoutine[idMatchIndex] = newRoutine;
                }
            } else {
                updatedRoutine = updatedRoutine.map(r => r.id === session.id ? newRoutine : r);
            }
        } else {
            updatedRoutine.push(newRoutine);
        }

        // Apply immediately
        await store.saveSettings({ ...settings, weeklyRoutine: updatedRoutine });

        // Undo/Redo logic
        return {
            undo: async () => {
                const s = useDataStoreInternal.getState();
                if (!s.settings) return;

                if (oldRoutineDeepCopy) {
                    const restoredList = s.settings.weeklyRoutine?.map(r => r.id === oldRoutineDeepCopy.id ? oldRoutineDeepCopy : r) || [oldRoutineDeepCopy];
                    await s.saveSettings({ ...s.settings, weeklyRoutine: restoredList });
                } else {
                    const restoredList = s.settings.weeklyRoutine?.filter(r => r.id !== newRoutine.id) || [];
                    await s.saveSettings({ ...s.settings, weeklyRoutine: restoredList });
                }
            },
            redo: async () => {
                const s = useDataStoreInternal.getState();
                if (!s.settings) return;

                let restoredList = [...(s.settings.weeklyRoutine || [])];
                const exists = restoredList.some(r => r.id === newRoutine.id);
                if (exists) {
                    restoredList = restoredList.map(r => r.id === newRoutine.id ? newRoutine : r);
                } else {
                    restoredList.push(newRoutine);
                }
                await s.saveSettings({ ...s.settings, weeklyRoutine: restoredList });
            }
        };
    }
}

export class DeleteRoutineCommand extends BaseCommand<RoutineDeletePayload> {
    id = 'cmd.deleteRoutine';
    name = 'Delete Routine';

    async execute(payload: RoutineDeletePayload) {
        const { id } = payload;
        const store = useDataStoreInternal.getState();
        const settings = store.settings;
        if (!settings) return;

        const oldRoutineList = [...(settings.weeklyRoutine || [])];
        const oldRoutine = oldRoutineList.find(r => r.id === id);
        const oldRoutineDeepCopy = oldRoutine ? JSON.parse(JSON.stringify(oldRoutine)) : null;

        const updatedRoutine = oldRoutineList.filter(r => r.id !== id);
        await store.saveSettings({ ...settings, weeklyRoutine: updatedRoutine });

        if (oldRoutineDeepCopy) {
            return {
                undo: async () => {
                    const s = useDataStoreInternal.getState();
                    if (!s.settings) return;
                    await s.saveSettings({ ...s.settings, weeklyRoutine: [...(s.settings.weeklyRoutine || []), oldRoutineDeepCopy] });
                },
                redo: async () => {
                    const s = useDataStoreInternal.getState();
                    if (!s.settings) return;
                    await s.saveSettings({ ...s.settings, weeklyRoutine: (s.settings.weeklyRoutine || []).filter(r => r.id !== id) });
                }
            };
        }
    }
}
