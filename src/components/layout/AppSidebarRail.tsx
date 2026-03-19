import { useTranslation } from 'react-i18next';
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Settings, CalendarDays, Target, BarChart } from "lucide-react";
import { UpdateChecker } from "./UpdateChecker";
import { NotificationsPopover } from "./NotificationsPopover";
import { useUIExtensions } from "@/core/ArtisansCompassProvider";
import { BaseSidebarItem } from "@/plugins/api/ui";

interface AppSidebarRailProps {
    dashboardView: string;
    onDashboardViewChange: (view: string) => void;
    onOpenSettings: () => void;
}

export function AppSidebarRail({
    dashboardView,
    onDashboardViewChange,
    onOpenSettings
}: AppSidebarRailProps) {
    const { t } = useTranslation();
    const { sidebarItems } = useUIExtensions();

    const topItems = sidebarItems.filter((i: BaseSidebarItem) => i.position === 'top');
    const bottomItems = sidebarItems.filter((i: BaseSidebarItem) => i.position !== 'top');

    return (
        <div className="w-12 h-full shrink-0 flex flex-col items-center py-4 gap-4 border-r border-border/50 bg-muted/10 z-40 overflow-visible relative window-drag">
            {/* View Toggles */}
            <div className="flex flex-col items-center gap-2 w-full mt-2" style={{ WebkitAppRegion: 'no-drag' } as any}>
                <Button
                    variant={dashboardView === 'daily' ? 'secondary' : 'ghost'}
                    size="icon"
                    className="w-10 h-10 shrink-0 rounded-xl transition-all text-muted-foreground hover:text-foreground hover:bg-muted no-drag"
                    onClick={() => {
                        if (dashboardView !== 'daily') onDashboardViewChange('daily');
                    }}
                    title={t('sidebar.dailyView', 'Daily View')}
                >
                    <LayoutDashboard className="w-5 h-5" />
                </Button>
                <Button
                    variant={dashboardView === 'weekly' ? 'secondary' : 'ghost'}
                    size="icon"
                    className="w-10 h-10 shrink-0 rounded-xl transition-all text-muted-foreground hover:text-foreground hover:bg-muted no-drag"
                    onClick={() => {
                        if (dashboardView !== 'weekly') onDashboardViewChange('weekly');
                    }}
                    title={t('sidebar.weeklyView', 'Weekly View')}
                >
                    <CalendarDays className="w-5 h-5" />
                </Button>
                <Button
                    variant={dashboardView === 'pomodoro' ? 'secondary' : 'ghost'}
                    size="icon"
                    className="w-10 h-10 shrink-0 rounded-xl transition-all text-muted-foreground hover:text-foreground hover:bg-muted no-drag"
                    onClick={() => {
                        if (dashboardView !== 'pomodoro') onDashboardViewChange('pomodoro');
                    }}
                    title={t('sidebar.pomodoroView', 'Pomodoro View')}
                >
                    <Target className="w-5 h-5" />
                </Button>
                <Button
                    variant={dashboardView === 'statistics' ? 'secondary' : 'ghost'}
                    size="icon"
                    className="w-10 h-10 shrink-0 rounded-xl transition-all text-muted-foreground hover:text-foreground hover:bg-muted no-drag"
                    onClick={() => {
                        if (dashboardView !== 'statistics') onDashboardViewChange('statistics');
                    }}
                    title={t('sidebar.statistics', 'Statistics')}
                >
                    <BarChart className="w-5 h-5" />
                </Button>

                {/* Injected Top Sidebar Items (Plugins) */}
                {topItems.map((item: BaseSidebarItem) => (
                    <Button
                        key={item.id}
                        variant={dashboardView === item.viewId ? 'secondary' : 'ghost'}
                        size="icon"
                        onClick={() => {
                            if (item.viewId && dashboardView !== item.viewId) {
                                onDashboardViewChange(item.viewId);
                            }
                            item.onClick?.();
                        }}
                        title={item.title}
                        className="w-10 h-10 shrink-0 rounded-xl transition-all text-muted-foreground hover:text-foreground hover:bg-muted no-drag"
                    >
                        {item.icon}
                    </Button>
                ))}
            </div>

            {/* Extracted Buttons from Title Bar */}
            <div className="mt-auto flex flex-col items-center gap-2 w-full pb-2 no-drag" style={{ WebkitAppRegion: 'no-drag' } as any}>
                <UpdateChecker />

                <NotificationsPopover />

                {/* Injected Bottom Sidebar Items (Plugins) */}
                {bottomItems.map((item: BaseSidebarItem) => (
                    <Button
                        key={item.id}
                        variant={dashboardView === item.viewId ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => {
                            if (item.viewId && dashboardView !== item.viewId) {
                                onDashboardViewChange(item.viewId);
                            }
                            item.onClick?.();
                        }}
                        title={item.title}
                        className="w-10 h-10 shrink-0 p-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl"
                    >
                        {item.icon}
                    </Button>
                ))}

                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onOpenSettings}
                    className="w-10 h-10 shrink-0 p-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl"
                >
                    <Settings className="w-5 h-5" />
                </Button>
            </div>
        </div>
    );
}
