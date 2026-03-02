import { format } from "date-fns";
import { Eraser } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Project } from "@/types";

interface DailyHeaderProps {
    isWidgetMode: boolean;
    activeProjectId: string;
    setActiveProjectId: (id: string) => void;
    projects: Project[];
    clearUntitledTodos: () => void;
    isPinned: boolean;
    togglePin: () => void;
}

export function DailyHeader({
    isWidgetMode, activeProjectId, setActiveProjectId, projects, clearUntitledTodos, isPinned, togglePin
}: DailyHeaderProps) {
    const { t } = useTranslation();

    if (isWidgetMode) return null;

    return (
        <div className="flex items-end justify-between mb-6 px-1 shrink-0">
            <div className="flex items-end gap-2">
                <div>
                    <h2 className="text-2xl font-bold text-foreground tracking-tight cursor-pointer hover:text-muted-foreground transition-colors flex items-center gap-2 whitespace-nowrap">
                        {t('dashboard.todayFocus')}
                    </h2>
                    <p className="text-sm text-muted-foreground font-medium mt-1 truncate max-w-[120px] sm:max-w-none">{format(new Date(), 'MMM dd, yyyy')}</p>
                </div>
            </div>

            <div className="flex items-center gap-3">
                <div className="relative">
                    <Select value={activeProjectId} onValueChange={setActiveProjectId}>
                        <SelectTrigger className="w-[180px] sm:w-[220px]">
                            <SelectValue placeholder={t('dashboard.selectProject')} />
                        </SelectTrigger>
                        <SelectContent>
                            {projects.length === 0 && <SelectItem value="none">No Project</SelectItem>}
                            {projects.map(p => (
                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex items-center gap-1">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 text-muted-foreground hover:text-foreground"
                                onClick={() => clearUntitledTodos()}
                            >
                                <Eraser className="w-[18px] h-[18px]" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>{t('dashboard.clearUntitled')}</p>
                        </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className={cn("h-9 w-9 transition-all", isPinned ? "text-primary bg-primary/10 rotate-45" : "text-muted-foreground hover:text-foreground")}
                                onClick={togglePin}
                            >
                                <span className="sr-only">Pin</span>
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-pin"><line x1="12" x2="12" y1="17" y2="22" /><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" /></svg>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>{isPinned ? t('dashboard.unpin') : t('dashboard.pin')}</p>
                        </TooltipContent>
                    </Tooltip>
                </div>
            </div>
        </div>
    );
}
