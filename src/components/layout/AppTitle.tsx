import { useTranslation } from 'react-i18next';
import { Button } from "@/components/ui/button";
import { Plus, MoreHorizontal } from "lucide-react";

interface AppTitleProps {
    dashboardView: 'weekly' | 'daily' | 'pomodoro' | 'statistics';
    setIsAddPomodoroTaskOpen: (isOpen: boolean) => void;
}

export function AppTitle({ dashboardView, setIsAddPomodoroTaskOpen }: AppTitleProps) {
    const { t } = useTranslation();

    return (
        <div className="flex items-center gap-2">
            {dashboardView === 'pomodoro' ? (
                <div className="flex items-center gap-6" style={{ WebkitAppRegion: 'no-drag' } as any}>
                    <span className="text-xs font-bold text-muted-foreground tracking-widest uppercase ml-2">Artisan's Compass</span>
                    <h2 className="text-sm font-bold">{t('dashboard.pomodoro', '포모도로')}</h2>
                    <div className="flex gap-1 text-muted-foreground ml-auto">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 hover:text-foreground"
                            onClick={() => setIsAddPomodoroTaskOpen(true)}
                            style={{ cursor: 'pointer', WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                        >
                            <Plus className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 hover:text-foreground">
                            <MoreHorizontal className="w-3.5 h-3.5" />
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="flex items-center gap-4">
                    <span className="text-xs font-bold text-muted-foreground tracking-widest uppercase ml-2">Artisan's Compass</span>
                    <div id="statistics-tabs-portal" className="flex items-center no-drag" />
                </div>
            )}
        </div>
    );
}
