import { useTranslation } from 'react-i18next';
import { Button } from "@/components/ui/button";
import { Plus, MoreHorizontal } from "lucide-react";

interface AppTitleProps {
    dashboardView: string;
    setIsAddPomodoroTaskOpen: (isOpen: boolean) => void;
}

export function AppTitle({ dashboardView, setIsAddPomodoroTaskOpen }: AppTitleProps) {
    const { t } = useTranslation();

    return (
        <div className="flex items-center h-full shrink-0">
            {/* Universal App Brand */}
            <span className="text-xs font-bold text-muted-foreground tracking-widest uppercase ml-2 mr-6 shrink-0 flex items-center h-full">
                Artisan's Compass
            </span>

            {/* Contextual Area - All views align identically next to the brand */}
            {dashboardView === 'pomodoro' && (
                <div className="flex items-center gap-4 shrink-0" style={{ WebkitAppRegion: 'no-drag' } as any}>
                    <h2 className="text-sm font-bold text-foreground">{t('dashboard.pomodoro', '포모도로')}</h2>
                    <div className="flex gap-1 text-muted-foreground">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 hover:text-foreground no-drag"
                            onClick={() => setIsAddPomodoroTaskOpen(true)}
                            style={{ cursor: 'pointer' } as React.CSSProperties}
                        >
                            <Plus className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 hover:text-foreground no-drag">
                            <MoreHorizontal className="w-3.5 h-3.5" />
                        </Button>
                    </div>
                </div>
            )}

            <div id="statistics-tabs-portal" className="flex items-center h-full no-drag" />
        </div>
    );
}

