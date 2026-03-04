
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"

import { Cloud, Check, RefreshCw, AlertCircle } from "lucide-react";
import { AppSettings } from "@/types"
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
    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* General Preferences Section */}
            <div className="sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pb-1 mb-4">
                <h3 className="text-xl font-bold text-foreground">{t('settings.general')}</h3>
                <Separator className="bg-border/60 mt-2" />
            </div>

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
            <Separator className="bg-border/30 mb-8" />



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
        </div>
    );
}
