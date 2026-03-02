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
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground border shadow-lg rounded-xl p-1 flex items-center gap-1 z-50 animate-in fade-in zoom-in-95 duration-200">
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
            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-accent rounded-lg" title="Reschedule" onClick={() => alert('시간 변경 기능은 아직 준비 중입니다.')}>
                <Clock className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-accent rounded-lg" title="Move" onClick={() => alert('이동 기능은 아직 준비 중입니다.')}>
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
            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-accent rounded-lg" title="Tag" onClick={() => alert('태그 기능은 아직 준비 중입니다.')}>
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
