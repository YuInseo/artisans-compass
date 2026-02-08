
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Info } from "lucide-react";
import { AppSettings } from "@/types"
import { useTranslation } from 'react-i18next';

interface ScreenSource {
    id: string;
    name: string;
    thumbnail: string;
}

interface TrackingTabProps {
    settings: AppSettings;
    onSaveSettings: (settings: AppSettings) => Promise<void>;
    screenSources: ScreenSource[];
}

export function TrackingTab({ settings, onSaveSettings, screenSources }: TrackingTabProps) {
    const { t } = useTranslation();

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div>
                <h3 className="text-xl font-bold mb-4 text-foreground">{t('settings.tracking.title')}</h3>
                <Separator className="bg-border/60" />
            </div>

            <div className="space-y-6">
                <div className="flex flex-col bg-muted/30 rounded-lg border border-border/50 overflow-hidden" id="settings-screenshots">
                    {/* Header / Main Switch */}
                    <div className="flex items-center justify-between p-4 bg-muted/20">
                        <div className="space-y-0.5">
                            <Label className="text-base font-semibold">{t('settings.tracking.enableScreenshots')}</Label>
                            <p className="text-xs text-muted-foreground opacity-80">{t('settings.tracking.enableScreenshotsDesc')}</p>
                        </div>
                        <Switch
                            checked={settings.enableScreenshots !== false}
                            onCheckedChange={(checked: boolean) => onSaveSettings({ ...settings, enableScreenshots: checked })}
                        />
                    </div>

                    {settings.enableScreenshots !== false && (
                        <div className="flex flex-col border-t border-border/50 animate-in slide-in-from-top-2 fade-in duration-200">

                            {/* Idle Time */}
                            <div className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors" id="settings-idle">
                                <div className="space-y-0.5">
                                    <Label className="text-sm font-medium">{t('settings.tracking.detectIdleTime')}</Label>
                                    <p className="text-xs text-muted-foreground opacity-80">{t('settings.tracking.detectIdleTimeDesc')}</p>
                                </div>
                                <Select
                                    value={String(settings.idleThresholdSeconds || 10)}
                                    onValueChange={(val) => onSaveSettings({ ...settings, idleThresholdSeconds: parseInt(val) })}
                                >
                                    <SelectTrigger className="w-[180px] bg-background border-input">
                                        <SelectValue placeholder={t('settings.tracking.selectDuration')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="5">{t('settings.tracking.seconds5')}</SelectItem>
                                        <SelectItem value="10">{t('settings.tracking.seconds10')} (Default)</SelectItem>
                                        <SelectItem value="30">{t('settings.tracking.seconds30')}</SelectItem>
                                        <SelectItem value="60">{t('settings.tracking.hour1').replace('1 Hour', '1 Minute').replace('1시간', '1분')}</SelectItem>
                                        <SelectItem value="300">{t('settings.tracking.minutes5')}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <Separator className="bg-border/40" />

                            {/* Screenshot Interval */}
                            <div className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors" id="settings-interval">
                                <div className="space-y-0.5">
                                    <Label className="text-sm font-medium">{t('settings.tracking.screenshotInterval')}</Label>
                                    <p className="text-xs text-muted-foreground opacity-80">{t('settings.tracking.screenshotIntervalDesc')}</p>
                                </div>
                                <Select
                                    value={String(settings.screenshotIntervalSeconds)}
                                    onValueChange={(val) => onSaveSettings({ ...settings, screenshotIntervalSeconds: parseInt(val) })}
                                >
                                    <SelectTrigger className="w-[180px] bg-background border-input">
                                        <SelectValue placeholder={t('settings.tracking.selectInterval')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="10">{t('settings.tracking.secondsTest')}</SelectItem>
                                        <SelectItem value="300">{t('settings.tracking.minutes5')}</SelectItem>
                                        <SelectItem value="900">{t('settings.tracking.minutes15')}</SelectItem>
                                        <SelectItem value="1800">{t('settings.tracking.minutes30')}</SelectItem>
                                        <SelectItem value="3600">{t('settings.tracking.hour1')}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <Separator className="bg-border/40" />

                            {/* Timelapse Speed */}
                            <div className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors" id="settings-timelapse">
                                <div className="space-y-0.5">
                                    <Label className="text-sm font-medium">{t('settings.tracking.timelapseSpeed')}</Label>
                                    <p className="text-xs text-muted-foreground opacity-80">{t('settings.tracking.timelapseSpeedDesc')}</p>
                                </div>
                                <Select
                                    value={String(settings.timelapseDurationSeconds)}
                                    onValueChange={(val) => onSaveSettings({ ...settings, timelapseDurationSeconds: parseInt(val) })}
                                >
                                    <SelectTrigger className="w-[180px] bg-background border-input">
                                        <SelectValue placeholder={t('settings.tracking.selectDuration')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="3">{t('settings.tracking.seconds3')}</SelectItem>
                                        <SelectItem value="5">{t('settings.tracking.seconds5')}</SelectItem>
                                        <SelectItem value="10">{t('settings.tracking.seconds10')}</SelectItem>
                                        <SelectItem value="30">{t('settings.tracking.seconds30')}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <Separator className="bg-border/40" />

                            {/* Screenshot Mode */}
                            <div className="flex flex-col p-4 gap-4" id="settings-capture-mode">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <Label className="text-sm font-medium">{t('settings.tracking.screenshotMode')}</Label>
                                        <p className="text-xs text-muted-foreground opacity-80">{t('settings.tracking.screenshotModeDesc')}</p>
                                    </div>
                                    <Select
                                        value={settings.screenshotMode || 'window'}
                                        onValueChange={(val: 'window' | 'screen' | 'process') => onSaveSettings({ ...settings, screenshotMode: val })}
                                    >
                                        <SelectTrigger className="w-[180px] bg-background border-input">
                                            <SelectValue placeholder="Select Mode" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="active-app">{t('settings.tracking.activeApp')}</SelectItem>
                                            <SelectItem value="window">{t('settings.tracking.activeWindow')}</SelectItem>
                                            <SelectItem value="process">{t('settings.tracking.specificApp')}</SelectItem>
                                            <SelectItem value="screen">{t('settings.tracking.monitor')}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="pl-0 md:pl-1">
                                    {settings.screenshotMode === 'active-app' && (
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-accent/20 p-3 rounded-md border border-border/50">
                                            <Info className="w-4 h-4 text-primary shrink-0" />
                                            <span>{t('settings.tracking.capturesFocusedDesc')}</span>
                                        </div>
                                    )}

                                    {settings.screenshotMode === 'window' && (
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-accent/20 p-3 rounded-md border border-border/50">
                                            <Info className="w-4 h-4 text-primary shrink-0" />
                                            <span>{t('settings.tracking.capturesWindowDesc')}</span>
                                        </div>
                                    )}

                                    {settings.screenshotMode === 'process' && (
                                        <div className="flex flex-col gap-3 bg-accent/10 p-3 rounded-lg border border-border/50">
                                            <div className="flex items-center justify-between">
                                                <div className="space-y-0.5">
                                                    <Label className="text-sm font-medium">{t('settings.tracking.selectApp')}</Label>
                                                </div>
                                                <Select
                                                    value={settings.screenshotTargetProcess || ''}
                                                    onValueChange={(val) => onSaveSettings({ ...settings, screenshotTargetProcess: val })}
                                                >
                                                    <SelectTrigger className="w-[200px] bg-background border-input h-8 text-xs">
                                                        <SelectValue placeholder={t('settings.tracking.selectProcess')} />
                                                    </SelectTrigger>
                                                    <SelectContent className="max-h-[300px]">
                                                        {settings.targetProcessPatterns && settings.targetProcessPatterns.length > 0 ? (
                                                            settings.targetProcessPatterns.sort().map((p, idx) => (
                                                                <SelectItem key={`${p}-${idx}`} value={p}>{p}</SelectItem>
                                                            ))
                                                        ) : (
                                                            <div className="p-2 text-xs text-center text-muted-foreground">{t('settings.tracking.noMonitoredApps')}</div>
                                                        )}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="flex gap-2">
                                                <Input
                                                    placeholder={t('settings.runningApps.placeholder')}
                                                    className="flex-1 h-8 text-xs bg-background"
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            const val = (e.currentTarget as HTMLInputElement).value?.trim();
                                                            if (val && !settings.targetProcessPatterns?.includes(val)) {
                                                                onSaveSettings({
                                                                    ...settings,
                                                                    targetProcessPatterns: [...(settings.targetProcessPatterns || []), val],
                                                                    screenshotTargetProcess: val
                                                                });
                                                                (e.currentTarget as HTMLInputElement).value = '';
                                                            }
                                                        }
                                                    }}
                                                />
                                                <Button
                                                    size="sm"
                                                    className="h-8"
                                                    variant="secondary"
                                                    onClick={(e) => {
                                                        const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                                                        const val = input.value?.trim();
                                                        if (val && !settings.targetProcessPatterns?.includes(val)) {
                                                            onSaveSettings({
                                                                ...settings,
                                                                targetProcessPatterns: [...(settings.targetProcessPatterns || []), val],
                                                                screenshotTargetProcess: val
                                                            });
                                                            input.value = '';
                                                        }
                                                    }}
                                                >
                                                    Add
                                                </Button>
                                            </div>

                                            <div className="flex items-center justify-between pt-1">
                                                <Label className="text-xs text-muted-foreground">{t('settings.screenshotOnlyActive')}</Label>
                                                <Switch
                                                    checked={settings.screenshotOnlyWhenActive !== false}
                                                    onCheckedChange={(c) => onSaveSettings({ ...settings, screenshotOnlyWhenActive: c })}
                                                    className="scale-90"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {settings.screenshotMode === 'screen' && (
                                        <div className="flex items-center justify-between pt-2">
                                            <div className="space-y-0.5">
                                                <Label className="text-sm font-medium">{t('settings.tracking.selectDisplay')}</Label>
                                                <p className="text-[10px] text-muted-foreground opacity-80">{t('settings.tracking.selectDisplayDesc')}</p>
                                            </div>
                                            <Select
                                                value={settings.screenshotDisplayId || ''}
                                                onValueChange={(val) => onSaveSettings({ ...settings, screenshotDisplayId: val })}
                                            >
                                                <SelectTrigger className="w-[200px] bg-background border-input h-8 text-xs">
                                                    <SelectValue placeholder={screenSources.length > 0 ? "Select Monitor" : "Loading..."} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {screenSources.length > 0 ? (
                                                        screenSources.map(s => (
                                                            <SelectItem key={s.id} value={s.id}>
                                                                <div className="flex items-center gap-2">
                                                                    {s.thumbnail && <img src={s.thumbnail} className="w-8 h-8 rounded object-cover border" alt="Screen" />}
                                                                    <span className="truncate max-w-[150px]">{s.name}</span>
                                                                </div>
                                                            </SelectItem>
                                                        ))
                                                    ) : (
                                                        <div className="p-2 text-xs text-center text-muted-foreground">No displays found</div>
                                                    )}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <Separator className="bg-border/40" />

                            {/* Location */}
                            <div className="flex flex-col gap-2 p-4 pt-4">
                                <Label className="text-sm font-medium">{t('settings.tracking.screenshotLocation')}</Label>
                                <div className="flex gap-2">
                                    <Input
                                        readOnly
                                        value={settings.screenshotPath || t('settings.tracking.defaultAppData')}
                                        className="flex-1 font-mono text-xs bg-background border-input h-9 opacity-80"
                                    />
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        className="h-9 shrink-0"
                                        onClick={async () => {
                                            if ((window as any).ipcRenderer) {
                                                const path = await (window as any).ipcRenderer.invoke('dialog:openDirectory');
                                                if (path) onSaveSettings({ ...settings, screenshotPath: path });
                                            }
                                        }}
                                    >
                                        {t('settings.tracking.change')}
                                    </Button>
                                </div>
                                <p className="text-[10px] text-muted-foreground text-right">
                                    {t('settings.tracking.oldScreenshotsDesc')}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
