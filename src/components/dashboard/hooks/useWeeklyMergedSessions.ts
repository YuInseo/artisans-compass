import { isSameDay, addMinutes, differenceInSeconds } from 'date-fns';
import { WorkSession, Session, AppSettings } from '@/types';

const getSessionStart = (s: WorkSession | Session): Date => {
    if ('startTime' in s) return new Date(s.startTime);
    return new Date(s.start);
};

const getSessionDuration = (s: WorkSession | Session): number => {
    if ('durationSeconds' in s) return s.durationSeconds;
    return s.duration;
};

export function useWeeklyMergedSessions({
    weekSessions,
    settings,
    liveSession
}: {
    weekSessions: (WorkSession | Session)[];
    settings: AppSettings | null;
    liveSession?: WorkSession | Session | null;
}) {
        const getMergedSessionsForDay = (day: Date) => {
            const daySessions = weekSessions.filter(s => {
                if (!isSameDay(getSessionStart(s), day)) return false;
    
                if (settings?.calendarSettings?.showNonWorkApps) return true;
    
                const proc = s.process || 'Focus';
                const isTracked = settings?.targetProcessPatterns?.some((pattern: string) => proc.toLowerCase().includes(pattern.toLowerCase()));
                if (isTracked) return true;
    
                const isWork = !settings?.workApps?.length || settings.workApps.some((w: string) => w.toLowerCase() === proc.toLowerCase());
                return isWork;
            });
    
            const effectiveSessions = [...daySessions];
            if (liveSession && isSameDay(getSessionStart(liveSession), day)) {
                effectiveSessions.push(liveSession);
            }
    
            if (effectiveSessions.length === 0) return [];
    
            const eventsWithRelativeTime = effectiveSessions.map(s => {
                const start = getSessionStart(s);
                const durationSec = getSessionDuration(s);
                const end = addMinutes(start, Math.ceil(durationSec / 60));
                const startMins = start.getHours() * 60 + start.getMinutes();
                const endMins = startMins + Math.ceil(durationSec / 60);
    
                return {
                    ...s,
                    s: start,
                    e: end,
                    startMins,
                    endMins,
                    process: s.process || 'Focus',
                    appDistribution: (s as any).appUsage || { [s.process || 'Focus']: durationSec }
                };
            });
    
            const mergedSessions: any[] = [];
            if (eventsWithRelativeTime.length > 0) {
                const sorted = [...eventsWithRelativeTime].sort((a, b) => a.startMins - b.startMins);
                let currentBlock: any = null;
    
                sorted.forEach(session => {
                    const appName = session.process;
                    const sessionDurSec = differenceInSeconds(session.e, session.s);
    
                    if (!currentBlock) {
                        currentBlock = {
                            ...session,
                            title: appName,
                            appDistribution: { [appName]: sessionDurSec }
                        };
                        return;
                    }
    
                    const gap = session.startMins - currentBlock.endMins;
    
                    if (gap < 5) {
                        currentBlock.endMins = Math.max(currentBlock.endMins, session.endMins);
                        currentBlock.e = session.e.getTime() > currentBlock.e.getTime() ? session.e : currentBlock.e;
                        currentBlock.durationMins = currentBlock.endMins - currentBlock.startMins;
    
                        currentBlock.appDistribution[appName] = (currentBlock.appDistribution[appName] || 0) + sessionDurSec;
    
                        const currentMax = (Object.values(currentBlock.appDistribution) as number[]).reduce((a, b) => Math.max(a, b), 0);
                        if ((currentBlock.appDistribution[appName] || 0) >= currentMax) {
                            currentBlock.title = appName;
                        }
    
                    } else {
                        mergedSessions.push(currentBlock);
                        currentBlock = {
                            ...session,
                            title: appName,
                            appDistribution: { [appName]: sessionDurSec }
                        };
                    }
                });
                if (currentBlock) mergedSessions.push(currentBlock);
            }
    
            const snappedBlocks: any[] = [];
            mergedSessions.forEach(block => {
                let snapStart = Math.round(block.startMins / 15) * 15;
                let snapEnd = Math.round(block.endMins / 15) * 15;
    
                if (snapStart === snapEnd) return;
    
                snappedBlocks.push({
                    ...block,
                    startMins: snapStart,
                    endMins: snapEnd,
                    durationMins: snapEnd - snapStart
                });
            });
    
            const finalBlocks: any[] = [];
            if (snappedBlocks.length > 0) {
                snappedBlocks.sort((a, b) => a.startMins - b.startMins);
                let current = snappedBlocks[0];
    
                for (let i = 1; i < snappedBlocks.length; i++) {
                    const next = snappedBlocks[i];
                    const isTouching = current.endMins >= next.startMins;
    
                    if (isTouching) {
                        current.endMins = Math.max(current.endMins, next.endMins);
                        current.durationMins = current.endMins - current.startMins;
    
                        Object.entries(next.appDistribution || {}).forEach(([app, dur]) => {
                            current.appDistribution[app] = (current.appDistribution[app] || 0) + (dur as number);
                        });
    
                        let maxDur = 0;
                        let dominantApp = current.title;
                        Object.entries(current.appDistribution).forEach(([app, dur]) => {
                            if ((dur as number) > maxDur) {
                                maxDur = (dur as number);
                                dominantApp = app;
                            }
                        });
                        current.title = dominantApp;
    
                    } else {
                        finalBlocks.push(current);
                        current = next;
                    }
                }
                finalBlocks.push(current);
            }
    
            return finalBlocks;
        };

    return { getMergedSessionsForDay };
}
