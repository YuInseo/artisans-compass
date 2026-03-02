import React from 'react';
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
    const heightStr = `${(session.segmentDuration / 60 / 1440) * 100}%`;

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
                        top: `${top}%`,
                        height: heightStr,
                        left: `${layout.left}%`,
                        width: `${layout.width}%`,
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
                                    ({Math.floor(session.originalDuration / 3600) > 0 ? `${Math.floor(session.originalDuration / 3600)}h ` : ''}{Math.round((session.originalDuration % 3600) / 60)}m)
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
                        const element = document.querySelector(`[data-session-id="${session.id}"]`);
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
