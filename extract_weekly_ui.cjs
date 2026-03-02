const fs = require('fs');
const path = require('path');

const dir = path.resolve(__dirname, 'src/components/dashboard/weekly');
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
}

// 1. WeeklyHeader.tsx
const headerContent = `import React from 'react';
import { format, addWeeks } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar, Repeat, Settings2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTranslation } from "react-i18next";

interface WeeklyHeaderProps {
    viewMode: 'calendar' | 'routine';
    setViewMode: (mode: 'calendar' | 'routine') => void;
    viewDate: Date;
    showRoutineOverlay: boolean;
    setShowRoutineOverlay: (show: boolean) => void;
    showAppUsage: boolean;
    setShowAppUsage: (show: boolean) => void;
    handlePrevWeek: () => void;
    handleNextWeek: () => void;
    handleToday: () => void;
    settings: any;
}

export function WeeklyHeader({
    viewMode, setViewMode, viewDate,
    showRoutineOverlay, setShowRoutineOverlay,
    showAppUsage, setShowAppUsage,
    handlePrevWeek, handleNextWeek, handleToday,
    settings
}: WeeklyHeaderProps) {
    const { t } = useTranslation();

    return (
        <div className="flex items-center justify-between w-full h-full px-2" style={{ WebkitAppRegion: 'drag' } as any}>
            <div className="flex items-center gap-4" style={{ WebkitAppRegion: 'no-drag' } as any}>
                <div className="flex bg-muted/30 p-1 rounded-lg border border-border/20">
                    <Button
                        variant={viewMode === 'calendar' ? 'secondary' : 'ghost'}
                        size="sm"
                        className="h-7 text-xs px-3"
                        onClick={() => setViewMode('calendar')}
                    >
                        <Calendar className="w-3.5 h-3.5 mr-1.5" />
                        {t('weeklyView.calendarMode')}
                    </Button>
                    <Button
                        variant={viewMode === 'routine' ? 'secondary' : 'ghost'}
                        size="sm"
                        className="h-7 text-xs px-3"
                        onClick={() => setViewMode('routine')}
                    >
                        <Repeat className="w-3.5 h-3.5 mr-1.5" />
                        반복 루틴
                    </Button>
                </div>
            </div>

            <div className="flex items-center gap-3" style={{ WebkitAppRegion: 'no-drag' } as any}>
                {viewMode !== 'routine' && (
                    <h2 className="text-xl font-bold tracking-tight mr-2 whitespace-nowrap" style={{ WebkitAppRegion: 'drag' } as any}>
                        {format(viewDate, 'MMMM yyyy')}
                    </h2>
                )}
                {viewMode === 'calendar' && (
                    <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-0.5 border border-border/20">
                        <Button variant="ghost" size="icon" onClick={handlePrevWeek} className="h-7 w-7 rounded-md hover:bg-background/80">
                            <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={handleToday} className="h-7 text-xs px-3 font-medium rounded-md hover:bg-background/80">
                            {t('weeklyView.today')}
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleNextWeek}
                            className="h-7 w-7 rounded-md hover:bg-background/80"
                            disabled={settings?.lockFutureDates && addWeeks(viewDate, 1) > new Date()}
                        >
                            <ChevronRight className="w-4 h-4" />
                        </Button>
                    </div>
                )}

                {viewMode === 'calendar' && (
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-accent rounded-full">
                                <Settings2 className="w-4 h-4 text-muted-foreground" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-2" align="end">
                            <div className="space-y-2">
                                <div className="font-semibold text-xs text-muted-foreground px-2 py-1">{t('weeklyView.viewOptions', 'View Options')}</div>
                                <div className="flex items-center space-x-2 px-2 py-1.5 hover:bg-accent rounded-sm cursor-pointer" onClick={() => setShowRoutineOverlay(!showRoutineOverlay)}>
                                    <Checkbox
                                        id="routine-overlay"
                                        checked={showRoutineOverlay}
                                        className="h-4 w-4 pointer-events-none"
                                        readOnly
                                    />
                                    <Label htmlFor="routine-overlay" className="text-sm cursor-pointer flex-1 pointer-events-none">
                                        {t('weeklyView.showRoutine', 'Show Repeating Routine')}
                                    </Label>
                                </div>
                                <div className="flex items-center space-x-2 px-2 py-1.5 hover:bg-accent rounded-sm cursor-pointer" onClick={() => setShowAppUsage(!showAppUsage)}>
                                    <Checkbox
                                        id="app-usage"
                                        checked={showAppUsage}
                                        className="h-4 w-4 pointer-events-none"
                                        readOnly
                                    />
                                    <Label htmlFor="app-usage" className="text-sm cursor-pointer flex-1 pointer-events-none">
                                        {t('weeklyView.showAppUsage', 'Show App Usage')}
                                    </Label>
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>
                )}
            </div>
        </div>
    );
}
`;

