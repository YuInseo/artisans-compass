import { useMemo } from 'react';
import { differenceInSeconds, getHours } from 'date-fns';
import { Session, AppSettings } from '@/types';
import { useTranslation } from 'react-i18next';

export function useTimeTableStats(
    sessions: Session[],
    liveSession: Session | null | undefined,
    allSessions: Session[] | undefined,
    allLiveSession: Session | null | undefined,
    now: Date,
    settings: AppSettings | null | undefined
) {
    const { t } = useTranslation();

const { totalFocusTime, peakActivityHour } = useMemo(() => {
        let total = 0;
        const allSessions = liveSession ? [...sessions, liveSession] : sessions;
        const hourlyDistribution = new Array(24).fill(0);

        allSessions.forEach(session => {
            const s = new Date(session.start);
            const isLive = session === liveSession;
            const e = isLive ? now : new Date(session.end);

            if (isNaN(s.getTime()) || isNaN(e.getTime())) return;
            const duration = differenceInSeconds(e, s);
            if (duration <= 0) return;

            total += duration;

            // Hourly Distribution logic
            let currentStr = s;
            while (currentStr < e) {
                const currentHour = getHours(currentStr);
                const nextHourDate = new Date(currentStr);
                nextHourDate.setHours(currentHour + 1, 0, 0, 0);

                const segmentEnd = nextHourDate < e ? nextHourDate : e;
                const segmentDuration = differenceInSeconds(segmentEnd, currentStr);

                hourlyDistribution[currentHour] += segmentDuration;
                currentStr = segmentEnd;
            }
        });

        // Find max hour
        let maxHour = -1;
        let maxDuration = 0;
        hourlyDistribution.forEach((dur, hour) => {
            if (dur > maxDuration) {
                maxDuration = dur;
                maxHour = hour;
            }
        });

        let peakActivityHour = null;
        if (maxHour !== -1) {
            const ampm = maxHour >= 12 ? 'PM' : 'AM';
            const displayHour = maxHour % 12 || 12;
            peakActivityHour = `${displayHour} ${ampm} `;
        }

        return { totalFocusTime: total, peakActivityHour };
    }, [sessions, liveSession, now]);

const { sortedApps, totalAppUsageTime } = useMemo(() => {
        const effectiveAllSessions = allSessions || sessions;
        const effectiveLiveSession = allLiveSession !== undefined ? allLiveSession : liveSession;

        const allSessionsList = effectiveLiveSession ? [...effectiveAllSessions, effectiveLiveSession] : effectiveAllSessions;

        let total = 0;
        const appMap: Record<string, number> = {};

        allSessionsList.forEach(session => {
            const s = new Date(session.start);
            const isLive = session === effectiveLiveSession;
            const e = isLive ? now : new Date(session.end);

            if (isNaN(s.getTime()) || isNaN(e.getTime())) return;

            const duration = differenceInSeconds(e, s);
            if (duration <= 0) return;

            total += duration;
            const appName = session.process || t('calendar.focusSession');
            appMap[appName] = (appMap[appName] || 0) + duration;
        });

        const apps = Object.entries(appMap)
            .map(([name, duration]) => ({ name, duration }))
            .sort((a, b) => b.duration - a.duration);

        return { sortedApps: apps, totalAppUsageTime: total };
    }, [sessions, allSessions, liveSession, allLiveSession, now, t, settings]);

    return { totalFocusTime, peakActivityHour, sortedApps, totalAppUsageTime };
}
