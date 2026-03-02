import { Fragment } from 'react';
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export function TimeTableAppUsage({
    sortedApps,
    settings
}: any) {
    const { t } = useTranslation();

    return (
        <Fragment>
            <div className="bg-card/30 rounded-xl p-4 border border-border/40 space-y-3">
                <div className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-1">{t('calendar.appUsage') || 'App Usage'}</div>
                <div className="space-y-2">
                    {sortedApps.map((app: any, i: number) => {
                        const totalMinutes = Math.floor(app.duration / 60);
                        const hours = Math.floor(totalMinutes / 60);
                        const minutes = totalMinutes % 60;

                        const isIgnored = settings?.ignoredApps?.some((ignored: string) =>
                            ignored === app.name ||
                            ignored.toLowerCase() === app.name.toLowerCase() ||
                            ignored.replace(/\s/g, "").toLowerCase() === app.name.replace(/\s/g, "").toLowerCase() ||
                            app.name.toLowerCase().includes(ignored.toLowerCase())
                        );
                        const ignoredColor = settings?.ignoredAppsColor || '#808080';

                        return (
                            <div key={i} className="flex items-center justify-between text-sm group">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div
                                        className={cn(
                                            "w-2 h-2 rounded-full transition-colors shrink-0",
                                            !isIgnored && "bg-blue-500/50 group-hover:bg-blue-500"
                                        )}
                                        style={isIgnored ? { backgroundColor: ignoredColor } : undefined}
                                    />
                                    <span className="truncate text-muted-foreground group-hover:text-foreground transition-colors font-medium" title={app.name}>
                                        {app.name}
                                    </span>
                                </div>
                                <span className="font-mono text-xs text-muted-foreground shrink-0 bg-background/50 px-2 py-0.5 rounded-md border border-border/50">
                                    {hours > 0 && `${hours} h `}
                                    {minutes}m
                                </span>
                            </div>
                        );
                    })}
                    {sortedApps.length === 0 && (
                        <div className="text-xs text-muted-foreground italic py-2 text-center">
                            {t('calendar.noActivity')}
                        </div>
                    )}
                </div>
            </div>
        </Fragment>
    );
}