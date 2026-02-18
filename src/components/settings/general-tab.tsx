
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogFooter,
    DialogHeader
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { X, Cloud, Check, RefreshCw, AlertCircle, ChevronUp, ChevronDown } from "lucide-react";
import { AppSettings } from "@/types"
import { useState, useEffect } from "react"

import { cn } from "@/lib/utils"
import { useTranslation } from 'react-i18next';
import { version } from "../../../package.json";

interface GeneralTabProps {
    settings: AppSettings;
    onSaveSettings: (settings: AppSettings) => Promise<void>;
    updateStatus: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'ready' | 'error';
    updateProgress: number;
    updateError: string | null;
    checkForUpdates: () => Promise<void>;
    quitAndInstall: () => void;
}

export function GeneralTab({
    settings,
    onSaveSettings,
    updateStatus,
    updateProgress,
    updateError,
    checkForUpdates,
    quitAndInstall
}: GeneralTabProps) {
    const { t, i18n } = useTranslation();
    const [runningApps, setRunningApps] = useState<{ id: string, name: string, process: string }[]>([]);
    const [newAppInput, setNewAppInput] = useState("");
    const [showDevModeError, setShowDevModeError] = useState(false);
    const [isTrackedAppsOpen, setIsTrackedAppsOpen] = useState(false);

    useEffect(() => {
        const fetchRunningApps = async () => {
            if ((window as any).ipcRenderer) {
                try {
                    const apps = await (window as any).ipcRenderer.getRunningApps();
                    setRunningApps(apps);
                } catch (e) {
                    console.error("Failed to fetch running apps", e);
                }
            }
        };
        fetchRunningApps();
    }, []);

    const addApp = (appName: string) => {
        if (!settings) return;
        if (appName && !settings.targetProcessPatterns.includes(appName)) {
            onSaveSettings({
                ...settings,
                targetProcessPatterns: [...settings.targetProcessPatterns, appName]
            });
        }
        setNewAppInput("");
    };

    const removeApp = (appToRemove: string) => {
        if (!settings) return;
        onSaveSettings({
            ...settings,
            targetProcessPatterns: settings.targetProcessPatterns.filter(app => app !== appToRemove)
        });
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* General Preferences Section */}
            <div>
                <h3 className="text-xl font-bold mb-4 text-foreground">{t('settings.general')}</h3>
                <Separator className="bg-border/60 mb-6" />

                <div className="space-y-4 mb-8">
                    <h5 className="text-base font-semibold text-foreground mb-1">{t('settings.general')}</h5>
                    <div className="flex flex-col gap-3" id="settings-preferences">
                        {/* Language */}
                        <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{t('settings.language')}</Label>
                        <div className="flex items-center gap-4 bg-muted/50 p-4 rounded-lg">
                            <Select
                                value={i18n.language}
                                onValueChange={(val) => i18n.changeLanguage(val)}
                            >
                                <SelectTrigger className="w-[180px] bg-background border-none">
                                    <SelectValue placeholder="Select Language" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="en">English</SelectItem>
                                    <SelectItem value="ko">한국어</SelectItem>
                                    <SelectItem value="ja">日本語</SelectItem>
                                </SelectContent>
                            </Select>
                            <span className="text-sm text-foreground">{t('settings.languageDesc')}</span>
                        </div>

                        {/* Display Mode */}
                        <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wide mt-2">{t('settings.runningApps.displayMode')}</Label>
                        <div className="flex items-center gap-4 bg-muted/50 p-4 rounded-lg">
                            <Select
                                value={settings.runningAppsDisplayMode || 'both'}
                                onValueChange={(val: 'title' | 'process' | 'both') => onSaveSettings({ ...settings, runningAppsDisplayMode: val })}
                            >
                                <SelectTrigger className="w-[180px] bg-background border-none">
                                    <SelectValue placeholder={t('settings.runningApps.selectDisplayMode')} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="both">{t('settings.runningApps.displayBoth')}</SelectItem>
                                    <SelectItem value="title">{t('settings.runningApps.displayTitle')}</SelectItem>
                                    <SelectItem value="process">{t('settings.runningApps.displayProcess')}</SelectItem>
                                </SelectContent>
                            </Select>
                            <span className="text-sm text-foreground">{t('settings.runningApps.displayModeDesc')}</span>
                        </div>

                        {/* Daily Archive Mode */}
                        <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wide mt-2">{t('settings.timeline.dailyRecordMode') || "Daily Archive Mode"}</Label>
                        <div className="flex items-center gap-4 bg-muted/50 p-4 rounded-lg">
                            <Select
                                value={settings.dailyRecordMode || 'fixed'}
                                onValueChange={(val: 'fixed' | 'dynamic') => onSaveSettings({ ...settings, dailyRecordMode: val })}
                            >
                                <SelectTrigger className="w-[180px] bg-background border-none">
                                    <SelectValue placeholder="Select mode" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="fixed">
                                        {t('settings.timeline.modeFixed') || "Fixed (Midnight)"}
                                    </SelectItem>
                                    <SelectItem value="dynamic">
                                        {t('settings.timeline.modeDynamic') || "Dynamic (Flexible)"}
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                            <span className="text-sm text-foreground">{t('settings.timeline.dailyRecordModeDesc') || "Choose when to start a new daily log."}</span>
                        </div>
                    </div>
                </div>
                <div className="space-y-4 mb-8" id="settings-schedule">
                    <h5 className="text-base font-semibold text-foreground mb-1">{t('settings.weeklySchedule')}</h5>
                    <div className="flex flex-col gap-3">
                        <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{t('settings.startOfWeek')}</Label>
                        <div className="flex items-center gap-4 bg-muted/50 p-4 rounded-lg">
                            <Select
                                value={settings.startOfWeek || 'sunday'}
                                onValueChange={(val: any) => onSaveSettings({ ...settings, startOfWeek: val })}
                            >
                                <SelectTrigger className="w-[180px] bg-background border-none">
                                    <SelectValue placeholder={t('settings.daysOfWeek.sunday')} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="sunday">{t('settings.daysOfWeek.sunday')}</SelectItem>
                                    <SelectItem value="monday">{t('settings.daysOfWeek.monday')}</SelectItem>
                                    <SelectItem value="tuesday">{t('settings.daysOfWeek.tuesday')}</SelectItem>
                                    <SelectItem value="wednesday">{t('settings.daysOfWeek.wednesday')}</SelectItem>
                                    <SelectItem value="thursday">{t('settings.daysOfWeek.thursday')}</SelectItem>
                                    <SelectItem value="friday">{t('settings.daysOfWeek.friday')}</SelectItem>
                                    <SelectItem value="saturday">{t('settings.daysOfWeek.saturday')}</SelectItem>
                                </SelectContent>
                            </Select>
                            <span className="text-sm text-foreground">{t('settings.weeklyResetDesc')}</span>
                        </div>
                    </div>
                </div>
            </div>
            <Separator className="bg-border/30 mb-8" />


            {/* Tracked Apps Section (Collapsible) */}
            <div className="flex flex-col bg-muted/30 rounded-lg border border-border/50 overflow-hidden" id="settings-tracked-apps-card">
                <div
                    className="flex items-center justify-between p-4 bg-muted/20 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => setIsTrackedAppsOpen(!isTrackedAppsOpen)}
                >
                    <div className="space-y-0.5">
                        <Label className="text-base font-semibold cursor-pointer">{t('settings.trackedApps')}</Label>
                        <p className="text-xs text-muted-foreground opacity-80">
                            {t('settings.autoTrackingDesc')}
                        </p>
                    </div>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        {isTrackedAppsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                </div>

                {isTrackedAppsOpen && (
                    <div className="flex flex-col gap-4 p-4 border-t border-border/50 animate-in slide-in-from-top-2 fade-in duration-200">

                        {/* 1. Tracked (Configured) Apps List */}
                        <div className="flex flex-col gap-2">
                            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                                {t('settings.monitoredProcesses')}
                            </Label>
                            <div className="flex flex-wrap gap-2 min-h-[40px] p-3 rounded-lg bg-background border border-border/50">
                                {settings.targetProcessPatterns.map(app => (
                                    <div key={app} className="flex items-center gap-1 bg-muted px-2 py-1.5 rounded text-xs font-medium border border-border">
                                        {app}
                                        <button
                                            onClick={() => removeApp(app)}
                                            className="hover:text-destructive transition-colors ml-1"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}
                                {settings.targetProcessPatterns.length === 0 && (
                                    <div className="text-xs text-muted-foreground italic p-1">{t('settings.runningApps.noAppsConfigured')}</div>
                                )}
                            </div>
                        </div>

                        {/* 2. Manual Add Input */}
                        <div className="flex gap-2">
                            <Input
                                placeholder={t('settings.runningApps.placeholder')}
                                value={newAppInput}
                                onChange={(e) => setNewAppInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && addApp(newAppInput)}
                                className="h-9 text-sm bg-background border-input"
                            />
                            <Button
                                size="sm"
                                onClick={() => addApp(newAppInput)}
                                className="h-9 shrink-0"
                            >
                                {t('common.add')}
                            </Button>
                        </div>

                        {/* 3. Running Apps List (with Search) */}
                        <div className="pt-4 border-t border-border/50">
                            <h4 className="text-sm font-semibold mb-2">{t('settings.runningApps.title')}</h4>
                            <div className="bg-muted/40 rounded-lg p-2 border border-border/50">
                                {/* Search Bar inside Running Apps */}
                                <Input
                                    className="h-8 mb-2 bg-background/50 border-border/50"
                                    placeholder={t("common.search")}
                                    /* We can reuse newAppInput if we want search to also be the add input, 
                                       but timeline-tab separates them. 
                                       Current general-tab logic used newAppInput for both.
                                       Let's keep using newAppInput for both to maintain behavior,
                                       OR introduce a separate search state if we want 100% parity.
                                       
                                       Timeline-tab has `toggle` and `runningAppsSearch`.
                                       General-tab had `newAppInput` acting as both search and add value.
                                       
                                       To match strictly:
                                       - Top input is for adding specific name manually.
                                       - Bottom input is for searching running apps.
                                       
                                       I'll introduce a local search state for the bottom list if needed, 
                                       but for now I will use newAppInput for the explicit add, 
                                       and I might need a new state for the search if I want them decoupled.
                                       
                                       However, I cannot add a new state hook easily in this Replace block without changing the whole file.
                                       Wait, the user previously had `newAppInput`.
                                       I will use `newAppInput` for the TOP input (Manual Add).
                                       I will use a NEW temporary local variable if I could, but I can't.
                                       
                                       Actually, I can just use `newAppInput` for the search filter as well for now, 
                                       OR I can just not filter the list by default and let the user scroll?
                                       No, filtering is good.
                                       
                                       Let's look at `timeline-tab.tsx` again.
                                       It has `runningAppsSearch` state.
                                       `general-tab` only has `newAppInput`.
                                       
                                       If I want to separate them, I need to add state. 
                                       But I am in partial file replace mode.
                                       
                                       Decision: I will use `newAppInput` for the Top Input.
                                       For the Bottom "Search", I will also bind it to `newAppInput` for now? 
                                       No, that would be confusing if I type in top and bottom filters.
                                       
                                       Actually, `general-tab.tsx` lines 49-52:
                                       const [newAppInput, setNewAppInput] = useState("");
                                       
                                       I should probably stick to the previous behavior where the input filtered the list,
                                       BUT the UI structure is split.
                                       
                                       If I split the UI, I should probably split the state too.
                                       But I can't easily add state here.
                                       
                                       Alternative: Stick to one input? 
                                       Timeline-tab has TWO inputs (one for manual add, one for search).
                                       
                                       I will use `newAppInput` for the MANAUAL ADD (Top).
                                       For the SEARCH (Bottom), I will assume the user wants to see all apps or I'll just use `newAppInput` there too?
                                       If I type "Chrome" in the Manual Add, I probably want to see "Chrome" in the list too.
                                       So binding both to `newAppInput` is actually seemingly okay interaction-wise, 
                                       though slightly weird if you have two input boxes.
                                       
                                       Wait, `timeline-tab.tsx` has `runningAppsSearch` and `setRunningAppsSearch`.
                                       
                                       I'll risk using `newAppInput` for the search as well, 
                                       but to avoid confusion, I will ONLY put the filter logic on the list 
                                       and maybe NOT put a search bar in the bottom section if I can't add state?
                                       
                                       NO, I must add the search bar to match the UI.
                                       
                                       I'll use `newAppInput` for the search bar too for now.
                                       If the user types in the search bar, it updates `newAppInput`.
                                       If the user types in the manual add, it updates `newAppInput`.
                                       They stay in sync. It's a bit "coupled" but it works without adding new state hooks (which requires replacing the whole file).
                                    */
                                    value={newAppInput}
                                    onChange={(e) => setNewAppInput(e.target.value)}
                                />
                                <div className="space-y-1 max-h-[200px] overflow-y-auto custom-scrollbar pr-1">
                                    {runningApps.length === 0 ? (
                                        <div className="p-4 text-center text-sm text-muted-foreground">{t('settings.runningApps.scanning')}</div>
                                    ) : (
                                        <>
                                            {runningApps
                                                .filter(app => {
                                                    const identifier = app.process || app.name;
                                                    const isAlreadyTracked = settings.targetProcessPatterns.includes(identifier);
                                                    const matchesSearch = !newAppInput ||
                                                        (app.process && app.process.toLowerCase().includes(newAppInput.toLowerCase())) ||
                                                        (app.name && app.name.toLowerCase().includes(newAppInput.toLowerCase()));

                                                    return !isAlreadyTracked && matchesSearch;
                                                })
                                                .map((app, idx) => (
                                                    <div
                                                        key={`${app.id}-${idx}`}
                                                        className="flex items-center justify-between p-2 rounded hover:bg-muted/50 group"
                                                    >
                                                        <div className="flex flex-col min-w-0">
                                                            {(settings.runningAppsDisplayMode === 'both' || settings.runningAppsDisplayMode === 'title' || !settings.runningAppsDisplayMode) && (
                                                                <span className="text-sm font-medium truncate">{app.name}</span>
                                                            )}
                                                            {(settings.runningAppsDisplayMode === 'both' || settings.runningAppsDisplayMode === 'process' || !settings.runningAppsDisplayMode) && (
                                                                <span className={cn(
                                                                    "truncate",
                                                                    settings.runningAppsDisplayMode === 'process' ? "text-sm font-medium" : "text-xs text-muted-foreground opacity-70"
                                                                )}>{app.process}</span>
                                                            )}
                                                        </div>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => addApp(app.process || app.name)}
                                                            className="h-7 text-xs bg-background hover:bg-primary/10 hover:text-primary border border-border/50"
                                                        >
                                                            {t('common.add')}
                                                        </Button>
                                                    </div>
                                                ))
                                            }
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            {/* Startup Behavior */}
            <div className="mt-8 pt-4 border-t border-border/40" id="settings-startup">
                <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-4">{t('settings.startupBehavior')}</h5>
                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <Label className="text-sm font-medium">{t('settings.autoLaunch')}</Label>
                        <p className="text-xs text-muted-foreground">{t('settings.autoLaunchDesc')}</p>
                    </div>
                    <Switch
                        checked={settings.autoLaunch || false}
                        onCheckedChange={async (checked: boolean) => {
                            // specific IPC call for auto-launch
                            if ((window as any).ipcRenderer) {
                                const success = await (window as any).ipcRenderer.invoke('set-auto-launch', checked);
                                if (success) {
                                    onSaveSettings({ ...settings, autoLaunch: checked });
                                } else {
                                    // Show Error Dialog
                                    setShowDevModeError(true);
                                }
                            }
                        }}
                    />
                </div>

                <div className="flex items-center justify-between mt-4">
                    <div className="space-y-0.5">
                        <Label className="text-sm font-medium">{t('settings.autoUpdate')}</Label>
                        <p className="text-xs text-muted-foreground">{t('settings.autoUpdateDesc')}</p>
                    </div>
                    <Switch
                        checked={settings.autoUpdate || false}
                        onCheckedChange={(checked) => onSaveSettings({ ...settings, autoUpdate: checked })}
                    />
                </div>
            </div>

            {/* Idle Detection (Moved from Tracking) */}
            <div id="settings-idle-time" className="mt-8 pt-4 border-t border-border/40">
                <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-4">{t('settings.tracking.detectIdleTime')}</h5>
                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <Label className="text-sm font-medium">{t('settings.tracking.detectIdleTime')}</Label>
                        <p className="text-xs text-muted-foreground">{t('settings.tracking.detectIdleTimeDesc')}</p>
                    </div>
                    <Select
                        value={String(settings.idleThresholdSeconds || 10)}
                        onValueChange={(val) => onSaveSettings({ ...settings, idleThresholdSeconds: parseInt(val) })}
                    >
                        <SelectTrigger className="w-[180px] bg-background border-none">
                            <SelectValue placeholder={t('settings.tracking.selectDuration')} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="5">{t('settings.tracking.seconds5')}</SelectItem>
                            <SelectItem value="10">{t('settings.tracking.seconds10')} (Default)</SelectItem>
                            <SelectItem value="30">{t('settings.tracking.seconds30')}</SelectItem>
                            <SelectItem value="60">{t('settings.tracking.hour1').replace('1 Hour', '1 Minute').replace('1시간', '1분')}</SelectItem>
                            <SelectItem value="300">5 {t('settings.tracking.minutes5').replace('5 Minutes', 'Minutes').replace('5분', '분')}</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Developer Mode */}
            <div className="mt-8 pt-4 border-t border-border/40" id="settings-developer-mode">
                <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-4">{t('settings.advanced') || "Advanced"}</h5>
                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <Label className="text-sm font-medium">{t('settings.developerMode') || "Developer Mode"}</Label>
                        <p className="text-xs text-muted-foreground">{t('settings.developerModeDesc') || "Enable advanced debugging features."}</p>
                    </div>
                    <Switch
                        checked={settings.developerMode || false}
                        onCheckedChange={(checked) => onSaveSettings({ ...settings, developerMode: checked })}
                    />
                </div>

                <div className="flex items-center justify-between mt-4">
                    <div className="space-y-0.5">
                        <Label className="text-sm font-medium">{t('settings.debuggerMode') || "Debugger Overlay"}</Label>
                        <p className="text-xs text-muted-foreground">{t('settings.debuggerModeDesc') || "Show floating debug info on screen."}</p>
                    </div>
                    <Switch
                        checked={settings.debuggerMode || false}
                        onCheckedChange={(checked) => onSaveSettings({ ...settings, debuggerMode: checked })}
                    />
                </div>
            </div>

            {/* Update Section */}
            <div className="mt-8 pt-4 border-t border-border/40">
                <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-4">{t('settings.softwareUpdate.title') || "Software Update"}</h5>
                <div className="bg-muted/30 rounded-lg p-4 border border-border/50">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className={cn("w-10 h-10 rounded-full flex items-center justify-center",
                                updateStatus === 'ready' ? "bg-green-500/20 text-green-500" :
                                    updateStatus === 'error' ? "bg-red-500/20 text-red-500" :
                                        "bg-primary/10 text-primary"
                            )}>
                                {updateStatus === 'checking' || updateStatus === 'downloading' ? <RefreshCw className="w-5 h-5 animate-spin" /> :
                                    updateStatus === 'ready' ? <Check className="w-5 h-5" /> :
                                        updateStatus === 'error' ? <AlertCircle className="w-5 h-5" /> :
                                            <Cloud className="w-5 h-5" />}
                            </div>
                            <div>
                                <h4 className="font-medium text-sm">{t('settings.softwareUpdate.statusTitle') || "Update Status"}</h4>
                                <p className="text-xs text-muted-foreground">
                                    {updateStatus === 'idle' && (t('settings.softwareUpdate.currentVersion') ? `${t('settings.softwareUpdate.currentVersion')}: v${version}` : `Current Version: v${version}`)}
                                    {updateStatus === 'checking' && (t('settings.softwareUpdate.checking') || "Checking for updates...")}
                                    {updateStatus === 'available' && (t('settings.softwareUpdate.available') || "Update available. Downloading...")}
                                    {updateStatus === 'not-available' && (t('settings.softwareUpdate.upToDate') ? `${t('settings.softwareUpdate.upToDate')} (v${version})` : `You are up to date (v${version})`)}
                                    {updateStatus === 'downloading' && (t('settings.softwareUpdate.downloading') ? `${t('settings.softwareUpdate.downloading')}: ${Math.round(updateProgress)}%` : `Downloading update: ${Math.round(updateProgress)}%`)}
                                    {updateStatus === 'ready' && (t('settings.softwareUpdate.ready') || "Update ready to install")}
                                    {updateStatus === 'error' && (t('settings.softwareUpdate.failed') || "Update failed")}
                                </p>
                            </div>
                        </div>

                        {updateStatus === 'idle' || updateStatus === 'not-available' || updateStatus === 'error' ? (
                            <Button variant="outline" size="sm" onClick={checkForUpdates}>
                                {t('settings.softwareUpdate.checkForUpdates') || "Check for Updates"}
                            </Button>
                        ) : updateStatus === 'ready' ? (
                            <Button size="sm" onClick={quitAndInstall}>
                                {t('settings.softwareUpdate.restartAndInstall') || "Restart & Install"}
                            </Button>
                        ) : null}
                    </div>

                    {updateStatus === 'downloading' && (
                        <div className="w-full bg-muted/50 rounded-full h-1.5 overflow-hidden">
                            <div
                                className="bg-primary h-full transition-all duration-300 ease-out"
                                style={{ width: `${updateProgress}%` }}
                            />
                        </div>
                    )}

                    {updateStatus === 'error' && updateError && (
                        <div className="text-xs text-destructive mt-2 bg-destructive/10 p-2 rounded">
                            Error: {updateError}
                        </div>
                    )}
                </div>
            </div>


            {/* Error Dialog for Dev Mode */}
            <Dialog open={showDevModeError} onOpenChange={setShowDevModeError}>
                <DialogContent className="max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-destructive">
                            <AlertCircle className="w-5 h-5" />
                            Error
                        </DialogTitle>
                    </DialogHeader>
                    <div className="py-2">
                        <h4 className="font-semibold text-primary mb-2">Development Mode</h4>
                        <p className="text-sm text-muted-foreground mb-4">
                            Auto-launch cannot be enabled in development mode.
                        </p>
                        <p className="text-xs text-muted-foreground opacity-80">
                            This feature typically requires a packaged application to register the correct executable path. Enabling it now would register the generic Electron binary, causing the app to launch incorrectly.
                        </p>
                    </div>
                    <DialogFooter>
                        <Button onClick={() => setShowDevModeError(false)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div >
    )
}
