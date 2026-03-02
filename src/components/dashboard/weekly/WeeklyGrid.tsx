import { isSameDay } from 'date-fns';
import { cn } from "@/lib/utils";
import { PlannedSession, AppSettings } from "@/types";
import { Flag } from 'lucide-react';
import { WeeklySessionCard } from "./WeeklySessionCard";

interface WeeklyGridProps {
    days: Date[];
    viewMode: 'calendar' | 'routine';
    now: Date;
    settings: AppSettings | null;
    showRoutineOverlay: boolean;
    routineSessions: any[];
    showAppUsage: boolean;
    getMergedSessionsForDay: (day: Date) => any[];
    effectivePlanned: PlannedSession[];
    dragState: any;
    setDragState: (state: any) => void;
    selectionRef: React.MutableRefObject<any>;
    selectionBox: any;
    setSelectionBox: (box: any) => void;
    dragRef: React.MutableRefObject<any>;
    selectedSessionIds: Set<string>;
    setSelectedSessionIds: (ids: Set<string>) => void;
    isEditorOpen: boolean;
    setIsEditorOpen: (open: boolean) => void;
    selectedPlan: Partial<PlannedSession> | null;
    setSelectedPlan: (plan: Partial<PlannedSession> | null) => void;
    setPopoverPosition: (pos: any) => void;
    handleSavePlan: (session: Partial<PlannedSession>) => Promise<void>;
    handleDeletePlan: (id: string, isRoutine?: boolean) => Promise<void>;
    startDrag: (e: React.MouseEvent, type: 'move' | 'resize', session: PlannedSession) => void;
    onMouseMove: (e: MouseEvent) => void;
    onMouseUp: (e: MouseEvent) => void;
}

