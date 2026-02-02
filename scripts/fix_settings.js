import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, '..', 'src', 'components', 'settings-modal.tsx');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

// Keep the first 2062 lines (which ends with the closing brace of renderContent)
const keptLines = lines.slice(0, 2062);

const newContent = `
    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent
                    className="max-w-none w-full h-full p-0 gap-0 bg-transparent border-none shadow-none flex items-center justify-center pointer-events-none transform-none !translate-x-0 !translate-y-0 left-0 top-0"
                    hideCloseButton
                >
                    <div className="flex max-w-[1000px] h-[85vh] w-full bg-background border border-border shadow-2xl rounded-lg overflow-hidden font-sans pointer-events-auto relative select-none">
                        <DialogTitle className="sr-only">Settings</DialogTitle>
                        <DialogDescription className="sr-only">Adjust preferences and settings</DialogDescription>
                        {renderSidebar()}
                        {renderContent()}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Notion Setup Dialog */}
            {settings && (
                <NotionSetupDialog
                    open={showNotionSetup}
                    onOpenChange={setShowNotionSetup}
                    settings={settings}
                    onSaveSettings={onSaveSettings}
                    onComplete={() => setShowNotionSetup(false)}
                />
            )}

            {/* Custom Confirmation Dialog */}
            <Dialog open={!!confirmConfig} onOpenChange={(open) => !open && handleConfirmClose()}>
                <DialogContent className="max-w-[400px] bg-background border border-border shadow-lg p-6 rounded-lg font-sans z-[60]">
                    <DialogTitle className="text-lg font-bold mb-2">{confirmConfig?.title}</DialogTitle>
                    <DialogDescription className="text-sm text-muted-foreground mb-6">
                        {confirmConfig?.description}
                    </DialogDescription>
                    <div className="flex justify-end gap-3">
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
                    </div>
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
        </>
    )
}

interface SidebarButtonProps {
    active: boolean;
    onClick: () => void;
    label: string;
    icon?: React.ReactNode;
}

function SidebarButton({ active, onClick, label, icon }: SidebarButtonProps) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "w-full text-left px-3 py-2 rounded-md text-sm transition-all duration-200 flex items-center gap-2",
                active
                    ? "bg-primary text-primary-foreground shadow-md font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
        >
            {icon}
            {label}
        </button>
    );
}

function ThemeCard({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
    return (
        <div
            onClick={onClick}
            className={cn(
                "flex flex-col items-center justify-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 hover:scale-[1.02]",
                active
                    ? "border-primary bg-primary/5 shadow-md"
                    : "border-border/40 bg-card hover:border-primary/50 hover:bg-muted/30"
            )}
        >
            <div className={cn("transition-colors", active ? "text-primary" : "text-muted-foreground")}>
                {icon}
            </div>
            <span className={cn("text-xs font-semibold", active ? "text-primary" : "text-muted-foreground")}>{label}</span>
        </div>
    )
}
`;

const finalFileContent = keptLines.join('\n') + '\n' + newContent;
fs.writeFileSync(filePath, finalFileContent);
console.log('Successfully rewrote settings-modal.tsx');
