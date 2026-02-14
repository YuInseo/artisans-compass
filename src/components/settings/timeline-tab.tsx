
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import * as SliderPrimitive from "@radix-ui/react-slider"

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { X, ChevronDown, ChevronUp } from "lucide-react";
import { AppSettings, AppInfo } from "@/types"
import { useState, useEffect, useCallback } from "react"
import { cn } from "@/lib/utils"
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useDataStore } from "@/hooks/useDataStore";
import { useTodoStore } from "@/hooks/useTodoStore";
// @ts-ignore
import { DebouncedColorPicker } from "@/components/ui/debounced-color-picker"

interface TimelineTabProps {
    settings: AppSettings;
    onSaveSettings: (settings: AppSettings) => Promise<void>;
    runningApps: AppInfo[];
}




function NightTimeSlider({ value, onChange, onCommit, snapInterval = 30 }: { value: number, onChange: (val: number) => void, onCommit: (val: number) => void, snapInterval?: number }) {

    const min = 18;
    const max = 29; // Extended to 05:00 for better coverage
    const tickInterval = 0.5; // 30 minutes for ticks
    const step = snapInterval / 60; // Dynamic step based on snap interval

    const formatTime = (val: number) => {
        const normalized = val >= 24 ? val - 24 : val;
        const h = Math.floor(normalized);
        const m = Math.round((normalized - h) * 60);
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };

    const ticks = [];
    for (let i = min; i <= max; i += tickInterval) {
        ticks.push(i);
    }

    return (
        <div className="bg-muted/30 p-6 rounded-lg select-none">
            <div className="relative h-12 flex items-center">
                {/* Ticks / Rhythm Markings */}
                <div className="absolute top-0 left-0 right-0 h-full pointer-events-none">
                    {ticks.map((tick) => {
                        const percent = ((tick - min) / (max - min)) * 100;
                        const isMajor = Number.isInteger(tick);
                        const tickLabel = tick >= 24 ? tick - 24 : tick;

                        return (
                            <div
                                key={tick}
                                className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center gap-2"
                                style={{ left: `calc(10px + ${percent}% - ${(percent / 100) * 20}px)`, transform: 'translateX(-50%)' }}
                            >
                                {/* Tick Line */}
                                <div className={cn(
                                    "rounded-full bg-border transition-colors",
                                    isMajor ? "w-0.5 h-3 bg-border" : "w-[1px] h-1.5 bg-border/50"
                                )} />
                                {/* Label - Only for Major */}
                                {isMajor && (
                                    <span className="text-[10px] font-mono text-muted-foreground/60">
                                        {tickLabel}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>

                <SliderPrimitive.Root
                    className="relative flex w-full touch-none select-none items-center cursor-pointer group z-10"
                    min={min}
                    max={max}
                    step={step}
                    value={[value]}
                    onValueChange={(val) => onChange(val[0])}
                    onValueCommit={(val) => onCommit(val[0])}
                >
                    <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-border/40 backdrop-blur-sm">
                        <SliderPrimitive.Range className="absolute h-full bg-primary/80 group-hover:bg-primary transition-colors" />
                    </SliderPrimitive.Track>
                    <SliderPrimitive.Thumb className="block h-5 w-5 rounded-full border-2 border-primary bg-background shadow-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:scale-110">
                        <div className="absolute -top-9 left-1/2 -translate-x-1/2 flex flex-col items-center">
                            <span className="text-xs font-bold text-primary bg-background border border-primary/20 px-2 py-0.5 rounded-md shadow-sm whitespace-nowrap">
                                {formatTime(value)}
                            </span>
                            <div className="w-0 h-0 border-l-[4px] border-l-transparent border-t-[4px] border-t-border border-r-[4px] border-r-transparent mt-[-1px]" />
                        </div>
                    </SliderPrimitive.Thumb>
                </SliderPrimitive.Root>
            </div>
        </div>
    )
}

export function TimetableTab({ settings, onSaveSettings, runningApps }: TimelineTabProps) {
    const { t } = useTranslation();
    const { } = useDataStore();
    const [runningAppsSearch, setRunningAppsSearch] = useState("");
    const [ignoredAppsSearch, setIgnoredAppsSearch] = useState("");
    const [isIgnoredAppsOpen, setIsIgnoredAppsOpen] = useState(false);
    const [isWorkAppsListOpen, setIsWorkAppsListOpen] = useState(true);

    // Local state for Night Time Start preview
    const [previewTime, setPreviewTime] = useState(settings.nightTimeStart || 22);


    const handlePreviewChange = useCallback((val: number) => {
        setPreviewTime(val); // Local update only (instant)
    }, []);

    useEffect(() => {
        setPreviewTime(settings.nightTimeStart || 22);
    }, [settings.nightTimeStart]);


    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div>
                <h3 className="text-xl font-bold mb-4 text-foreground">{t('settings.timelineConfig')}</h3>
                <Separator className="bg-border/60" />


            </div>

            {/* Daily Archive Mode */}
            <div className="flex items-center justify-between p-4 border rounded-lg bg-card mt-4">
                <div className="space-y-0.5">
                    <Label className="text-base font-semibold">{t('settings.timeline.dailyRecordMode') || "Daily Archive Mode"}</Label>
                    <p className="text-xs text-muted-foreground opacity-80">
                        {t('settings.timeline.dailyRecordModeDesc') || "Choose how the day is defined for archiving."}
                    </p>
                </div>
                <Select
                    value={settings.dailyRecordMode || 'fixed'}
                    onValueChange={(val: 'fixed' | 'dynamic') => onSaveSettings({ ...settings, dailyRecordMode: val })}
                >
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select mode" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="fixed">
                            {t('settings.timeline.modeFixed') || "Fixed (00:00)"}
                        </SelectItem>
                        <SelectItem value="dynamic">
                            {t('settings.timeline.modeDynamic') || "Dynamic (App Close)"}
                        </SelectItem>
                    </SelectContent>
                </Select>
            </div>



            {/* Ignored Apps Section (Non-Work Programs) */}
            <div className="flex flex-col bg-muted/30 rounded-lg border border-border/50 overflow-hidden" id="settings-ignored-apps">
                {/* Header */}
                <div
                    className="flex items-center justify-between p-4 bg-muted/20 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => setIsIgnoredAppsOpen(!isIgnoredAppsOpen)}
                >
                    <div className="space-y-0.5">
                        <Label className="text-base font-semibold cursor-pointer">{t('settings.timeline.ignoredApps') || "Non-Work Programs"}</Label>
                        <p className="text-xs text-muted-foreground opacity-80">
                            {t('settings.timeline.ignoredAppsDesc') || "These programs will be treated as non-work time."}
                        </p>
                    </div>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        {isIgnoredAppsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                </div>

                {isIgnoredAppsOpen && (
                    <div className="flex flex-col gap-4 p-4 border-t border-border/50 animate-in slide-in-from-top-2 fade-in duration-200">

                        {/* Color Picker for Ignored Apps */}
                        <div className="flex items-center justify-between p-2 bg-background/50 rounded-lg border border-border/40 mb-2">
                            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                                {t('settings.timeline.ignoredAppsColor') || "Display Color"}
                            </Label>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-mono text-muted-foreground">{settings.ignoredAppsColor || '#808080'}</span>
                                <DebouncedColorPicker
                                    color={settings.ignoredAppsColor || '#808080'}
                                    onChange={(newColor) => onSaveSettings({ ...settings, ignoredAppsColor: newColor })}
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-2">
                            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                                {t('settings.timeline.configuredApps') || "Configured Apps"}
                            </Label>
                            <div className="flex flex-wrap gap-2 min-h-[40px] p-3 rounded-lg bg-background border border-border/50">
                                {settings.ignoredApps?.map(app => (
                                    <div key={app} className="flex items-center gap-1 bg-muted px-2 py-1.5 rounded text-xs font-medium border border-border">
                                        {app}
                                        <button
                                            onClick={() => onSaveSettings({ ...settings, ignoredApps: settings.ignoredApps?.filter(a => a !== app) })}
                                            className="hover:text-destructive transition-colors ml-1"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}
                                {(!settings.ignoredApps || settings.ignoredApps.length === 0) && (
                                    <div className="text-xs text-muted-foreground italic p-1">{t('settings.runningApps.noAppsConfigured')}</div>
                                )}
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <Input
                                placeholder={t('settings.runningApps.placeholder')}
                                className="h-9 text-sm bg-background border-input"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        const val = (e.currentTarget as HTMLInputElement).value?.trim();
                                        if (val && !settings.ignoredApps?.includes(val)) {
                                            onSaveSettings({
                                                ...settings,
                                                ignoredApps: [...(settings.ignoredApps || []), val]
                                            });
                                            (e.currentTarget as HTMLInputElement).value = '';
                                        }
                                    }
                                }}
                            />
                            <Button
                                size="sm"
                                className="h-9 shrink-0"
                                onClick={(e) => {
                                    const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                                    const val = input.value?.trim();
                                    if (val && !settings.ignoredApps?.includes(val)) {
                                        onSaveSettings({
                                            ...settings,
                                            ignoredApps: [...(settings.ignoredApps || []), val]
                                        });
                                        input.value = '';
                                    }
                                }}
                            >
                                Add
                            </Button>
                        </div>

                        <div className="pt-4 border-t border-border/50">
                            <h4 className="text-sm font-semibold mb-2">{t('settings.runningApps.title')}</h4>
                            <div className="bg-muted/40 rounded-lg p-2 border border-border/50">
                                <Input
                                    className="h-8 mb-2 bg-background/50 border-border/50"
                                    placeholder={t("common.search")}
                                    onChange={(e) => setIgnoredAppsSearch(e.target.value)}
                                />
                                <div className="space-y-1 max-h-[200px] overflow-y-auto custom-scrollbar pr-1">
                                    {runningApps
                                        .filter(app => !ignoredAppsSearch || app.name.toLowerCase().includes(ignoredAppsSearch.toLowerCase()) || app.process.toLowerCase().includes(ignoredAppsSearch.toLowerCase()))
                                        .map(app => {
                                            const isAdded = settings.ignoredApps?.some(wa => wa.toLowerCase() === app.process.toLowerCase());
                                            return (
                                                <div key={app.process} className="flex items-center justify-between p-2 rounded hover:bg-muted/50 group">
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="text-sm font-medium truncate">{app.name}</span>
                                                        <span className="text-xs text-muted-foreground truncate">{app.process}</span>
                                                    </div>
                                                    <Button
                                                        size="sm"
                                                        variant={isAdded ? "secondary" : "ghost"}
                                                        className={cn("h-7 text-xs", isAdded ? "opacity-50" : "hover:bg-primary/10 hover:text-primary")}
                                                        disabled={isAdded}
                                                        onClick={() => {
                                                            if (!isAdded) {
                                                                onSaveSettings({
                                                                    ...settings,
                                                                    ignoredApps: [...(settings.ignoredApps || []), app.process]
                                                                });
                                                            }
                                                        }}
                                                    >
                                                        {isAdded ? "Added" : "Add"}
                                                    </Button>
                                                </div>
                                            );
                                        })}
                                    {runningApps.length === 0 && (
                                        <div className="text-center py-4 text-xs text-muted-foreground">
                                            {t('settings.loadingApps')}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Work Apps Filter Section */}
            <div className="flex flex-col bg-muted/30 rounded-lg border border-border/50 overflow-hidden mt-4" id="settings-work-apps">
                {/* Header / Main Switch */}
                <div className="flex items-center justify-between p-4 bg-muted/20">
                    <div className="space-y-0.5">
                        <Label className="text-base font-semibold">{t('settings.timeline.filterWorkApps') || "Show Only Work Programs"}</Label>
                        <p className="text-xs text-muted-foreground opacity-80">
                            {t('settings.timeline.filterWorkAppsDesc') || "Only show configured work programs in the timeline visualization."}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Switch
                            checked={settings.filterTimelineByWorkApps || false}
                            onCheckedChange={(checked) => onSaveSettings({ ...settings, filterTimelineByWorkApps: checked })}
                        />
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => setIsWorkAppsListOpen(!isWorkAppsListOpen)}
                            disabled={!settings.filterTimelineByWorkApps}
                        >
                            {isWorkAppsListOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                    </div>
                </div>

                {settings.filterTimelineByWorkApps && isWorkAppsListOpen && (
                    <div className="flex flex-col gap-4 p-4 border-t border-border/50 animate-in slide-in-from-top-2 fade-in duration-200">
                        <div className="flex flex-col gap-2">
                            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                                {t('settings.timeline.configuredApps') || "Configured Apps"}
                            </Label>
                            <div className="flex flex-wrap gap-2 min-h-[40px] p-3 rounded-lg bg-background border border-border/50">
                                {settings.workApps?.map(app => (
                                    <div key={app} className="flex items-center gap-1 bg-muted px-2 py-1.5 rounded text-xs font-medium border border-border">
                                        {app}
                                        <button
                                            onClick={() => onSaveSettings({ ...settings, workApps: settings.workApps?.filter(a => a !== app) })}
                                            className="hover:text-destructive transition-colors ml-1"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}
                                {(!settings.workApps || settings.workApps.length === 0) && (
                                    <div className="text-xs text-muted-foreground italic p-1">{t('settings.runningApps.noAppsConfigured')}</div>
                                )}
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <Input
                                placeholder={t('settings.runningApps.placeholder')}
                                className="h-9 text-sm bg-background border-input"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        const val = (e.currentTarget as HTMLInputElement).value?.trim();
                                        if (val && !settings.workApps?.includes(val)) {
                                            onSaveSettings({
                                                ...settings,
                                                workApps: [...(settings.workApps || []), val]
                                            });
                                            (e.currentTarget as HTMLInputElement).value = '';
                                        }
                                    }
                                }}
                            />
                            <Button
                                size="sm"
                                className="h-9 shrink-0"
                                onClick={(e) => {
                                    const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                                    const val = input.value?.trim();
                                    if (val && !settings.workApps?.includes(val)) {
                                        onSaveSettings({
                                            ...settings,
                                            workApps: [...(settings.workApps || []), val]
                                        });
                                        input.value = '';
                                    }
                                }}
                            >
                                Add
                            </Button>
                        </div>

                        <div className="pt-4 border-t border-border/50">
                            <h4 className="text-sm font-semibold mb-2">{t('settings.runningApps.title')}</h4>
                            <div className="bg-muted/40 rounded-lg p-2 border border-border/50">
                                <Input
                                    className="h-8 mb-2 bg-background/50 border-border/50"
                                    placeholder={t("common.search")}
                                    onChange={(e) => setRunningAppsSearch(e.target.value)}
                                />
                                <div className="space-y-1 max-h-[200px] overflow-y-auto custom-scrollbar pr-1">
                                    {runningApps
                                        .filter(app => !runningAppsSearch || app.name.toLowerCase().includes(runningAppsSearch.toLowerCase()) || app.process.toLowerCase().includes(runningAppsSearch.toLowerCase()))
                                        .map(app => {
                                            const isAdded = settings.workApps?.some(wa => wa.toLowerCase() === app.process.toLowerCase());
                                            return (
                                                <div key={app.process} className="flex items-center justify-between p-2 rounded hover:bg-muted/50 group">
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="text-sm font-medium truncate">{app.name}</span>
                                                        <span className="text-xs text-muted-foreground truncate">{app.process}</span>
                                                    </div>
                                                    <Button
                                                        size="sm"
                                                        variant={isAdded ? "secondary" : "ghost"}
                                                        className={cn("h-7 text-xs", isAdded ? "opacity-50" : "hover:bg-primary/10 hover:text-primary")}
                                                        disabled={isAdded}
                                                        onClick={() => {
                                                            if (!isAdded) {
                                                                onSaveSettings({
                                                                    ...settings,
                                                                    workApps: [...(settings.workApps || []), app.process]
                                                                });
                                                            }
                                                        }}
                                                    >
                                                        {isAdded ? "Added" : "Add"}
                                                    </Button>
                                                </div>
                                            );
                                        })}
                                    {runningApps.length === 0 && (
                                        <div className="text-center py-4 text-xs text-muted-foreground">
                                            {t('settings.loadingApps')}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>




            <div className="flex items-center justify-between p-4 border rounded-lg bg-card mt-4" id="settings-detail-view">
                <div className="space-y-0.5">
                    <Label className="text-base font-semibold">{t('settings.timeline.detailView') || "Detail View"}</Label>
                    <p className="text-xs text-muted-foreground opacity-80">
                        {t('settings.timeline.detailViewDesc') || "Show every distinct application switch, even if brief."}
                    </p>
                </div>
                <Switch
                    checked={settings.timelineShowDetail || false}
                    onCheckedChange={(checked) => onSaveSettings({ ...settings, timelineShowDetail: checked })}
                />
            </div>

            {/* Current Time Indicator Toggle */}
            <div className="flex items-center justify-between p-4 border rounded-lg bg-card mt-2">
                <div className="space-y-0.5">
                    <Label className="text-base font-semibold">{t('settings.timeline.showCurrentTime') || "Show Current Time"}</Label>
                    <p className="text-xs text-muted-foreground opacity-80">
                        {t('settings.timeline.showCurrentTimeDesc') || "Display a red dotted line indicating the current time on the timeline."}
                    </p>
                </div>
                <Switch
                    checked={settings.showCurrentTimeIndicator !== false}
                    onCheckedChange={(checked) => onSaveSettings({ ...settings, showCurrentTimeIndicator: checked })}
                />
            </div>



            <div className="space-y-4">
                <div className="flex flex-col gap-3">

                    <div className="flex items-end justify-between">
                        <div className="space-y-0.5">
                            <Label className="text-base font-semibold">{t('settings.timeline.nightTimeStart')}</Label>
                            <p className="text-xs text-muted-foreground opacity-80 max-w-[400px]">
                                {t('settings.timeline.nightTimeStartDesc')}
                            </p>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                            <span className="text-muted-foreground">Snap:</span>
                            <Select
                                value={String(settings.nightTimeStartSnapInterval || 30)}
                                onValueChange={(val) => onSaveSettings({ ...settings, nightTimeStartSnapInterval: parseInt(val) })}
                            >
                                <SelectTrigger className="w-[80px] h-7 text-xs bg-background border-border/50">
                                    <SelectValue placeholder="30m" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="10">10m</SelectItem>
                                    <SelectItem value="15">15m</SelectItem>
                                    <SelectItem value="30">30m</SelectItem>
                                    <SelectItem value="60">60m</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="px-1">
                        <NightTimeSlider
                            value={previewTime}
                            snapInterval={settings.nightTimeStartSnapInterval || 30}
                            onChange={handlePreviewChange}
                            onCommit={(val) => {
                                // Ensure final value is previewed and saved
                                handlePreviewChange(val);
                                onSaveSettings({ ...settings, nightTimeStart: val });
                            }}
                        />
                    </div>

                    <div className="flex items-center justify-between px-1 pt-2">
                        <div className="space-y-0.5 max-w-[70%]">
                            <Label className="text-sm font-medium">{t('settings.timeline.enableUnresolvedNotification')}</Label>
                            <p className="text-xs text-muted-foreground">{t('settings.timeline.enableUnresolvedNotificationDesc')}</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-6 text-[10px] px-2"
                                onClick={async () => {
                                    console.log("[TimelineTab] Test button clicked");

                                    // Calculate real unresolved count
                                    // @ts-ignore
                                    const { projectTodos } = useTodoStore.getState();
                                    const allTodos = Object.values(projectTodos).flat();
                                    const countUnresolved = (list: any[]): number => {
                                        let count = 0;
                                        for (const todo of list) {
                                            if (!todo.completed) count++;
                                            if (todo.children) count += countUnresolved(todo.children);
                                        }
                                        return count;
                                    };
                                    const realCount = countUnresolved(allTodos);

                                    // Use IPC for reliable testing
                                    // @ts-ignore
                                    if (window.ipcRenderer && window.ipcRenderer.showNotification) {
                                        console.log("[TimelineTab] calling ipcRenderer.showNotification");
                                        try {
                                            // @ts-ignore
                                            await window.ipcRenderer.showNotification({
                                                title: t('settings.timeline.testNotificationTitle'),
                                                body: t('notifications.unresolvedTodosBody', { count: realCount })
                                            });
                                            console.log("[TimelineTab] IPC call sent");
                                            toast.success(t('settings.timeline.testNotificationSent'), {
                                                description: t('settings.timeline.testNotificationCheckTaskbar'),
                                            });
                                        } catch (e) {
                                            console.error("[TimelineTab] IPC call failed:", e);
                                            toast.error(t('settings.timeline.testNotificationFailed'));
                                            alert(t('settings.timeline.testNotificationFailed') + ": " + e);
                                        }
                                    } else {
                                        // Fallback
                                        if (Notification.permission === 'granted') {
                                            new Notification(t('settings.timeline.testNotificationTitle'), {
                                                body: t('settings.timeline.testNotificationFallback'),
                                                icon: '/appLOGO.png'
                                            });
                                            toast(t('settings.timeline.testNotificationFallback'));
                                        } else {
                                            Notification.requestPermission();
                                        }
                                    }
                                }}
                            >
                                Test
                            </Button>
                            <Switch
                                checked={settings.enableUnresolvedTodoNotifications || false}
                                onCheckedChange={(checked) => onSaveSettings({ ...settings, enableUnresolvedTodoNotifications: checked })}
                            />
                        </div>
                    </div>

                </div>
            </div>


        </div>
    )
}
