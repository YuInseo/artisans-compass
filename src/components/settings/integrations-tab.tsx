
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog"
import { Cloud, FileText, Check, X, RefreshCw, Loader2, Link2 } from "lucide-react";
import { AppSettings } from "@/types"
import { useState } from "react"
import { useTranslation } from 'react-i18next';

interface IntegrationsTabProps {
    settings: AppSettings;
    onSaveSettings: (settings: AppSettings) => Promise<void>;
}

export function IntegrationsTab({ settings, onSaveSettings }: IntegrationsTabProps) {
    const { t } = useTranslation();
    const [manualNotionKey, setManualNotionKey] = useState("");
    const [isSyncingNotion, setIsSyncingNotion] = useState(false);
    const [isSyncingHistory, setIsSyncingHistory] = useState(false);

    // Dialog States
    const [showImportDialog, setShowImportDialog] = useState(false);
    const [importDate, setImportDate] = useState(new Date().toISOString().split('T')[0]);
    const [isImporting, setIsImporting] = useState(false);

    // Confirmation Dialog
    const [confirmConfig, setConfirmConfig] = useState<{
        title: string;
        description: string;
        actionLabel: string;
        onConfirm: () => void;
    } | null>(null);

    // Info/Result Dialog
    const [infoConfig, setInfoConfig] = useState<{
        title: string;
        description: string;
        details?: any[];
    } | null>(null);

    const handleConfirmClose = () => {
        setConfirmConfig(null);
    };

    const handleImport = async () => {
        if (!settings.notionTokens) return;
        setIsImporting(true);

        try {
            if ((window as any).ipcRenderer) {
                const res = await (window as any).ipcRenderer.invoke('import-notion-history', {
                    token: settings.notionTokens.accessToken,
                    databaseId: settings.notionTokens.databaseId,
                    date: importDate
                });

                setShowImportDialog(false);
                setInfoConfig({
                    title: res.success ? t('settings.backup.importSuccess') : t('settings.backup.importFailed'),
                    description: res.success ? t('settings.backup.importSuccessDesc', { count: res.count }) : res.error,
                    details: res.details
                });
            }
        } catch (e) {
            console.error(e);
            setInfoConfig({
                title: "Error",
                description: "Failed to import from Notion."
            });
        } finally {
            setIsImporting(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div>
                <h3 className="text-xl font-bold mb-4 text-foreground">{t('settings.backup.title')}</h3>
                <Separator className="bg-border/60" />
            </div>

            <div className="space-y-4">
                {/* Data Management */}
                <div className="p-4 bg-muted/30 rounded-lg flex flex-col gap-4 border border-border/50 mb-4" id="settings-data-management">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Cloud className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <h4 className="font-semibold text-base">{t('settings.backup.local')}</h4>
                            <p className="text-sm text-muted-foreground">{t('settings.backup.localDesc')}</p>
                        </div>
                    </div>
                    <div className="flex gap-4">
                        <Button
                            variant="outline"
                            onClick={async () => {
                                if ((window as any).ipcRenderer) {
                                    await (window as any).ipcRenderer.invoke('export-settings', settings);
                                }
                            }}
                            className="flex-1"
                        >
                            {t('settings.backup.export')}
                        </Button>
                        <Button
                            variant="outline"
                            onClick={async () => {
                                if ((window as any).ipcRenderer) {
                                    const newSettings = await (window as any).ipcRenderer.invoke('import-settings');
                                    if (newSettings) {
                                        onSaveSettings(newSettings);
                                        window.location.reload(); // Reload to apply changes cleanly
                                    }
                                }
                            }}
                            className="flex-1"
                        >
                            {t('settings.backup.import')}
                        </Button>
                    </div>
                    <div className="flex gap-4 mt-2">
                        <Button
                            variant="secondary"
                            onClick={async () => {
                                if ((window as any).ipcRenderer) {
                                    await (window as any).ipcRenderer.invoke('recover-from-screenshots');
                                }
                            }}
                            className="flex-1 gap-2"
                        >
                            <RefreshCw className="w-4 h-4" />
                            {t('settings.backup.importScreenshots')}
                        </Button>
                    </div>
                </div>
                {/* Notion Card */}
                <div className="p-4 bg-muted/30 rounded-lg flex flex-col gap-4 border border-border/50" id="settings-notion">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-500/10 flex items-center justify-center">
                                <FileText className="w-5 h-5 text-slate-500" />
                            </div>
                            <div>
                                <h4 className="font-semibold text-base">{t('settings.backup.notion')}</h4>
                                <p className="text-sm text-muted-foreground">{t('settings.backup.notionDesc')}</p>
                            </div>
                        </div>
                        {settings.notionTokens ? (
                            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20 px-2 py-0.5 flex items-center gap-1">
                                <Check className="w-3 h-3" />
                                {t('settings.backup.connected')}
                            </Badge>
                        ) : (
                            <Badge variant="outline" className="text-muted-foreground px-2 py-0.5">
                                {t('settings.backup.notConnected')}
                            </Badge>
                        )}
                    </div>

                    <div className="flex items-center justify-between pt-2">
                        <div className="text-xs text-muted-foreground flex flex-col gap-2">
                            <span>{settings.notionTokens ? t('settings.backup.connectedWorkspace', { name: settings.notionTokens.workspaceName || 'Unknown' }) : t('settings.backup.connectNotion')}</span>

                            {settings.notionTokens && (
                                <div className="flex items-center gap-2 mt-1">
                                    <Switch
                                        id="include-screenshots"
                                        className="scale-75 origin-left"
                                        checked={settings.notionConfig?.includeScreenshots !== false} // Default to true if undefined
                                        onCheckedChange={(checked) => onSaveSettings({
                                            ...settings,
                                            notionConfig: {
                                                clientId: '',
                                                clientSecret: '',
                                                ...(settings.notionConfig || {}),
                                                includeScreenshots: checked
                                            }
                                        })}
                                    />
                                    <Label htmlFor="include-screenshots" className="text-xs font-normal cursor-pointer">
                                        {t('settings.backup.includeScreenshots')}
                                    </Label>
                                </div>
                            )}
                        </div>

                        {settings.notionTokens ? (
                            <div className="flex gap-2 w-full justify-end items-center">
                                {isSyncingHistory ? (
                                    <div className="flex-1 mr-2 flex items-center gap-2 min-w-[240px]">
                                        <div className="flex-1 flex flex-col gap-1.5">
                                            <div className="flex justify-between text-[11px] text-muted-foreground px-1">
                                                <span id="sync-progress-label">{t('settings.backup.preparing')}</span>
                                                <span id="sync-progress-percent">0%</span>
                                            </div>
                                            <div className="h-2 w-full bg-secondary/50 rounded-full overflow-hidden border border-border/50">
                                                <div id="sync-progress-bar" className="h-full bg-primary transition-all duration-300 ease-out" style={{ width: '0%' }} />
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive shrink-0"
                                            onClick={() => {
                                                if ((window as any).ipcRenderer) {
                                                    (window as any).ipcRenderer.invoke('cancel-history-sync');
                                                }
                                            }}
                                            title={t('settings.backup.cancelSync')}
                                        >
                                            <X className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ) : (


                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setShowImportDialog(true)}
                                            className="h-8 gap-2"
                                        >
                                            <FileText className="w-3.5 h-3.5" />
                                            {t('settings.backup.import') || "Import"}
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={async () => {
                                                // TS Safe Check
                                                if (!settings.notionTokens) return;

                                                setConfirmConfig({
                                                    title: t('settings.backup.syncHistoryTitle'),
                                                    description: t('settings.backup.syncHistoryDesc'),
                                                    actionLabel: t('settings.backup.startSync'),
                                                    onConfirm: async () => {
                                                        setIsSyncingHistory(true);
                                                        if ((window as any).ipcRenderer) {
                                                            // Listen for progress
                                                            const progressHandler = (_: any, p: { processed: number, total: number, message?: string }) => {
                                                                const percent = p.total > 0 ? Math.round((p.processed / p.total) * 100) : 0;
                                                                // Update Bars
                                                                const labelEl = document.getElementById('sync-progress-label');
                                                                if (labelEl) {
                                                                    if (p.message) {
                                                                        labelEl.innerText = p.message;
                                                                    } else {
                                                                        labelEl.innerText = p.processed === 0 ? t('settings.backup.initializing') : t('settings.backup.syncingProgress', { processed: p.processed, total: p.total });
                                                                    }
                                                                }

                                                                const percentEl = document.getElementById('sync-progress-percent');
                                                                if (percentEl) percentEl.innerText = `${percent}%`;

                                                                const bar = document.getElementById('sync-progress-bar');
                                                                if (bar) bar.style.width = `${percent}%`;
                                                            };
                                                            (window as any).ipcRenderer.on('notion-sync-progress', progressHandler);

                                                            try {
                                                                const res = await (window as any).ipcRenderer.invoke('sync-all-history', {
                                                                    token: settings.notionTokens!.accessToken,
                                                                    databaseId: settings.notionTokens!.databaseId
                                                                });

                                                                if (res.success) {
                                                                    setInfoConfig({
                                                                        title: t('settings.backup.backupComplete'),
                                                                        description: t('settings.backup.backupSuccessMsg', { count: res.count }),
                                                                        details: res.details
                                                                    });
                                                                } else if (res.cancelled) {
                                                                    setInfoConfig({
                                                                        title: t('settings.backup.backupCancelled'),
                                                                        description: t('settings.backup.backupCancelledMsg', { count: res.count || 0 }),
                                                                    });
                                                                } else {
                                                                    setInfoConfig({
                                                                        title: t('settings.backup.backupFailed'),
                                                                        description: `Error: ${res.error}`,
                                                                        details: res.details
                                                                    });
                                                                }
                                                            } catch (e) {
                                                                console.error(e);
                                                                setInfoConfig({
                                                                    title: "Critical Error",
                                                                    description: "Backup encountered a critical error. Check console for details.",
                                                                });
                                                            } finally {
                                                                if ((window as any).ipcRenderer.removeListener) {
                                                                    (window as any).ipcRenderer.removeListener('notion-sync-progress', progressHandler);
                                                                } else {
                                                                    (window as any).ipcRenderer.off('notion-sync-progress', progressHandler);
                                                                }
                                                                setIsSyncingHistory(false);
                                                            }
                                                        }
                                                    }
                                                });
                                            }}
                                            disabled={isSyncingHistory}
                                            className="h-8 gap-2 border-primary/20 text-primary hover:text-primary hover:bg-primary/5"
                                        >
                                            <RefreshCw className="w-3.5 h-3.5" />
                                            {t('settings.backup.syncHistory')}
                                        </Button>

                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                setConfirmConfig({
                                                    title: t('settings.backup.disconnectNotionTitle'),
                                                    description: t('settings.backup.disconnectNotionConfirm'),
                                                    actionLabel: t('settings.backup.disconnect'),
                                                    onConfirm: async () => {
                                                        onSaveSettings({ ...settings, notionTokens: undefined });
                                                        if ((window as any).ipcRenderer) {
                                                            await (window as any).ipcRenderer.invoke('logout-notion');
                                                        }
                                                    }
                                                });
                                            }}
                                            className="h-8 text-destructive hover:text-destructive"
                                        >
                                            {t('settings.backup.disconnect')}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2 w-full max-w-sm">
                                <div className="space-y-2 mb-2 p-3 bg-background/50 rounded-md border border-border/50">
                                    <Label className="text-xs text-muted-foreground">{t('settings.backup.secretLabel')}</Label>
                                    <Input
                                        placeholder="secret_..."
                                        type="password"
                                        className="h-8 text-xs font-mono"
                                        value={manualNotionKey}
                                        onChange={(e) => setManualNotionKey(e.target.value)}
                                    />
                                    <Button
                                        size="sm"
                                        className="w-full h-8"
                                        disabled={!manualNotionKey.startsWith('secret_') || isSyncingNotion}
                                        onClick={async () => {
                                            if (!(window as any).ipcRenderer) return;
                                            setIsSyncingNotion(true);
                                            try {
                                                const res = await (window as any).ipcRenderer.invoke('connect-notion-with-key', manualNotionKey);
                                                if (res.success) {
                                                    onSaveSettings({
                                                        ...settings,
                                                        notionTokens: res.tokens
                                                    });
                                                } else {
                                                    alert("Failed to connect: " + res.error);
                                                }
                                            } catch (e) {
                                                alert("Error connecting to Notion");
                                            } finally {
                                                setIsSyncingNotion(false);
                                            }
                                        }}
                                    >
                                        {isSyncingNotion ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <Link2 className="w-3.5 h-3.5 mr-2" />}
                                        {t('settings.backup.connectManually')}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Confirmation Dialog needed for disconnect etc. */}
            <Dialog open={!!confirmConfig} onOpenChange={() => handleConfirmClose()}>
                <DialogContent className="max-w-[400px]">
                    <DialogTitle>{confirmConfig?.title}</DialogTitle>
                    <DialogDescription className="text-sm text-muted-foreground mb-6">
                        {confirmConfig?.description}
                    </DialogDescription>
                    <DialogFooter>
                        <Button variant="outline" onClick={handleConfirmClose} size="sm">
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                                confirmConfig?.onConfirm();
                                handleConfirmClose();
                            }}
                        >
                            {confirmConfig?.actionLabel || "Confirm"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Import from Notion Dialog */}
            <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
                <DialogContent className="max-w-[400px] bg-background border border-border shadow-lg p-6 rounded-lg font-sans z-[60]">
                    <DialogTitle className="text-lg font-bold mb-2">{t('settings.backup.importNotionTitle')}</DialogTitle>
                    <DialogDescription className="text-sm text-muted-foreground mb-4">
                        {t('settings.backup.importNotionDesc')}
                    </DialogDescription>
                    <div className="py-4 space-y-4">
                        <div className="flex flex-col gap-2">
                            <Label>{t('settings.backup.dateLabel')}</Label>
                            <Input
                                type="date"
                                value={importDate}
                                onChange={(e) => setImportDate(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setShowImportDialog(false)} disabled={isImporting} size="sm">
                            {t('common.cancel')}
                        </Button>
                        <Button
                            onClick={handleImport}
                            disabled={isImporting}
                            size="sm"
                        >
                            {isImporting ? t('settings.backup.importing') : t('settings.backup.import')}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Info/Result Dialog */}
            <Dialog open={!!infoConfig} onOpenChange={(open) => !open && setInfoConfig(null)}>
                <DialogContent className="max-w-[500px] bg-background border border-border shadow-lg p-0 rounded-lg font-sans z-[60] overflow-hidden flex flex-col max-h-[80vh]">
                    <div className="p-6 pb-2">
                        <DialogTitle className="text-lg font-bold mb-1">{infoConfig?.title}</DialogTitle>
                        <DialogDescription className="text-sm text-muted-foreground">
                            {infoConfig?.description}
                        </DialogDescription>
                    </div>

                    {infoConfig?.details && (
                        <div className="flex-1 overflow-y-auto px-6 py-2 min-h-0 border-y border-border/40 my-2 bg-muted/20">
                            <div className="space-y-1 text-xs font-mono">
                                {infoConfig.details.map((d, i) => (
                                    <div key={i} className="flex flex-col py-2 border-b border-border/30 last:border-0 hover:bg-muted/30">
                                        <div className={("flex justify-between items-center " + (d.status === 'error' ? "text-destructive" : "text-foreground"))}>
                                            <span className="opacity-90 font-medium">{d.date || d.file}</span>
                                            <div className="flex gap-3 items-center">
                                                {d.blocks !== undefined && <span className="text-[10px] opacity-60 uppercase tracking-widest">{d.blocks} blocks</span>}
                                                <span className={("font-bold " + (d.status === 'success' ? "text-green-600" : "text-red-500"))}>
                                                    {d.status === 'success' ? "OK" : "ERR"}
                                                </span>
                                            </div>
                                        </div>
                                        {d.status === 'error' && d.error && (
                                            <div className="text-[10px] text-destructive/80 mt-1 pl-2 border-l-2 border-destructive/20 break-all font-sans">
                                                {d.error}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="p-4 flex justify-end bg-muted/10">
                        <Button onClick={() => setInfoConfig(null)} size="sm">
                            Close
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
