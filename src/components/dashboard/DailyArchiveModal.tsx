import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { DailyArchiveView } from "./DailyArchiveView";
import { useDataStore } from "@/hooks/useDataStore";
import { useEffect, useState } from "react";
import { format, addDays } from "date-fns";
import { Moon, ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DailyArchiveModalProps {
    date: Date;
    isOpen: boolean;
    onClose: () => void;
    onDateChange?: (date: Date) => void;
}

export function DailyArchiveModal({ date, isOpen, onClose, onDateChange }: DailyArchiveModalProps) {
    const { getDailyLog, settings } = useDataStore();
    const [logData, setLogData] = useState<any>(null);
    const formattedDate = format(date, 'yyyy-MM-dd');

    // Mock Data for UI Testing
    const MOCK_DATA = {
        todos: [],
        screenshots: [],
        sessions: [],
        stats: {
            totalWorkSeconds: 0,
            questAchieved: false
        }
    };

    useEffect(() => {
        if (isOpen) {
            getDailyLog(formattedDate).then(data => {
                setLogData(data || MOCK_DATA);
            });
        }
    }, [isOpen, formattedDate, getDailyLog]);

    // Keyboard Navigation
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft' && onDateChange) {
                onDateChange(addDays(date, -1));
            } else if (e.key === 'ArrowRight' && onDateChange) {
                // Prevent going to future? Assuming future is allowed in calendar logic but maybe empty.
                // Parent logic ensures we don't go past today if we want, but let's allow navigation freely here.
                onDateChange(addDays(date, 1));
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, date, onDateChange]);


    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent hideCloseButton className="sm:max-w-[1400px] bg-card border-border shadow-2xl rounded-2xl overflow-hidden p-0 gap-0 w-full h-[90vh] flex flex-col font-sans mb-8">
                {/* Header - Matching ClosingRitualModal Theme (Lighter/Minimal) */}
                <div className="bg-muted/30 text-foreground px-8 py-4 flex items-center justify-between shrink-0 h-16 border-b border-border/50">
                    <div className="flex items-center gap-4">
                        <div className="bg-primary/10 p-1.5 rounded-lg border border-primary/20">
                            <Moon className="w-4 h-4 text-primary" />
                        </div>
                        <DialogTitle className="text-lg font-medium tracking-tight text-foreground">
                            Daily Archive
                        </DialogTitle>
                    </div>

                    {/* Date Navigation */}
                    {onDateChange && (
                        <div className="flex items-center gap-2 bg-background border border-border rounded-lg p-1 shadow-sm">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDateChange(addDays(date, -1))}>
                                <ArrowLeft className="w-4 h-4" />
                            </Button>
                            <span className="text-sm font-mono font-medium min-w-[120px] text-center">
                                {format(date, 'MMM dd, yyyy')}
                            </span>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDateChange(addDays(date, 1))}>
                                <ArrowRight className="w-4 h-4" />
                            </Button>
                        </div>
                    )}
                </div>

                {/* Body */}
                <div className="flex-1 bg-background/50 overflow-hidden relative">
                    {logData ? (
                        <DailyArchiveView
                            date={date}
                            todos={logData.todos || []}
                            screenshots={logData.screenshots || []}
                            sessions={logData.sessions || []}
                            stats={{
                                totalSeconds: logData.stats?.totalWorkSeconds || 0,
                                questAchieved: logData.stats?.questAchieved || false
                            }}
                            timelapseDurationSeconds={settings?.timelapseDurationSeconds || 5}
                            checkboxVisibility={settings?.checkboxVisibility || 'high'}
                            className="bg-card h-full"
                            onClose={onClose}
                        />
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                            <p>Loading journey data...</p>
                        </div>
                    )}


                </div>
            </DialogContent>
        </Dialog>
    );
}

// Check types.ts again. DailyLog interface has 'assets' (Step 148).
// storage.ts interface has 'screenshots' (Step 56/49).
// I should align types.ts to use 'screenshots' or map it.
// I will check storage.ts again if possible, or just use `logData.screenshots || logData.assets || []`.

// Also DailyLog in types.ts has `stats: { totalWorkSeconds: ... }`.
// In ClosingRitualModal I used `totalSeconds` because `currentStats` (from App.tsx/store) likely uses `totalSeconds`.
// I need to be careful with property names.
