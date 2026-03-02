import { Fragment } from 'react';
import { format, differenceInMinutes, isSameDay, getDay } from 'date-fns';
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ContextMenu, ContextMenuContent, ContextMenuTrigger, ContextMenuSeparator, ContextMenuItem, ContextMenuCheckboxItem } from "@/components/ui/context-menu";
import { Settings2, Briefcase } from "lucide-react";

export function TimeTableGrid({
    sessionBlocks,
    TOTAL_MINUTES,
    TOTAL_HOURS,
    date,
    now,
    firstOpenedAt,
    nightTimeStart,
    appSessions,
    plannedSessions,
    settings,
    renderMode,
    onUpdateSettings,
    toggleWorkFilter,
    openModal
}: any) {
    const { t } = useTranslation();

    return (
        <Fragment>
            <ContextMenu>
                <ContextMenuTrigger className="flex-1 relative mx-2 my-3 block">
                    {/* Subtle Grid Lines & Labels */}
                    {Array.from({ length: Math.ceil(TOTAL_HOURS / 2) + 1 }, (_, i) => i * 2).map(h => (
                        <div
                            key={h}
                            className="absolute w-full flex items-center group pointer-events-none"
                            style={{ top: `${(h / TOTAL_HOURS) * 100}% `, transform: 'translateY(-50%)' }}
                        >
                            {/* Time Label */}
                            <div className="w-8 text-right pr-1">
                                <span className="text-[10px] text-muted-foreground/40 font-mono tabular-nums block">
                                    {h === 0 ? '00:00' : (
                                        h < 24
                                            ? `${h.toString().padStart(2, '0')}:00`
                                            : `+ ${(h - 24).toString().padStart(2, '0')}:00` // Show +01:00 for extended time
                                    )}
                                </span>
                            </div>
                            {/* Line */}
                            <div className="flex-1 border-t border-border/20 w-full" />
                        </div>
                    ))}

                    {/* Vertical Divider Line */}
                    <div className="absolute top-0 bottom-0 left-8 border-l border-border/20 h-full pointer-events-none"></div>

                    {/* Current Time Indicator */}
                    {(() => {
                        if (settings?.showCurrentTimeIndicator === false) return null;

                        const d = date ? new Date(date) : new Date(now);
                        d.setHours(0, 0, 0, 0);
                        const diffMins = differenceInMinutes(now, d);
                        const isNextDay = diffMins >= TOTAL_MINUTES;

                        const shouldShow = diffMins >= 0 && (
                            diffMins < TOTAL_MINUTES ||
                            (settings?.dailyRecordMode === 'dynamic' && renderMode === 'dynamic' && diffMins < TOTAL_MINUTES * 2)
                        );

                        if (!shouldShow) return null;

                        const displayMins = isNextDay ? diffMins - TOTAL_MINUTES : diffMins;
                        const topPct = (displayMins / TOTAL_MINUTES) * 100;

                        return (
                            <div
                                className="absolute left-8 right-0 z-20 pointer-events-auto flex items-center group cursor-help"
                                style={{
                                    top: `${topPct}% `,
                                    transform: 'translateY(-50%)'
                                }}
                            >
                                <div className="w-full border-t-2 border-red-500/50 border-dashed" />
                                <div className="absolute -left-1 -translate-x-1/2 w-4 h-4 flex items-center justify-center">
                                    <div className="w-2 h-2 bg-red-500 rounded-full" />
                                    <div className="absolute left-full ml-1 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500/10 backdrop-blur px-1.5 py-0.5 rounded text-[9px] font-bold text-red-500 font-mono border border-red-500/20 shadow-sm uppercase tracking-wider whitespace-nowrap pointer-events-none z-50">
                                        {format(d, 'HH:mm')} {t('calendar.currentTime') || "Current"}
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    {/* First Open Time Indicator */}
                    {(() => {
                        if (!firstOpenedAt || settings?.showFirstLaunchIndicator === false) return null;
                        const d = date ? new Date(date) : new Date(now);
                        d.setHours(0, 0, 0, 0);

                        const openDate = new Date(firstOpenedAt);
                        if (!isSameDay(openDate, d)) return null;

                        const diffMins = differenceInMinutes(openDate, d);
                        if (diffMins < 0 || diffMins > TOTAL_MINUTES) return null;
                        const topPct = (diffMins / TOTAL_MINUTES) * 100;

                        return (
                            <div
                                className="absolute left-8 right-0 z-20 pointer-events-auto flex items-center group cursor-help"
                                style={{
                                    top: `${topPct}% `,
                                    transform: 'translateY(-50%)'
                                }}
                            >
                                <div className="w-full border-t border-primary/50 border-dashed" />
                                <div className="absolute -left-1 -translate-x-1/2 w-4 h-4 flex items-center justify-center">
                                    <div className="w-2 h-2 bg-background border-2 border-primary rounded-full" />
                                    <div className="absolute left-full ml-1 opacity-0 group-hover:opacity-100 transition-opacity bg-primary/10 backdrop-blur px-1.5 py-0.5 rounded text-[9px] font-bold text-primary font-mono border border-primary/20 shadow-sm uppercase tracking-wider whitespace-nowrap pointer-events-none z-50">
                                        {format(openDate, 'HH:mm')} {t('calendar.firstLaunch') || "First Launch"}
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    {/* Night Time Start Indicator */}
                    {(() => {
                        if (nightTimeStart === undefined) return null;

                        const nightMins = nightTimeStart * 60;
                        if (nightMins < 0 || nightMins > TOTAL_MINUTES) return null;

                        const topPct = (nightMins / TOTAL_MINUTES) * 100;

                        return (
                            <div
                                className="absolute left-8 right-0 z-10 pointer-events-auto flex items-center group cursor-help"
                                style={{
                                    top: `${topPct}% `,
                                    transform: 'translateY(-50%)'
                                }}
                            >
                                <div className="w-full border-t border-indigo-500/40 border-dashed" />
                                <div className="absolute -left-1 -translate-x-1/2 w-4 h-4 flex items-center justify-center">
                                    <div className="w-2 h-2 bg-background border-2 border-indigo-500/80 rounded-full" />
                                    <div className="absolute left-full ml-1 opacity-0 group-hover:opacity-100 transition-opacity bg-indigo-500/10 backdrop-blur px-1.5 py-0.5 rounded text-[9px] font-bold text-indigo-500 font-mono border border-indigo-500/20 shadow-sm uppercase tracking-wider whitespace-nowrap pointer-events-none z-50">
                                        {`${nightTimeStart.toString().padStart(2, '0')}:00`} {t('settings.timeline.nightTimeStart') || "Night Time"}
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    {/* App Sessions Track */}
                    {appSessions && appSessions.length > 0 && settings?.showAppOnOffIndicator !== false && (
                        <div className="absolute top-0 bottom-0 left-8 right-0 pointer-events-none z-[5]">
                            {appSessions.map((appSession: any, i: number) => {
                                const startDate = new Date(appSession.start);
                                const endDate = new Date(appSession.end);
                                const viewDate = date ? new Date(date) : new Date(now);
                                viewDate.setHours(0, 0, 0, 0);

                                const startMins = differenceInMinutes(startDate, viewDate);
                                const endMins = differenceInMinutes(endDate, viewDate);

                                const renderLine = (mins: number, d: Date, label: string) => {
                                    if (mins < 0 || mins > TOTAL_MINUTES) return null;
                                    const topPct = (mins / TOTAL_MINUTES) * 100;
                                    return (
                                        <div
                                            key={`${i}-${label}`}
                                            className="absolute left-0 right-0 z-20 pointer-events-auto flex items-center group cursor-help"
                                            style={{
                                                top: `${topPct}% `,
                                                transform: 'translateY(-50%)'
                                            }}
                                        >
                                            <div className="w-full border-t border-primary/40 border-dashed" />
                                            <div className="absolute -left-1 -translate-x-1/2 w-4 h-4 flex items-center justify-center">
                                                <div className="w-2 h-2 bg-background border-2 border-primary/70 rounded-full" />
                                                <div className="absolute left-full ml-1 opacity-0 group-hover:opacity-100 transition-opacity bg-primary/10 backdrop-blur px-1.5 py-0.5 rounded text-[9px] font-bold text-primary font-mono border border-primary/20 shadow-sm uppercase tracking-wider whitespace-nowrap pointer-events-none z-50">
                                                    {format(d, 'HH:mm')} {label}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                };

                                return (
                                    <Fragment key={`app-session-${i}`}>
                                        {renderLine(startMins, startDate, t('calendar.appStarted') || "App Started")}
                                        {endMins - startMins > 1 && renderLine(endMins, endDate, t('calendar.appClosed') || "App Closed")}
                                    </Fragment>
                                );
                            })}
                        </div>
                    )}

                    {/* GHOST LAYER (Routine + Planned) */}
                    <div className="absolute top-0 bottom-0 left-8 right-0 pointer-events-none z-0">
                        {(() => {
                            const ghostBlocks: any[] = [];
                            if (settings?.weeklyRoutine && date && settings?.showRoutinesInTimetable !== false) {
                                const currentDay = getDay(date);
                                settings.weeklyRoutine
                                    .filter((r: any) => r.dayOfWeek === currentDay)
                                    .forEach((r: any) => {
                                        ghostBlocks.push({
                                            startMins: Math.floor(r.startSeconds / 60),
                                            durationMins: Math.floor(r.durationSeconds / 60),
                                            title: r.title,
                                            color: r.color,
                                            source: 'routine'
                                        });
                                    });
                            }
                            if (plannedSessions) {
                                plannedSessions.forEach((p: any) => {
                                    const d = new Date(p.start);
                                    if (date && !isSameDay(d, date)) return;
                                    const startMins = d.getHours() * 60 + d.getMinutes();
                                    ghostBlocks.push({
                                        startMins,
                                        durationMins: Math.floor(p.duration / 60),
                                        title: p.title,
                                        color: p.color,
                                        source: 'plan'
                                    });
                                });
                            }

                            return ghostBlocks.map((block, i) => {
                                const startPercentage = (block.startMins / TOTAL_MINUTES) * 100;
                                const endPercentage = ((block.startMins + block.durationMins) / TOTAL_MINUTES) * 100;
                                const heightPercentage = endPercentage - startPercentage;

                                if (startPercentage > 100) return null;

                                const isSplitView = renderMode === 'dynamic' && plannedSessions && plannedSessions.length > 0;
                                const widthStyle = isSplitView ? '50%' : undefined;
                                const rightStyle = isSplitView ? undefined : '1rem';

                                return (
                                    <div
                                        key={`ghost-${i}`}
                                        className={cn(
                                            "absolute left-0 rounded-sm border-2 border-dashed flex flex-col justify-center px-2 overflow-hidden opacity-30",
                                            !block.color && "bg-muted border-foreground/20 text-foreground",
                                            block.color === 'blue' && "bg-blue-500/20 border-blue-500/50 text-blue-700 dark:text-blue-300",
                                            block.color === 'green' && "bg-green-500/20 border-green-500/50 text-green-700 dark:text-green-300",
                                            block.color === 'orange' && "bg-orange-500/20 border-orange-500/50 text-orange-700 dark:text-orange-300",
                                            block.color === 'purple' && "bg-purple-500/20 border-purple-500/50 text-purple-700 dark:text-purple-300",
                                        )}
                                        style={{
                                            top: `${startPercentage}% `,
                                            height: `${heightPercentage}% `,
                                            width: widthStyle,
                                            right: rightStyle
                                        }}
                                    >
                                        <div className="font-semibold text-[10px] truncate opacity-100 flex items-center gap-1">
                                            {block.source === 'routine' && <span className="text-[8px] uppercase tracking-tighter opacity-70">[R]</span>}
                                            {block.source === 'plan' && <span className="text-[8px] uppercase tracking-tighter opacity-70">[P]</span>}
                                            {block.title}
                                        </div>
                                    </div>
                                );
                            });
                        })()}
                    </div>

                    <div className="absolute top-0 bottom-0 left-8 right-0">
                        <TooltipProvider delayDuration={0}>
                            {sessionBlocks.map((block: any, i: number) => (
                                <ContextMenu key={i}>
                                    <ContextMenuTrigger>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <div
                                                    className={cn(
                                                        "absolute rounded-sm transition-colors cursor-pointer z-10 flex flex-col justify-center px-2 overflow-hidden",
                                                        !block.color && !block.isNightTime && "bg-primary/80 text-primary-foreground",
                                                        block.isNightTime && "bg-yellow-500/90 dark:bg-yellow-600/90 text-yellow-950 dark:text-yellow-100"
                                                    )}
                                                    style={{
                                                        top: block.top,
                                                        height: block.height,
                                                        left: block.left,
                                                        width: block.width,
                                                        backgroundColor: block.isNightTime ? undefined : (block.color || undefined)
                                                    }}
                                                >
                                                    {block.isNightTime && (
                                                        <div className="absolute top-1 right-1 z-20 opacity-100 drop-shadow-md">
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none" className="text-yellow-950 dark:text-yellow-100"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" /></svg>
                                                        </div>
                                                    )}
                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent side="right" className="flex flex-col gap-0.5 bg-background/95 backdrop-blur border-border p-3 shadow-xl z-50 min-w-[180px]">
                                                <p className="font-bold text-sm text-foreground mb-1">{block.title}</p>
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                                                    <span className="font-mono">{block.timeRange}</span>
                                                    <span>•</span>
                                                    <span>{block.duration}</span>
                                                </div>
                                                {Object.keys(block.appDistribution).length > 0 && (
                                                    <div className="flex flex-col gap-1 border-t border-border/50 pt-2 mt-1">
                                                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Apps in this block</span>
                                                        {Object.entries(block.appDistribution)
                                                            .sort(([, a], [, b]) => (b as number) - (a as number))
                                                            .map(([appName, duration]) => {
                                                                const d = duration as number;
                                                                const m = Math.floor(d / 60);
                                                                const s = d % 60;
                                                                const durStr = m > 0 ? `${m} m` : `${s} s`;
                                                                return (
                                                                    <div key={appName} className="flex justify-between items-center text-xs">
                                                                        <span className="truncate max-w-[120px] text-muted-foreground/80" title={appName}>{appName}</span>
                                                                        <span className="font-mono text-[10px] opacity-70 ml-2">{durStr}</span>
                                                                    </div>
                                                                );
                                                            })}
                                                    </div>
                                                )}
                                            </TooltipContent>
                                        </Tooltip>
                                    </ContextMenuTrigger>
                                    <ContextMenuContent className="w-64">
                                        <ContextMenuCheckboxItem
                                            checked={!settings?.timelineGridMode || settings?.timelineGridMode === '15min'}
                                            onCheckedChange={(checked) => {
                                                onUpdateSettings?.({ ...settings!, timelineGridMode: checked ? '15min' : 'continuous' });
                                            }}
                                        >
                                            {t('settings.timeline.gridMode')}
                                        </ContextMenuCheckboxItem>
                                        <ContextMenuSeparator />
                                        <ContextMenuCheckboxItem
                                            checked={settings?.filterTimelineByWorkApps}
                                            onCheckedChange={toggleWorkFilter}
                                        >
                                            {t('settings.timeline.filterWorkApps')}
                                        </ContextMenuCheckboxItem>
                                        <ContextMenuSeparator />
                                        <ContextMenuCheckboxItem
                                            checked={settings?.showPlannedSessions}
                                            onCheckedChange={(checked) => {
                                                onUpdateSettings?.({ ...settings!, showPlannedSessions: checked });
                                            }}
                                        >
                                            {t('settings.timeline.showPlannedSessions')}
                                        </ContextMenuCheckboxItem>
                                        <ContextMenuSeparator />
                                        <ContextMenuItem
                                            onSelect={() => openModal('work', block)}
                                            className="gap-2 cursor-pointer"
                                        >
                                            <Briefcase className="w-4 h-4" />
                                            {t('settings.timeline.configureWorkApps')}
                                        </ContextMenuItem>
                                        <ContextMenuItem
                                            onSelect={() => openModal('ignored', block)}
                                            className="gap-2 cursor-pointer"
                                        >
                                            <Settings2 className="w-4 h-4" />
                                            {t('settings.timeline.configureIgnoredApps')}
                                        </ContextMenuItem>
                                    </ContextMenuContent>
                                </ContextMenu>
                            ))}
                        </TooltipProvider>
                    </div>
                </ContextMenuTrigger>
                <ContextMenuContent className="w-64">
                    <ContextMenuCheckboxItem
                        checked={!settings?.timelineGridMode || settings?.timelineGridMode === '15min'}
                        onCheckedChange={(checked) => {
                            onUpdateSettings?.({ ...settings!, timelineGridMode: checked ? '15min' : 'continuous' });
                        }}
                    >
                        {t('settings.timeline.gridMode')}
                    </ContextMenuCheckboxItem>
                    <ContextMenuSeparator />
                    <ContextMenuCheckboxItem
                        checked={settings?.filterTimelineByWorkApps}
                        onCheckedChange={toggleWorkFilter}
                    >
                        {t('settings.timeline.filterWorkApps')}
                    </ContextMenuCheckboxItem>
                    <ContextMenuSeparator />
                    <ContextMenuCheckboxItem
                        checked={settings?.showPlannedSessions}
                        onCheckedChange={(checked) => {
                            onUpdateSettings?.({ ...settings!, showPlannedSessions: checked });
                        }}
                    >
                        {t('settings.timeline.showPlannedSessions')}
                    </ContextMenuCheckboxItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem
                        onSelect={() => openModal('work')}
                        className="gap-2 cursor-pointer"
                    >
                        <Briefcase className="w-4 h-4" />
                        {t('settings.timeline.configureWorkApps')}
                    </ContextMenuItem>
                    <ContextMenuItem
                        onSelect={() => openModal('ignored')}
                        className="gap-2 cursor-pointer"
                    >
                        <Settings2 className="w-4 h-4" />
                        {t('settings.timeline.configureIgnoredApps')}
                    </ContextMenuItem>
                </ContextMenuContent>
            </ContextMenu>
        </Fragment>
    );
}