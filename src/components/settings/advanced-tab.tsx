import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogFooter,
    DialogHeader
} from "@/components/ui/dialog"
import { AlertCircle } from "lucide-react"
import { AppSettings } from "@/types"
import { useState } from "react"
import { useTranslation } from 'react-i18next';
import { useTimeStore } from "@/hooks/useTimeStore";

interface AdvancedTabProps {
    settings: AppSettings;
    onSaveSettings: (settings: AppSettings) => Promise<void>;
}

export function AdvancedTab({ settings, onSaveSettings }: AdvancedTabProps) {
    const { t } = useTranslation();
    const [showDevModeError, setShowDevModeError] = useState(false);
    const { offset: timeOffset, setTime, resetTime } = useTimeStore();

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pb-1 mb-4">
                <h3 className="text-xl font-bold text-foreground">{t('settings.advanced') || "Advanced"}</h3>
                <Separator className="bg-border/60 mt-2" />
            </div>

            <div className="space-y-4 mb-8">
                {/* Startup Behavior moved here */}
                <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-4">{t('settings.startupBehavior') || "Startup Behavior"}</h5>
                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <Label className="text-sm font-medium">{t('settings.autoLaunch')}</Label>
                        <p className="text-xs text-muted-foreground">{t('settings.autoLaunchDesc')}</p>
                    </div>
                    <Switch
                        checked={settings.autoLaunch || false}
                        onCheckedChange={async (checked: boolean) => {
                            if ((window as any).ipcRenderer) {
                                const success = await (window as any).ipcRenderer.invoke('set-auto-launch', checked);
                                if (success) {
                                    onSaveSettings({ ...settings, autoLaunch: checked });
                                } else {
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

                <Separator className="my-6 bg-border/40" />

                <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-4">Developer Settings</h5>
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
                        <Label className="text-sm font-medium">{t('settings.debuggerMode') || "Debugger Overlay (Beta)"}</Label>
                        <p className="text-xs text-muted-foreground">{t('settings.debuggerModeDesc') || "Show floating debug info on screen."}</p>
                    </div>
                    <Switch
                        checked={settings.debuggerMode || false}
                        onCheckedChange={(checked) => onSaveSettings({ ...settings, debuggerMode: checked })}
                    />
                </div>

                {settings.developerMode && (
                    <div className="flex items-center justify-between mt-4 border-t border-border/30 pt-4">
                        <div className="space-y-0.5">
                            <Label className="text-sm font-medium">{t('settings.timeTravel') || "Time Travel (Debug)"}</Label>
                            <div className="text-xs text-muted-foreground flex items-center gap-2">
                                {t('settings.timeTravelOffset') || "Offset"}: {(timeOffset / 1000 / 60 / 60).toFixed(1)}h
                                {timeOffset !== 0 && (
                                    <Button variant="link" size="sm" className="h-auto p-0 text-xs text-destructive" onClick={resetTime}>
                                        Reset
                                    </Button>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <Button variant="outline" size="sm" className="h-6 px-2 text-xs" onClick={() => setTime(new Date(Date.now() + timeOffset - 3600000))}>-1h</Button>
                            <Button variant="outline" size="sm" className="h-6 px-2 text-xs" onClick={() => setTime(new Date(Date.now() + timeOffset + 3600000))}>+1h</Button>
                        </div>
                    </div>
                )}
            </div>

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
    );
}
