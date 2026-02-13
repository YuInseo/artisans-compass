
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Session } from '@/types';

interface TimerWidgetProps {
    isWidgetMode: boolean;
    liveSession: any; // Using any for now to match existing usage, should be Session type
    sessions: Session[];
    now: Date;
    onRemove: () => void;
}

export function TimerWidget({ isWidgetMode, liveSession, sessions, now, onRemove }: TimerWidgetProps) {
    const { t } = useTranslation();

    const totalFocusTime = useMemo(() => {
        let time = 0;
        // Deduplicate: If liveSession start time matches any completed session, ignore liveSession (it's transitioning)
        const isLiveAlreadyCompleted = liveSession && sessions.some(s => s.start === liveSession.start);
        const effectiveLiveSession = isLiveAlreadyCompleted ? null : liveSession;

        const allSessions = effectiveLiveSession ? [...sessions, effectiveLiveSession] : sessions;

        allSessions.forEach(session => {
            const isLive = session === effectiveLiveSession;

            // Use stored duration for completed sessions to match backend rounding
            if (!isLive && typeof session.duration === 'number') {
                time += session.duration;
                return;
            }

            const s = new Date(session.start);
            const e = isLive ? now : new Date(session.end);
            if (isNaN(s.getTime()) || isNaN(e.getTime())) return;

            // Fallback calculation for live sessions or missing duration
            // Use Math.floor to match backend perfectly and prevent "jumps" vs "floors"
            const msDiff = e.getTime() - s.getTime();
            const duration = Math.floor(msDiff / 1000);

            if (duration > 0) time += duration;
        });
        return time;
    }, [sessions, liveSession, now]);

    return (
        <div className="mb-4 px-1 animate-in fade-in slide-in-from-top-2 group relative">
            <div className="p-4 bg-muted/30 border border-border/50 rounded-lg flex items-center justify-between relative overflow-hidden transition-all duration-500">
                {/* Background Pulse for Focus Mode */}
                {liveSession && (
                    <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-green-500/5 blur-[40px] rounded-full animate-pulse pointer-events-none" />
                )}

                <div className="z-10">
                    <div className="z-10">
                        <div className={cn("text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-1", isWidgetMode && "drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]")}>{t('calendar.totalFocus')}</div>
                        <div className={cn("text-3xl font-bold font-mono tracking-tight text-foreground flex items-baseline gap-1", isWidgetMode && "drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]")}>
                            {Math.floor(totalFocusTime / 3600)}<span className="text-sm font-sans font-medium text-muted-foreground">h</span>
                            {Math.floor((totalFocusTime % 3600) / 60)}<span className="text-sm font-sans font-medium text-muted-foreground">m</span>
                            {totalFocusTime % 60}<span className="text-sm font-sans font-medium text-muted-foreground">s</span>
                        </div>
                    </div>

                    <div className="flex flex-col items-end justify-center z-10 transition-all duration-300">
                        {liveSession ? (
                            <>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                    </span>
                                    <span className="text-[10px] font-bold text-green-500 uppercase tracking-wider">{t('calendar.focusing')}</span>
                                </div>
                                <div className={cn("text-xs font-medium text-foreground max-w-[120px] truncate text-right border-t border-border/50 pt-1 mt-1 transition-all", isWidgetMode && "drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]")} title={liveSession.process}>
                                    {liveSession.process}
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="flex items-center gap-2 mb-1 opacity-50">
                                    <span className="relative flex h-2 w-2">
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-400"></span>
                                    </span>
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Ready</span>
                                </div>
                                <div className={cn("text-xs font-medium text-muted-foreground max-w-[120px] truncate text-right border-t border-border/50 pt-1 mt-1 italic", isWidgetMode && "drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]")}>
                                    Waiting for activity...
                                </div>
                            </>
                        )}
                    </div>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onRemove();
                        }}
                        className="absolute top-1 right-1 p-1 rounded-full text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all no-drag z-20"
                        title="Remove Timer"
                        style={{ WebkitAppRegion: 'no-drag' } as any}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                    </button>
                </div>
            </div>
        </div>
    );
}
