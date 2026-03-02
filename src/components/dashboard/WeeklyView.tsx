import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { getDay, addDays } from 'date-fns';

import { WorkSession, Session, PlannedSession } from "@/types";
import { PlanEditor } from "./PlanEditor";

import { useDataStore } from "@/hooks/useDataStore";

// Hooks
import { useWeeklyState } from "./hooks/useWeeklyState";
import { useWeeklyData } from "./hooks/useWeeklyData";
import { useWeeklyDragAndDrop } from "./hooks/useWeeklyDragAndDrop";
import { useWeeklyBulkActions } from "./hooks/useWeeklyBulkActions";

// UI Components
import { WeeklyHeader } from "./weekly/WeeklyHeader";
import { useWeeklyMergedSessions } from './hooks/useWeeklyMergedSessions';
import { WeeklyGrid } from './weekly/WeeklyGrid';
import { WeeklyDayHeaders } from "./weekly/WeeklyDayHeaders";
import { WeeklyBulkActionBar } from "./weekly/WeeklyBulkActionBar";

interface WeeklyViewProps {
    currentDate: Date;
    onDateChange: (date: Date) => void;
    liveSession?: WorkSession | Session | null;
    todaySessions?: (WorkSession | Session)[];
}

export function WeeklyView({ currentDate, onDateChange, liveSession, todaySessions }: WeeklyViewProps) {
    const { settings, saveSettings } = useDataStore();

    const {
        viewMode, setViewMode,
        now,
        showRoutineOverlay, setShowRoutineOverlay,
        showAppUsage, setShowAppUsage,
        viewDate, setViewDate,
        isEditorOpen, setIsEditorOpen,
        selectedPlan, setSelectedPlan, selectedPlanRef,
        popoverPosition, setPopoverPosition,
        days,
        handlePrevWeek, handleNextWeek, handleToday
    } = useWeeklyState(currentDate, onDateChange);

    const {
        weekSessions,
        localRoutine, setLocalRoutine,
        routineSessions,
        effectivePlanned,
        loadData,
        handleSavePlan,
        handleDeletePlan,
        setWeekPlanned
    } = useWeeklyData(
        days, viewMode, viewDate, showRoutineOverlay, isEditorOpen, setSelectedPlan, todaySessions
    );

    const {
        dragState, setDragState,
        selectionBox, setSelectionBox,
        selectedSessionIds, setSelectedSessionIds,
        selectionRef, dragRef,
        startDrag,
        onMouseMove, onMouseUp
    } = useWeeklyDragAndDrop({
        viewMode, isEditorOpen, selectedPlanRef, setIsEditorOpen, setSelectedPlan, setPopoverPosition, handleSavePlan
    });

    const {
        handleBulkDelete,
        handleBulkPriority,
        handleBulkDateChange
    } = useWeeklyBulkActions({
        viewMode, settings, saveSettings, selectedSessionIds, setSelectedSessionIds, effectivePlanned, handleSavePlan, loadData
    });

    // Horizontal Scroll Navigation
    const wheelAccumulator = useRef(0);
    const wheelTimeout = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        const container = document.getElementById('weekly-view-container');
        if (!container) return;

        const onWheel = (e: WheelEvent) => {
            if (viewMode === 'routine' || isEditorOpen) return;
            if ((dragRef.current && dragRef.current.isDragging) || (selectionRef.current && selectionRef.current.isSelecting)) {
                return;
            }

            let delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
            if (Math.abs(delta) > 0) {
                e.preventDefault();
                wheelAccumulator.current += delta;
                if (wheelTimeout.current) clearTimeout(wheelTimeout.current);

                const THRESHOLD = 50;

                if (wheelAccumulator.current > THRESHOLD) {
                    const newDate = addDays(viewDate, 1);
                    setViewDate(newDate);
                    wheelAccumulator.current = 0;
                } else if (wheelAccumulator.current < -THRESHOLD) {
                    const newDate = addDays(viewDate, -1);
                    setViewDate(newDate);
                    wheelAccumulator.current = 0;
                }

                wheelTimeout.current = setTimeout(() => {
                    wheelAccumulator.current = 0;
                }, 150);
            }
        };

        container.addEventListener('wheel', onWheel, { passive: false });
        return () => {
            container.removeEventListener('wheel', onWheel);
            if (wheelTimeout.current) clearTimeout(wheelTimeout.current);
        };
    }, [viewDate, viewMode, isEditorOpen, setViewDate]);

    const scrollRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = 400; // ~6:40 AM
        }
    }, []);

    const { getMergedSessionsForDay } = useWeeklyMergedSessions({ weekSessions, settings, liveSession });

    const portalTarget = typeof document !== 'undefined' ? document.getElementById('top-toolbar-portal') : null;

    const header = (
        <WeeklyHeader
            viewMode={viewMode}
            setViewMode={setViewMode}
            viewDate={viewDate}
            showRoutineOverlay={showRoutineOverlay}
            setShowRoutineOverlay={setShowRoutineOverlay}
            showAppUsage={showAppUsage}
            setShowAppUsage={setShowAppUsage}
            handlePrevWeek={handlePrevWeek}
            handleNextWeek={handleNextWeek}
            handleToday={handleToday}
            settings={settings}
        />
    );

    return (
        <div id="weekly-view-container" className="flex flex-col h-full bg-background text-foreground select-none animate-in fade-in duration-300 relative">
            {portalTarget ? createPortal(header, portalTarget) : (
                <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-card/50 backdrop-blur-sm shrink-0">
                    {header}
                </div>
            )}

            <WeeklyDayHeaders days={days} viewMode={viewMode} />

            <div className="flex-1 flex overflow-hidden relative">
                <WeeklyGrid
                    days={days} viewMode={viewMode} now={now} settings={settings}
                    showRoutineOverlay={showRoutineOverlay} routineSessions={routineSessions}
                    showAppUsage={showAppUsage} getMergedSessionsForDay={getMergedSessionsForDay}
                    effectivePlanned={effectivePlanned} dragState={dragState} setDragState={setDragState}
                    selectionRef={selectionRef} selectionBox={selectionBox} setSelectionBox={setSelectionBox}
                    dragRef={dragRef} selectedSessionIds={selectedSessionIds} setSelectedSessionIds={setSelectedSessionIds}
                    isEditorOpen={isEditorOpen} setIsEditorOpen={setIsEditorOpen}
                    selectedPlan={selectedPlan} setSelectedPlan={setSelectedPlan} setPopoverPosition={setPopoverPosition}
                    handleSavePlan={handleSavePlan} handleDeletePlan={handleDeletePlan}
                    startDrag={startDrag} onMouseMove={onMouseMove} onMouseUp={onMouseUp}
                />

                {isEditorOpen && popoverPosition && createPortal(
                    <div
                        className="absolute z-[9999] animate-in fade-in zoom-in-95 duration-200 plan-editor-card"
                        style={{
                            ...(popoverPosition.y > (document.getElementById('weekly-view-container')?.clientHeight || window.innerHeight) - 350
                                ? { bottom: Math.max(10, (document.getElementById('weekly-view-container')?.clientHeight || window.innerHeight) - popoverPosition.y - 40) }
                                : { top: popoverPosition.y }),
                            left: Math.min(popoverPosition.x, (document.getElementById('weekly-view-container')?.clientWidth || window.innerWidth) - 340),
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                        onMouseUp={(e) => e.stopPropagation()}
                    >
                        <PlanEditor
                            isOpen={isEditorOpen}
                            onClose={() => setIsEditorOpen(false)}
                            session={selectedPlan}
                            onSave={handleSavePlan}
                            onDelete={handleDeletePlan}
                            onChange={(updatedSession) => {
                                setSelectedPlan(updatedSession);

                                if (viewMode === 'routine') {
                                    if (localRoutine) {
                                        const date = new Date(updatedSession.start!);
                                        const dayOfWeek = getDay(date);
                                        const startSeconds = date.getHours() * 3600 + date.getMinutes() * 60;

                                        setLocalRoutine(prev => (prev || []).map(r => {
                                            if (r.id === updatedSession.id) {
                                                return {
                                                    ...r,
                                                    title: updatedSession.title || r.title,
                                                    description: updatedSession.description !== undefined ? updatedSession.description : r.description,
                                                    color: updatedSession.color || r.color,
                                                    durationSeconds: updatedSession.duration || r.durationSeconds,
                                                    startSeconds: startSeconds,
                                                    dayOfWeek: dayOfWeek
                                                };
                                            }
                                            return r;
                                        }));
                                    }
                                } else {
                                    setWeekPlanned(prev => prev.map(p =>
                                        p.id === updatedSession.id ? { ...p, ...updatedSession } as PlannedSession : p
                                    ));
                                }
                            }}
                            mode="card"
                            tags={settings?.projectTags || []}
                        />
                    </div>,
                    document.getElementById('weekly-view-container') || document.body
                )}

                {isEditorOpen && !popoverPosition && (
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
                        <div className="bg-background rounded-lg shadow-lg">
                            <PlanEditor
                                isOpen={isEditorOpen}
                                onClose={() => setIsEditorOpen(false)}
                                session={selectedPlan}
                                onSave={handleSavePlan}
                                onDelete={handleDeletePlan}
                                onChange={(updatedSession) => {
                                    setSelectedPlan(updatedSession);
                                    if (viewMode !== 'routine') {
                                        setWeekPlanned(prev => prev.map(p =>
                                            p.id === updatedSession.id ? { ...p, ...updatedSession } as PlannedSession : p
                                        ));
                                    }
                                }}
                                mode="dialog"
                            />
                        </div>
                    </div>
                )}

                {selectionBox && createPortal(
                    <div
                        className="fixed border bg-blue-500/20 border-blue-500 z-[9999] pointer-events-none"
                        style={{
                            left: Math.min(selectionBox.startX, selectionBox.currentX),
                            top: Math.min(selectionBox.startY, selectionBox.currentY),
                            width: Math.abs(selectionBox.currentX - selectionBox.startX),
                            height: Math.abs(selectionBox.currentY - selectionBox.startY)
                        }}
                    />,
                    document.body
                )}

                <WeeklyBulkActionBar
                    viewMode={viewMode}
                    selectedSessionIds={selectedSessionIds}
                    effectivePlanned={effectivePlanned}
                    handleBulkDateChange={handleBulkDateChange}
                    handleBulkPriority={handleBulkPriority}
                    handleBulkDelete={handleBulkDelete}
                    setSelectedSessionIds={setSelectedSessionIds}
                />
            </div>

        </div>
    );
}