export function WeeklyGrid({
    days, viewMode, now, settings, showRoutineOverlay, routineSessions,
    showAppUsage, getMergedSessionsForDay, effectivePlanned,
    dragState, setDragState, selectionRef, setSelectionBox, dragRef,
    selectedSessionIds, setSelectedSessionIds,
    isEditorOpen, setIsEditorOpen, selectedPlan, setSelectedPlan, setPopoverPosition,
    handleSavePlan, handleDeletePlan, startDrag, onMouseMove, onMouseUp
}: WeeklyGridProps) {
    return (
        <div className="flex-1 overflow-hidden relative bg-background/50">
            <div className="flex h-full relative py-4 box-border">

                <div className="w-14 shrink-0 border-r border-border/20 bg-background/80 backdrop-blur-sm sticky left-0 z-20">
                    {Array.from({ length: 13 }, (_, i) => i * 2).map(h => (
                        <div
                            key={h}
                            className="absolute w-full flex items-center justify-end pr-2"
                            style={{ top: `${(h / 24) * 100}%`, transform: 'translateY(-50%)' }}
                        >
                            <span className="text-[10px] text-muted-foreground/40 font-mono tabular-nums block">
                                {h.toString().padStart(2, '0')}:00
                            </span>
                        </div>
                    ))}
                </div>

                {days.map(day => (
                    <div
                        key={day.toString()}
                        className="flex-1 relative border-r border-border/20 last:border-r-0 min-w-[100px] group cursor-cell"
                        data-day={day.toISOString()}
                        onMouseDown={(e) => {
                            if (e.button !== 0) return;

                            if (isEditorOpen) {
                                if (selectedPlan && selectedPlan.title && selectedPlan.title.trim().length > 0) {
                                    handleSavePlan(selectedPlan);
                                }

                                setIsEditorOpen(false);
                                setSelectedPlan(null);
                                setPopoverPosition(null);
                                return;
                            }

                            if (!e.ctrlKey && selectedSessionIds.size > 0) {
                                setSelectedSessionIds(new Set());
                                return;
                            }

                            if (e.ctrlKey) {
                                e.preventDefault();
                                e.stopPropagation();

                                const container = document.getElementById('weekly-view-container');
                                if (!container) return;

                                const containerRect = container.getBoundingClientRect();
                                const startX = e.clientX;
                                const startY = e.clientY;

                                setSelectionBox({ startX, startY, currentX: startX, currentY: startY });

                                selectionRef.current = {
                                    isSelecting: true,
                                    startX,
                                    startY,
                                    currentX: startX,
                                    currentY: startY,
                                    containerRect: containerRect
                                };

                                document.body.style.userSelect = 'none';
                                document.addEventListener('mousemove', onMouseMove);
                                document.addEventListener('mouseup', onMouseUp);
                                return;
                            }

                            if (e.target !== e.currentTarget) return;
                            const rect = e.currentTarget.getBoundingClientRect();
                            const clickY = e.nativeEvent.offsetY;
                            const minutes = (clickY / rect.height) * 1440;
                            const snapped = Math.floor(minutes / 15) * 15;

                            const newStart = new Date(day);
                            newStart.setHours(0, 0, 0, 0);
                            newStart.setMinutes(snapped);

                            const state = {
                                isDragging: true,
                                type: 'create',
                                session: null,
                                startY: e.clientY,
                                originalStart: newStart.getTime(),
                                originalDuration: 900,
                                currentStart: newStart.getTime(),
                                currentDuration: 900,
                                day: newStart,
                                containerRect: rect,
                                currentX: e.clientX,
                                currentY: e.clientY,
                                initialOffsetX: e.clientX - rect.left,
                                initialOffsetY: 0,
                                ghostWidth: rect.width,
                                containerHeight: rect.height
                            };

                            setDragState(state as any);
                            dragRef.current = state;

                            document.body.style.userSelect = 'none';
                            document.addEventListener('mousemove', onMouseMove);
                            document.addEventListener('mouseup', onMouseUp);
                        }}
                    >
                        {Array.from({ length: 12 }).map((_, i) => (
                            <div
                                key={i}
                                className="absolute w-full border-b border-border/20 group-hover:border-border/30 transition-colors pointer-events-none"
                                style={{ top: `${(i * 2 / 24) * 100}%`, height: '1px' }}
                            ></div>
                        ))}

                        {isSameDay(day, now) && (
                            <div
                                className="absolute left-0 right-0 border-t-2 border-red-500 z-50 pointer-events-none flex items-center"
                                style={{ top: `${((now.getHours() * 60 + now.getMinutes()) / 1440) * 100}%` }}
                            >
                                <div className="absolute -left-1.5 w-3 h-3 bg-red-500 rounded-full" />
                            </div>
                        )}

                        <div
                            className="absolute left-0 right-0 border-t-2 border-yellow-400 border-dashed z-0 pointer-events-none opacity-50"
                            style={{ top: `${((23 * 60) / 1440) * 100}%` }}
                        />

                        {viewMode === 'calendar' && settings?.calendarSettings?.showNighttime && (
                            <div
                                className="absolute left-0 right-0 border-t-2 border-dotted border-yellow-500/70 z-20 pointer-events-none"
                                style={{ top: `${((settings.nightTimeStart || 22) / 24) * 100}%` }}
                            />
                        )}

                        {viewMode === 'calendar' && settings?.calendarSettings?.showNighttime && (
                            <div
                                className="absolute left-0 right-0 bg-black/20 dark:bg-black/40 pointer-events-none z-0"
                                style={{
                                    top: `${((settings.nightTimeStart || 22) / 24) * 100}%`,
                                    height: `${((24 - (settings.nightTimeStart || 22)) / 24) * 100}%`
                                }}
                            />
                        )}

                        {viewMode === 'calendar' && showRoutineOverlay && routineSessions
                            .filter(s => isSameDay(new Date(s.start), day))
                            .map((session, idx) => {
                                const start = new Date(session.start);
                                const startMins = start.getHours() * 60 + start.getMinutes();
                                const top = (startMins / 1440) * 100;
                                const height = (session.duration / 60 / 1440) * 100;

                                return (
                                    <div
                                        key={`routine-ghost-${idx}`}
                                        className={cn(
                                            "absolute left-[4px] right-[4px] rounded-sm border-2 border-dashed px-2 flex flex-col justify-center overflow-hidden opacity-30 pointer-events-none z-0",
                                            !session.color && "bg-muted border-foreground/20 text-foreground",
                                            session.color === 'blue' && "bg-blue-500/20 border-blue-500/50 text-blue-700 dark:text-blue-300",
                                            session.color === 'green' && "bg-green-500/20 border-green-500/50 text-green-700 dark:text-green-300",
                                            session.color === 'orange' && "bg-orange-500/20 border-orange-500/50 text-orange-700 dark:text-orange-300",
                                            session.color === 'purple' && "bg-purple-500/20 border-purple-500/50 text-purple-700 dark:text-purple-300",
                                        )}
                                        style={{ top: `${top}%`, height: `${height}%` }}
                                    >
                                        <div className="font-semibold truncate text-[9px] leading-tight">{session.title}</div>
                                    </div>
                                );
                            })}

                        {viewMode === 'calendar' && showAppUsage && getMergedSessionsForDay(day).map((block, idx) => {
                            const top = (block.startMins / 1440) * 100;
                            const height = (block.durationMins / 1440) * 100;

                            const isTracked = settings?.targetProcessPatterns?.some((pattern: string) => block.title.toLowerCase().includes(pattern.toLowerCase()));
                            const isNonWork = settings?.workApps?.length && !settings.workApps.some((w: string) => w.toLowerCase() === block.title.toLowerCase()) && !isTracked;

                            return (
                                <div
                                    key={`merged-${idx}`}
                                    className={cn(
                                        "absolute left-[2px] right-[2px] rounded-sm text-[10px] px-2 flex flex-col justify-center overflow-hidden hover:z-40 hover:opacity-100 hover:shadow-lg transition-all cursor-default group/session pointer-events-none",
                                        isNonWork
                                            ? (settings?.calendarSettings?.nonWorkColor
                                                ? `bg-[${settings.calendarSettings.nonWorkColor}] text-foreground`
                                                : "bg-slate-200/50 dark:bg-slate-800/50 text-muted-foreground border border-slate-300 dark:border-slate-700")
                                            : "bg-primary/80 text-primary-foreground"
                                    )}
                                    style={{ top: `${top}%`, height: `${height}%` }}
                                >
                                    <div className="font-semibold truncate group-hover/session:whitespace-normal leading-tight flex items-center gap-1">
                                        {block.priority === 'high' && <Flag className="w-3 h-3 text-red-500 fill-red-500 flex-shrink-0" />}
                                        {block.priority === 'medium' && <Flag className="w-3 h-3 text-orange-500 fill-orange-500 flex-shrink-0" />}
                                        {block.priority === 'low' && <Flag className="w-3 h-3 text-blue-500 fill-blue-500 flex-shrink-0" />}
                                        <span className="truncate">{block.title}</span>
                                    </div>
                                    <div className="truncate opacity-75 text-[9px] mt-0.5 font-mono">
                                        {Math.floor(block.durationMins / 60)}h {block.durationMins % 60}m
                                    </div>
                                </div>
                            );
                        })}

                        {(() => {
                            const dayStartMs = new Date(day).setHours(0, 0, 0, 0);
                            const dayEndMs = dayStartMs + 86400000;

                            const rawSessions = effectivePlanned
                                .filter(s => !dragState?.isDragging || s.id !== dragState.session?.id);

                            if (isEditorOpen && selectedPlan && !selectedPlan.id && selectedPlan.start) {
                                rawSessions.push({ ...selectedPlan, id: 'temp-creating-session' } as PlannedSession);
                            } else if (isEditorOpen && selectedPlan && selectedPlan.id && selectedPlan.start && !effectivePlanned.some(p => p.id === selectedPlan.id)) {
                                rawSessions.push(selectedPlan as PlannedSession);
                            }

                            if (dragState && dragState.isDragging) {
                                if (dragState.type === 'create') {
                                    rawSessions.push({
                                        id: 'drag-ghost-session',
                                        title: 'New Session',
                                        start: dragState.currentStart,
                                        duration: dragState.currentDuration,
                                    } as any);
                                } else if (dragState.session) {
                                    rawSessions.push({
                                        ...dragState.session,
                                        id: 'drag-ghost-session',
                                        start: dragState.type === 'resize' ? dragState.originalStart : dragState.currentStart,
                                        duration: dragState.currentDuration,
                                    } as any);
                                }
                            }

                            const daySegments: any[] = [];

                            rawSessions.forEach((s) => {
                                const startMs = new Date(s.start).getTime();
                                const endMs = startMs + (s.duration * 1000);

                                if (startMs < dayEndMs && endMs > dayStartMs) {
                                    const segmentStart = Math.max(startMs, dayStartMs);
                                    const segmentEnd = Math.min(endMs, dayEndMs);
                                    daySegments.push({
                                        ...s,
                                        originalStart: startMs,
                                        originalDuration: s.duration,
                                        segmentStart,
                                        segmentEnd,
                                        segmentDuration: (segmentEnd - segmentStart) / 1000,
                                        isStart: startMs >= dayStartMs,
                                        isEnd: endMs <= dayEndMs
                                    });
                                }
                            });

                            if (daySegments.length === 0) return null;

                            const layoutMap = new Map<string, { left: number, width: number }>();

                            const sorted = [...daySegments].sort((a, b) => {
                                if (a.segmentStart !== b.segmentStart) return a.segmentStart - b.segmentStart;
                                return b.segmentDuration - a.segmentDuration;
                            });

                            const processed = new Set<any>();

                            sorted.forEach(s => {
                                if (processed.has(s)) return;

                                const group: any[] = [s];
                                const queue = [s];
                                processed.add(s);

                                let qIdx = 0;
                                while (qIdx < queue.length) {
                                    const current = queue[qIdx++];
                                    const curStart = current.segmentStart;
                                    const curEnd = curStart + (current.segmentDuration * 1000);

                                    for (const other of sorted) {
                                        if (processed.has(other)) continue;

                                        const otherStart = other.segmentStart;
                                        const otherEnd = otherStart + (other.segmentDuration * 1000);

                                        if (curStart < otherEnd && curEnd > otherStart) {
                                            group.push(other);
                                            queue.push(other);
                                            processed.add(other);
                                        }
                                    }
                                }

                                const groupCols: any[][] = [];
                                group.sort((a, b) => a.segmentStart - b.segmentStart);

                                group.forEach(gs => {
                                    let placedCol = -1;
                                    for (let i = 0; i < groupCols.length; i++) {
                                        const last = groupCols[i][groupCols[i].length - 1];
                                        const lastEnd = last.segmentStart + (last.segmentDuration * 1000);
                                        if (gs.segmentStart >= lastEnd) {
                                            groupCols[i].push(gs);
                                            placedCol = i;
                                            break;
                                        }
                                    }
                                    if (placedCol === -1) {
                                        groupCols.push([gs]);
                                        placedCol = groupCols.length - 1;
                                    }
                                });

                                const width = 100 / groupCols.length;
                                groupCols.forEach((col, colIdx) => {
                                    col.forEach(item => {
                                        layoutMap.set(item.id, {
                                            left: colIdx * width,
                                            width: width
                                        });
                                    });
                                });
                            });

                            return daySegments.map((session) => (
                                <WeeklySessionCard
                                    key={`planned-${session.id}-${session.segmentStart}`}
                                    session={session}
                                    layout={layoutMap.get(session.id) || { left: 0, width: 100 }}
                                    isDragPreview={session.id === 'drag-ghost-session'}
                                    isSelected={selectedSessionIds.has(session.id!)}
                                    isEditing={selectedPlan?.id === session.id}
                                    dayStartMs={dayStartMs}
                                    startDrag={startDrag}
                                    handleDeletePlan={handleDeletePlan}
                                    setSelectedPlan={setSelectedPlan}
                                    setIsEditorOpen={setIsEditorOpen}
                                    setPopoverPosition={setPopoverPosition}
                                />
                            ));
                        })()}
                    </div>
                ))}

            </div>
        </div>
    );
}
