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
