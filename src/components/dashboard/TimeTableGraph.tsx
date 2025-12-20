import { useMemo } from 'react';
import { differenceInMinutes, getHours, getMinutes, format } from 'date-fns';
import { Session } from '@/types';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface TimeTableGraphProps {
    sessions: Session[];
    date: Date;
}

export function TimeTableGraph({ sessions, date }: TimeTableGraphProps) {
    // Fit to view: 24h = 100% height

    // Calculate total minutes in a day
    const TOTAL_MINUTES = 24 * 60;

    // Helper interface for the layout logic
    interface RenderEvent {
        id: string;
        title: string;
        startDate: Date;
        endDate: Date;
        startMins: number;
        endMins: number;
        durationMins: number;
        colIndex?: number; // Optional, as it's added during layout
        appDistribution: Record<string, number>; // New property to track app usage within a merged block
    }

    const sessionBlocks = useMemo(() => {
        // 1. Pre-process: Filter & Sort
        const rawEvents = sessions
            .filter(session => {
                const s = new Date(session.start);
                const e = new Date(session.end);
                return !isNaN(s.getTime()) && !isNaN(e.getTime());
            })
            .map(session => ({
                start: new Date(session.start),
                end: new Date(session.end),
                title: session.process || "Focus Session",
                original: session
            }))
            .sort((a, b) => a.start.getTime() - b.start.getTime());

        // 2. Merge Logic: Combine adjacent sessions regardless of App Title
        // This creates "work blocks" where small gaps are ignored.
        const mergedEvents: (typeof rawEvents[number] & { appDistribution: Record<string, number> })[] = [];

        rawEvents.forEach(evt => {
            const currentDuration = differenceInMinutes(evt.end, evt.start);

            if (mergedEvents.length === 0) {
                mergedEvents.push({
                    ...evt,
                    appDistribution: { [evt.title]: currentDuration }
                });
                return;
            }

            const last = mergedEvents[mergedEvents.length - 1];
            const timeDiff = differenceInMinutes(evt.start, last.end);

            // Merge if gap is small (<= 5 mins)
            if (timeDiff <= 5) {
                // Extend the last block's end time
                last.end = new Date(Math.max(last.end.getTime(), evt.end.getTime()));
                // Track app usage for naming the merged block later
                last.appDistribution[evt.title] = (last.appDistribution[evt.title] || 0) + currentDuration;
            } else {
                // If gap is too large, start a new merged block
                mergedEvents.push({
                    ...evt,
                    appDistribution: { [evt.title]: currentDuration }
                });
            }
        });

        // 3. Convert to RenderEvents & Determine Dominant Title for each merged block
        const events: RenderEvent[] = mergedEvents.map(session => {
            const startMins = getHours(session.start) * 60 + getMinutes(session.start);
            const durationMins = Math.max(differenceInMinutes(session.end, session.start), 5); // Minimum 5 mins
            const endMins = startMins + durationMins;

            // Find the dominant app within this merged block for its title
            let maxDuration = 0;
            let dominantTitle = "Activity"; // Default title if no apps or for very short sessions
            if (Object.keys(session.appDistribution).length > 0) {
                Object.entries(session.appDistribution).forEach(([app, dur]) => {
                    if ((dur as number) > maxDuration) {
                        maxDuration = (dur as number);
                        dominantTitle = app;
                    }
                });
            } else {
                dominantTitle = session.title; // Fallback to original title if appDistribution is empty
            }


            return {
                id: Math.random().toString(36),
                title: dominantTitle,
                startDate: session.start,
                endDate: session.end,
                startMins,
                endMins,
                durationMins,
                appDistribution: session.appDistribution
            };
        });

        // 4. Compute Layout Columns (Simple Greedy Packing) for remaining overlaps
        const columns: RenderEvent[][] = [];
        events.forEach(event => {
            let placed = false;
            for (let i = 0; i < columns.length; i++) {
                const lastEventInCol = columns[i][columns[i].length - 1];
                // Check if the current event can fit into this column without overlapping the last event
                if (event.startMins >= lastEventInCol.endMins) {
                    columns[i].push(event);
                    event.colIndex = i; // Assign column index
                    placed = true;
                    break;
                }
            }
            if (!placed) {
                // If it doesn't fit into any existing column, create a new one
                columns.push([event]);
                event.colIndex = columns.length - 1; // Assign new column index
            }
        });

        const totalTracks = columns.length > 0 ? columns.length : 1;

        return events.map((event) => {
            const top = (event.startMins / TOTAL_MINUTES) * 100;
            const height = (event.durationMins / TOTAL_MINUTES) * 100;

            const widthPercent = 100 / totalTracks;
            const leftPercent = (event.colIndex || 0) * widthPercent;

            const hours = Math.floor(event.durationMins / 60);
            const mins = event.durationMins % 60;
            const durationStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

            return {
                top: `${top}%`,
                height: `${Math.max(height, 0.5)}%`, // Ensure minimum height for visibility
                left: `${leftPercent}%`,
                width: `${widthPercent}%`,
                title: event.title,
                timeRange: `${format(event.startDate, 'h:mm a')} - ${format(event.endDate, 'h:mm a')}`,
                duration: durationStr,
                isShort: event.durationMins < 30,
                fullApps: Object.keys(event.appDistribution).join(", ") // For tooltip
            };
        });
    }, [sessions, date]);

    return (
        <div className="w-full h-full flex flex-col bg-card/30 rounded-xl overflow-hidden border border-border/40 relative select-none">
            <div className="flex-1 relative m-4 mb-2">
                {/* Subtle Grid Lines & Labels */}
                {Array.from({ length: 13 }, (_, i) => i * 2).map(h => (
                    <div
                        key={h}
                        className="absolute w-full flex items-center group pointer-events-none"
                        style={{ top: `${(h / 24) * 100}%` }}
                    >
                        {/* Time Label */}
                        <div className="w-12 text-right pr-3 -mt-2">
                            <span className="text-[10px] text-muted-foreground/40 font-mono tabular-nums">
                                {h === 24 ? '00:00' : `${h.toString().padStart(2, '0')}:00`}
                            </span>
                        </div>
                        {/* Line */}
                        <div className="flex-1 border-t border-border/20 w-full" />
                    </div>
                ))}

                {/* Vertical Divider Line */}
                <div className="absolute top-0 bottom-0 left-12 border-l border-border/20 h-full pointer-events-none"></div>

                {/* Events Layer */}
                <div className="absolute top-0 bottom-0 left-12 right-0">
                    <TooltipProvider delayDuration={0}>
                        {sessionBlocks.map((block, i) => (
                            <Tooltip key={i}>
                                <TooltipTrigger asChild>
                                    <div
                                        className="absolute rounded-sm bg-blue-500 hover:bg-blue-400 transition-colors cursor-pointer z-10 flex flex-col justify-center px-2 overflow-hidden"
                                        style={{
                                            top: block.top,
                                            height: block.height,
                                            left: block.left,
                                            width: block.width
                                        }}
                                    >

                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="right" className="flex flex-col gap-0.5 bg-background/95 backdrop-blur border-border p-3 shadow-xl">
                                    <p className="font-bold text-sm text-foreground">{block.title}</p>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <span className="font-mono">{block.timeRange}</span>
                                        <span>•</span>
                                        <span>{block.duration}</span>
                                    </div>
                                </TooltipContent>
                            </Tooltip>
                        ))}
                    </TooltipProvider>
                </div>
            </div>
        </div>
    );
}
