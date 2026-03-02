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
