import { useMemo } from 'react';
import { differenceInMinutes, getHours, getMinutes, format } from 'date-fns';
import { Session } from '@/types';

interface TimeTableGraphProps {
    sessions: Session[];
    date: Date;
}

export function TimeTableGraph({ sessions, date }: TimeTableGraphProps) {
    // Fit to view: 24h = 100% height

    // Calculate total minutes in a day
    const TOTAL_MINUTES = 24 * 60;

    const sessionBlocks = useMemo(() => {
        return sessions.map(session => {
            const startDate = new Date(session.start);
            const endDate = new Date(session.end);

            // Calculate minutes from start of day
            const startMins = getHours(startDate) * 60 + getMinutes(startDate);
            const durationMins = differenceInMinutes(endDate, startDate);

            // Position (%)
            const top = (startMins / TOTAL_MINUTES) * 100;
            const height = (durationMins / TOTAL_MINUTES) * 100;

            // Min visual height: 2% just to see it
            const displayHeight = Math.max(height, 1.5);

            // Duration String
            const hours = Math.floor(durationMins / 60);
            const mins = durationMins % 60;
            const durationStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

            return {
                top: `${top}%`,
                height: `${displayHeight}%`,
                title: session.process || "Focus Session",
                timeRange: `${format(startDate, 'h:mm a')} - ${format(endDate, 'h:mm a')}`,
                duration: durationStr
            };
        });
    }, [sessions, date]);

    return (
        <div className="w-full h-full flex flex-col bg-card rounded-lg overflow-hidden border border-border relative">
            <div className="flex-1 relative m-4 mb-6"> {/** Margin for labels */}
                {/* Semantic Grid Lines */}
                {Array.from({ length: 13 }, (_, i) => i * 2).map(h => (
                    <div
                        key={h}
                        className="absolute w-full border-t border-border/50 flex items-center"
                        style={{ top: `${(h / 24) * 100}%` }}
                    >
                        <span className="text-[10px] text-muted-foreground font-medium ml-2 -mt-2 bg-card px-1 whitespace-nowrap">
                            {h === 24 ? '00:00' : `${h}:00`}
                        </span>
                    </div>
                ))}

                {/* Vertical Line */}
                <div className="absolute top-0 bottom-0 left-16 right-0 border-l border-border/50"></div>

                {/* Events */}
                {sessionBlocks.map((block, i) => (
                    <div
                        key={i}
                        className="absolute left-18 right-2 rounded-md bg-blue-500/10 border-l-4 border-blue-500 p-1 pl-2 text-xs text-blue-700 dark:text-blue-300 hover:bg-blue-500/20 transition-all z-10 shadow-sm overflow-hidden flex flex-col justify-center cursor-pointer group"
                        style={{ top: block.top, height: block.height, left: '4.5rem' }}
                        title={`${block.title} (${block.timeRange}) - ${block.duration}`}
                    >
                        <div className="font-bold text-blue-700 dark:text-blue-300 truncate text-[10px] group-hover:text-blue-900 dark:group-hover:text-blue-100">{block.title}</div>
                        <div className="flex items-center gap-1 text-blue-500 dark:text-blue-400 text-[9px] truncate hidden sm:flex group-hover:text-blue-700 dark:group-hover:text-blue-200">
                            <span>{block.duration}</span>
                            <span className="opacity-50">|</span>
                            <span>{block.timeRange}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
