import { useMemo } from 'react';
import { differenceInSeconds, getHours } from 'date-fns';
import { Session } from '@/types';

export function useTimeTableStats(
    sessions: Session[],
    liveSession: Session | null | undefined,
    now: Date
) {
    const { totalFocusTime, peakActivityHour } = useMemo(() => {
        let total = 0;
        const effectiveSessions = liveSession ? [...sessions, liveSession] : sessions;
        const hourlyDistribution = new Array(24).fill(0);

        effectiveSessions.forEach(session => {
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
        if (maxHour !== -1 && maxDuration > 0) {
            const ampm = maxHour >= 12 ? 'PM' : 'AM';
            const displayHour = maxHour % 12 || 12;
            peakActivityHour = `${displayHour} ${ampm} `;
        }

        return { totalFocusTime: total, peakActivityHour };
    }, [sessions, liveSession, now]);

    return { totalFocusTime, peakActivityHour };
}