fs.writeFileSync(path.join(dir, 'WeeklyHeader.tsx'), headerContent);

// 2. WeeklyDayHeaders.tsx
const dayHeadersContent = `import React from 'react';
import { format, isSameDay } from 'date-fns';
import { cn } from "@/lib/utils";

interface WeeklyDayHeadersProps {
    days: Date[];
    viewMode: 'calendar' | 'routine';
}

export function WeeklyDayHeaders({ days, viewMode }: WeeklyDayHeadersProps) {
    return (
        <div className="flex border-b border-border/40 bg-card/30 shrink-0">
            <div className="w-14 shrink-0 border-r border-border/40"></div>
            {days.map(day => (
                <div key={day.toString()} className={cn(
                    "flex-1 py-3 text-center border-r border-border/40 last:border-r-0 transition-colors",
                    viewMode === 'calendar' && isSameDay(day, new Date()) ? "bg-primary/5" : ""
                )}>
                    <div className={cn("text-[10px] font-bold uppercase tracking-wider mb-1", viewMode === 'calendar' && isSameDay(day, new Date()) ? "text-primary" : "text-muted-foreground")}>
                        {format(day, 'EEE')}
                    </div>
                    <div className={cn(
                        "text-xl font-light w-8 h-8 flex items-center justify-center mx-auto rounded-full transition-all",
                        viewMode === 'calendar' && isSameDay(day, new Date()) ? "bg-primary text-primary-foreground shadow-sm scale-110" : "text-foreground/80",
                        viewMode === 'routine' && "invisible"
                    )}>
                        {format(day, 'd')}
                    </div>
                </div>
            ))}
        </div>
    );
}
`;

fs.writeFileSync(path.join(dir, 'WeeklyDayHeaders.tsx'), dayHeadersContent);

// 3. WeeklyBulkActionBar.tsx
const bulkActionContent = `import React from 'react';
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import { Calendar, Clock, ArrowRight, Flag, Tag, Trash, X } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { PlannedSession } from "@/types";

interface WeeklyBulkActionBarProps {
    viewMode: 'calendar' | 'routine';
    selectedSessionIds: Set<string>;
    effectivePlanned: PlannedSession[];
    handleBulkDateChange: (date: Date | undefined) => void;
    handleBulkPriority: (priority: 'high' | 'medium' | 'low' | undefined) => void;
    handleBulkDelete: () => void;
    setSelectedSessionIds: (ids: Set<string>) => void;
}

export function WeeklyBulkActionBar({
    viewMode,
    selectedSessionIds,
    effectivePlanned,
    handleBulkDateChange,
    handleBulkPriority,
    handleBulkDelete,
    setSelectedSessionIds
}: WeeklyBulkActionBarProps) {
    if (selectedSessionIds.size === 0) return null;

    const selectedSessions = effectivePlanned.filter(s => selectedSessionIds.has(s.id));
    const commonPriority = selectedSessions.length > 0 && selectedSessions.every(s => s.priority === selectedSessions[0].priority)
        ? selectedSessions[0].priority
        : undefined;

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground border shadow-lg rounded-xl p-1 flex items-center gap-1 z-50 animate-in slide-in-from-bottom-2 fade-in duration-200">
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-accent rounded-lg" title="Change Date">
                        <Calendar className="w-4 h-4" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" side="top" align="center">
                    <CalendarUI
                        mode="single"
                        disabled={viewMode === 'routine'}
                        onSelect={(date) => handleBulkDateChange(date)}
                        initialFocus
                    />
                </PopoverContent>
            </Popover>
            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-accent rounded-lg" title="Reschedule">
                <Clock className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-accent rounded-lg" title="Move">
                <ArrowRight className="w-4 h-4" />
            </Button>
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className={cn("h-8 w-8 hover:bg-accent rounded-lg",
                        commonPriority ? "text-foreground" : "text-muted-foreground"
                    )} title="Flag">
                        <Flag className={cn("w-4 h-4",
                            commonPriority === 'high' && "fill-red-500 text-red-500",
                            commonPriority === 'medium' && "fill-orange-500 text-orange-500",
                            commonPriority === 'low' && "fill-blue-500 text-blue-500"
                        )} />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-32 p-1" side="top">
                    <div className="flex flex-col gap-1">
                        <Button variant="ghost" size="sm" className="justify-start h-7 px-2 text-xs" onClick={() => handleBulkPriority('high')}>
                            <Flag className="w-3 h-3 mr-2 text-red-500 fill-red-500" />
                            높음
                        </Button>
                        <Button variant="ghost" size="sm" className="justify-start h-7 px-2 text-xs" onClick={() => handleBulkPriority('medium')}>
                            <Flag className="w-3 h-3 mr-2 text-orange-500 fill-orange-500" />
                            중간
                        </Button>
                        <Button variant="ghost" size="sm" className="justify-start h-7 px-2 text-xs" onClick={() => handleBulkPriority('low')}>
                            <Flag className="w-3 h-3 mr-2 text-blue-500 fill-blue-500" />
                            낮음
                        </Button>
                        <Button variant="ghost" size="sm" className="justify-start h-7 px-2 text-xs" onClick={() => handleBulkPriority(undefined)}>
                            <Flag className="w-3 h-3 mr-2 opacity-50" />
                            없음
                        </Button>
                    </div>
                </PopoverContent>
            </Popover>
            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-accent rounded-lg" title="Tag">
                <Tag className="w-4 h-4" />
            </Button>
            <div className="w-[1px] h-4 bg-border mx-1" />
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg" onClick={handleBulkDelete} title="Delete">
                <Trash className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-accent rounded-lg" onClick={() => setSelectedSessionIds(new Set())} title="Cancel Selection">
                <X className="w-4 h-4" />
            </Button>
        </div>
    );
}
`;

