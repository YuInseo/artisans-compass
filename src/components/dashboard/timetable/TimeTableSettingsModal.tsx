import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export function TimeTableSettingsModal({
    isIgnoredAppsModalOpen,
    setIsIgnoredAppsModalOpen,
    modalMode,
    appsToConfigure,
    settings,
    toggleAppIgnored,
    toggleWorkApp
}: any) {
    const { t } = useTranslation();

    return (
        <Dialog open={isIgnoredAppsModalOpen} onOpenChange={setIsIgnoredAppsModalOpen}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>
                        {modalMode === 'ignored'
                            ? t('settings.timeline.configureIgnoredApps')
                            : t('settings.timeline.configureWorkApps')}
                    </DialogTitle>
                    <DialogDescription>
                        {modalMode === 'ignored'
                            ? t('settings.timeline.configureIgnoredAppsDesc')
                            : t('settings.timeline.configureWorkAppsDesc')}
                    </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-6 py-4">
                    {/* 1. List of Currently Configured Apps (Badges) */}
                    <div className="flex flex-col gap-2">
                        <h4 className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                            {modalMode === 'ignored'
                                ? t('settings.timeline.ignoredAppsList')
                                : t('settings.timeline.workAppsList')}
                        </h4>
                        <div className="flex flex-wrap gap-2 min-h-[2.5rem] p-3 border rounded-md bg-muted/20">
                            {/* Check if empty */}
                            {appsToConfigure.filter((app: any) => {
                                const list = modalMode === 'ignored' ? settings?.ignoredApps : settings?.workApps;
                                return list?.includes(app.name);
                            }).length === 0 && (
                                    <span className="text-sm text-muted-foreground self-center italic">
                                        {modalMode === 'ignored'
                                            ? t('settings.timeline.noIgnoredApps')
                                            : t('settings.timeline.noAppsInList')}
                                    </span>
                                )}

                            {/* Render Badges */}
                            {appsToConfigure
                                .filter((app: any) => {
                                    const list = modalMode === 'ignored' ? settings?.ignoredApps : settings?.workApps;
                                    return list?.includes(app.name);
                                })
                                .map((app: any) => (
                                    <Badge
                                        key={app.name}
                                        variant={modalMode === 'ignored' ? "secondary" : "default"}
                                        className={cn(
                                            "pl-2 pr-1 h-7 text-sm flex items-center gap-1",
                                            modalMode === 'work' && "bg-blue-600 hover:bg-blue-700 text-white"
                                        )}
                                    >
                                        {app.name}
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className={cn(
                                                "h-4 w-4 ml-1 hover:bg-transparent rounded-full",
                                                modalMode === 'work' ? "text-blue-200 hover:text-white" : "text-muted-foreground hover:text-foreground"
                                            )}
                                            onClick={() => {
                                                if (modalMode === 'ignored') {
                                                    toggleAppIgnored(app.name, true);
                                                } else {
                                                    toggleWorkApp(app.name, true);
                                                }
                                            }}
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                    </Badge>
                                ))}
                        </div>
                    </div>

                    {/* 2. Dropdown to Add Apps to List */}
                    <div className="flex flex-col gap-2">
                        <h4 className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                            {modalMode === 'ignored'
                                ? t('settings.timeline.addIgnoredApp')
                                : t('settings.timeline.addWorkApp')}
                        </h4>
                        <Select onValueChange={(val) => {
                            if (modalMode === 'ignored') {
                                toggleAppIgnored(val, false);
                            } else {
                                toggleWorkApp(val, false);
                            }
                        }}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder={
                                    modalMode === 'ignored'
                                        ? t('settings.timeline.selectAppToIgnore')
                                        : t('settings.timeline.selectAppToAdd')
                                } />
                            </SelectTrigger>
                            <SelectContent>
                                {appsToConfigure.filter((app: any) => {
                                    const list = modalMode === 'ignored' ? settings?.ignoredApps : settings?.workApps;
                                    return !list?.includes(app.name);
                                }).length === 0 ? (
                                    <div className="p-2 text-sm text-muted-foreground text-center">
                                        {modalMode === 'ignored'
                                            ? t('settings.timeline.allAppsIgnored')
                                            : t('settings.timeline.allAppsAdded')}
                                    </div>
                                ) : (
                                    appsToConfigure
                                        .filter((app: any) => {
                                            const list = modalMode === 'ignored' ? settings?.ignoredApps : settings?.workApps;
                                            return !list?.includes(app.name);
                                        })
                                        .map((app: any) => {
                                            // Format duration
                                            const totalSeconds = app.duration;
                                            const m = Math.floor(totalSeconds / 60);
                                            const s = Math.floor(totalSeconds % 60);
                                            const durStr = m > 0 ? `${m} m` : `${s} s`;

                                            return (
                                                <SelectItem key={app.name} value={app.name}>
                                                    <span className="flex justify-between w-full gap-4">
                                                        <span>{app.name}</span>
                                                        <span className="text-muted-foreground font-mono text-xs opacity-70">({durStr})</span>
                                                    </span>
                                                </SelectItem>
                                            );
                                        })
                                )}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={() => setIsIgnoredAppsModalOpen(false)}>
                        {t('common.done')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}