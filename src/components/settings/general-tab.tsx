
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
import { X, Cloud, Check, RefreshCw, AlertCircle } from "lucide-react";
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
                    <h5 className="text-base font-semibold text-foreground mb-1">{t('settings.language')}</h5>
                    <div className="flex flex-col gap-3" id="settings-language">
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
                    </div>
                </div>
                <Separator className="bg-border/30 mb-8" />

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
                                    <SelectValue placeholder="Select Day" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="sunday">Sunday</SelectItem>
                                    <SelectItem value="monday">Monday</SelectItem>
                                    <SelectItem value="tuesday">Tuesday</SelectItem>
                                    <SelectItem value="wednesday">Wednesday</SelectItem>
                                    <SelectItem value="thursday">Thursday</SelectItem>
                                    <SelectItem value="friday">Friday</SelectItem>
                                    <SelectItem value="saturday">Saturday</SelectItem>
                                </SelectContent>
                            </Select>
                            <span className="text-sm text-foreground">{t('settings.weeklyResetDesc')}</span>
                        </div>
                    </div>
                </div>
                <Separator className="bg-border/30 mb-8" />
            </div>

            <div>
                <h3 className="text-xl font-bold mb-4 text-foreground">{t('settings.trackedApps')}</h3>
                <p className="text-sm text-muted-foreground mb-4">
                    {t('settings.autoTrackingDesc')}
                </p>
                <Separator className="bg-border/60" />
            </div>

            {/* Active Apps Pills */}
            <div className="space-y-2 pt-2" id="settings-monitored">
                <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{t('settings.monitoredProcesses')}</h5>
                <div className="flex flex-wrap gap-2 min-h-[40px] p-4 rounded-lg bg-muted/30">
                    {settings.targetProcessPatterns.map(app => (
                        <div key={app} className="flex items-center gap-1 bg-background px-3 py-1.5 rounded text-sm font-medium shadow-sm group border border-border/50">
                            {app}
                            <button
                                onClick={() => removeApp(app)}
                                className="hover:text-destructive transition-colors ml-1 opacity-50 group-hover:opacity-100"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    ))}
                    {settings.targetProcessPatterns.length === 0 && (
                        <div className="text-sm text-muted-foreground italic">No apps tracked</div>
                    )}
                </div>
            </div>

            {/* Detected Apps List (Mini) */}
            <div className="mt-8 pt-4" id="settings-running-apps">
                <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">{t('settings.runningApps')}</h5>
                <div className="rounded-lg overflow-hidden border border-border/50 bg-muted/30">
                    {/* Search / Add Input Header */}
                    <div className="p-2 border-b border-border/10 bg-muted/50">
                        <div className="flex gap-2">
                            <Input
                                placeholder={t('common.search')}
                                value={newAppInput}
                                onChange={(e) => setNewAppInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && addApp(newAppInput)}
                                className="h-8 text-xs bg-background/50 border-none focus-visible:ring-0 focus-visible:ring-offset-0"
                            />
                            {newAppInput.trim() && (
                                <Button
                                    size="sm"
                                    onClick={() => addApp(newAppInput)}
                                    className="h-8 bg-primary text-primary-foreground text-xs"
                                >
                                    {t('common.add')}
                                </Button>
                            )}
                        </div>
                    </div>

                    <div className="max-h-60 overflow-y-auto custom-scrollbar">
                        {runningApps.length === 0 ? (
                            <div className="p-4 text-center text-sm text-muted-foreground">Scanning...</div>
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
                                            className="flex items-center justify-between px-4 py-2 hover:bg-muted/50 transition-colors border-b border-border/10 last:border-0"
                                        >
                                            <div className="flex flex-col min-w-0">
                                                <span className="font-medium text-sm truncate">{app.process}</span>
                                                <span className="text-xs text-muted-foreground truncate opacity-70">{app.name}</span>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => addApp(app.process || app.name)}
                                                className="h-7 text-xs bg-background hover:bg-muted text-muted-foreground hover:text-foreground border border-border/50"
                                            >
                                                Add
                                            </Button>
                                        </div>
                                    ))
                                }
                            </>
                        )}
                    </div>
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

                {/* Update Section */}
                <div className="mt-8 pt-4 border-t border-border/40">
                    <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-4">{t('settings.update.title') || "Software Update"}</h5>
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
                                    <h4 className="font-medium text-sm">{t('settings.update.statusLabel') || "Update Status"}</h4>
                                    <p className="text-xs text-muted-foreground">
                                        {updateStatus === 'idle' && (t('settings.update.currentVersion', { version }) || `Current Version: v${version}`)}
                                        {updateStatus === 'checking' && (t('settings.update.checking') || "Checking for updates...")}
                                        {updateStatus === 'available' && (t('settings.update.available') || "Update available. Downloading...")}
                                        {updateStatus === 'not-available' && (t('settings.update.upToDateVersion', { version }) || `You are up to date (v${version})`)}
                                        {updateStatus === 'downloading' && (t('settings.update.downloading', { percent: Math.round(updateProgress) }) || `Downloading update: ${Math.round(updateProgress)}%`)}
                                        {updateStatus === 'ready' && (t('settings.update.ready') || "Update ready to install")}
                                        {updateStatus === 'error' && (t('settings.update.failed') || "Update failed")}
                                    </p>
                                </div>
                            </div>

                            {updateStatus === 'idle' || updateStatus === 'not-available' || updateStatus === 'error' ? (
                                <Button variant="outline" size="sm" onClick={checkForUpdates}>
                                    {t('settings.update.checkButton') || "Check for Updates"}
                                </Button>
                            ) : updateStatus === 'ready' ? (
                                <Button size="sm" onClick={quitAndInstall}>
                                    {t('settings.update.restartButton') || "Restart & Install"}
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
        </div>
    )
}