fs.writeFileSync(path.join(dir, 'WeeklyBulkActionBar.tsx'), bulkActionContent);

// 4. WeeklySessionCard.tsx
const sessionCardContent = `import React from 'react';
import { format, addMinutes } from 'date-fns';
import { Pencil, Trash, Flag, MapPin, Bell } from 'lucide-react';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import { PlannedSession } from "@/types";

interface WeeklySessionCardProps {
    session: any;
    layout: { left: number; width: number };
    isDragPreview: boolean;
    isSelected: boolean;
    isEditing: boolean;
    dayStartMs: number;
    startDrag: (e: React.MouseEvent, type: 'move' | 'resize', session: PlannedSession) => void;
    handleDeletePlan: (id: string) => void;
    setSelectedPlan: (plan: Partial<PlannedSession>) => void;
    setIsEditorOpen: (open: boolean) => void;
    setPopoverPosition: (pos: { x: number, y: number } | null) => void;
}

export function WeeklySessionCard({
    session,
    layout,
    isDragPreview,
    isSelected,
    isEditing,
    dayStartMs,
    startDrag,
    handleDeletePlan,
    setSelectedPlan,
    setIsEditorOpen,
    setPopoverPosition
}: WeeklySessionCardProps) {
    const startMins = (session.segmentStart - dayStartMs) / 60000;
    const top = (startMins / 1440) * 100;
    const heightStr = \`\${(session.segmentDuration / 60 / 1440) * 100}%\`;

    const displayStart = new Date(session.originalStart);
    const displayEnd = addMinutes(displayStart, session.originalDuration / 60);

    return (
        <ContextMenu>
            <ContextMenuTrigger>
                <div
                    data-session-id={session.id}
                    className={cn(
                        "absolute rounded-sm text-[10px] px-2 flex flex-col justify-center overflow-hidden transition-colors cursor-pointer z-10 backdrop-blur-[1px] group/plan select-none border border-b-2",
                        !session.isEnd && "rounded-b-none border-b-transparent shadow-none",
                        !session.isStart && "rounded-t-none border-t-transparent pt-0",
                        session.isCompleted ? "opacity-60 bg-muted/40 border-muted" : "",
                        isDragPreview && "opacity-80 ring-2 ring-primary border-primary animate-pulse z-[40] pointer-events-none",
                        isSelected && "ring-2 ring-primary ring-offset-1 z-20",
                        isEditing && "ring-2 ring-primary z-30 shadow-lg",
                        !session.isCompleted && (!session.color || session.color === 'blue') && "bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-300 hover:bg-blue-500/20 hover:border-blue-500/40",
                        !session.isCompleted && session.color === 'green' && "bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-300 hover:bg-green-500/20 hover:border-green-500/40",
                        !session.isCompleted && session.color === 'orange' && "bg-orange-500/10 border-orange-500/20 text-orange-700 dark:text-orange-300 hover:bg-orange-500/20 hover:border-orange-500/40",
                        !session.isCompleted && session.color === 'purple' && "bg-purple-500/10 border-purple-500/20 text-purple-700 dark:text-purple-300 hover:bg-purple-500/20 hover:border-purple-500/40",
                    )}
                    style={{
                        top: \`\${top}%\`,
                        height: heightStr,
                        left: \`\${layout.left}%\`,
                        width: \`\${layout.width}%\`,
                        zIndex: isDragPreview ? 40 : 10 + Math.round(layout.left)
                    }}
                    onMouseDown={(e) => {
                        const container = document.getElementById('weekly-view-container');
                        if (container) {
                            const dayColumn = (e.currentTarget as HTMLElement).closest('[data-day]');
                            if (dayColumn) {
                                if (e.button === 0) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    startDrag(e as unknown as React.MouseEvent, 'move', session);
                                }
                            }
                        }
                    }}
                >
                    {session.isStart && (
                        <div className="font-semibold truncate text-foreground group-hover/plan:whitespace-normal leading-tight select-none flex items-center gap-1">
                            {session.priority === 'high' && <Flag className="w-3 h-3 text-red-500 fill-red-500 flex-shrink-0" />}
                            {session.priority === 'medium' && <Flag className="w-3 h-3 text-orange-500 fill-orange-500 flex-shrink-0" />}
                            {session.priority === 'low' && <Flag className="w-3 h-3 text-blue-500 fill-blue-500 flex-shrink-0" />}
                            {session.alert !== undefined && <Bell className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
                            {session.location && <MapPin className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
                            <span className="truncate">{session.title}</span>
                        </div>
                    )}

                    {session.isStart && (
                        <div className="truncate opacity-70 text-foreground/70 text-[9px] mt-0.5 select-none font-mono">
                            {format(displayStart, 'HH:mm')} - {format(displayEnd, 'HH:mm')}
                            {Math.round(layout.width) > 30 && (
                                <span className="ml-1 opacity-70">
                                    ({Math.floor(session.originalDuration / 3600) > 0 ? \`\${Math.floor(session.originalDuration / 3600)}h \` : ''}{Math.round((session.originalDuration % 3600) / 60)}m)
                                </span>
                            )}
                        </div>
                    )}

                    {session.isEnd && (
                        <div
                            className="absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize hover:bg-primary/40 transition-colors bg-transparent"
                            onMouseDown={(e) => {
                                const container = document.getElementById('weekly-view-container');
                                if (container) {
                                    const dayColumn = (e.currentTarget as HTMLElement).closest('[data-day]');
                                    if (dayColumn) {
                                        if (e.button === 0) {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            startDrag(e as unknown as React.MouseEvent, 'resize', session);
                                        }
                                    }
                                }
                            }}
                        />
                    )}
                </div>
            </ContextMenuTrigger>
            {!isDragPreview && (
                <ContextMenuContent className="w-40">
                    <ContextMenuItem onSelect={() => {
                        const element = document.querySelector(\`[data-session-id="\${session.id}"]\`);
                        if (element) {
                            const rect = element.getBoundingClientRect();
                            const container = document.getElementById('weekly-view-container');
                            const containerRect = container ? container.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth };

                            let x = (rect.right - containerRect.left) - 4;
                            if (x + 340 > containerRect.width) x = (rect.left - containerRect.left) - 340;
                            setPopoverPosition({ x: Math.max(0, x), y: rect.top - containerRect.top });
                        }
                        setSelectedPlan(session);
                        setIsEditorOpen(true);
                    }}>
                        <Pencil className="mr-2 h-3.5 w-3.5" />
                        Edit
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem
                        className="text-red-500 focus:text-red-500 focus:bg-red-50 dark:focus:bg-red-950/20"
                        onSelect={() => handleDeletePlan(session.id!)}
                    >
                        <Trash className="mr-2 h-3.5 w-3.5" />
                        Delete
                    </ContextMenuItem>
                </ContextMenuContent>
            )}
        </ContextMenu>
    ); // end return
}
`;

fs.writeFileSync(path.join(dir, 'WeeklySessionCard.tsx'), sessionCardContent);

console.log('UI Components created in src/components/dashboard/weekly/');
