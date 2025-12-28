import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { AppSettings } from "@/types";
import { Loader2, Check, ExternalLink, ChevronsUpDown, Search } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface NotionSetupDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    settings: AppSettings;
    onSaveSettings: (newSettings: AppSettings) => void;
    onComplete: () => void;
}

export function NotionSetupDialog({ open, onOpenChange, settings, onSaveSettings, onComplete }: NotionSetupDialogProps) {
    const [step, setStep] = useState<'prompt' | 'selecting' | 'creating' | 'success'>('prompt');
    const [pages, setPages] = useState<{ id: string, title: string, url: string }[]>([]);
    const [selectedPageId, setSelectedPageId] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [dbUrl, setDbUrl] = useState<string>("");

    // Combobox State
    const [openCombobox, setOpenCombobox] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    // Reset when opened
    useEffect(() => {
        if (open) {
            setStep('prompt');
            setError(null);
            setLoading(false);
            setSearchQuery("");
            setOpenCombobox(false);
        }
    }, [open]);

    const fetchPages = async () => {
        setLoading(true);
        setError(null);
        try {
            if ((window as any).ipcRenderer && settings.notionTokens?.accessToken) {
                const results = await (window as any).ipcRenderer.invoke('get-notion-pages', settings.notionTokens.accessToken);
                setPages(results);
                if (results.length > 0) {
                    setStep('selecting');
                } else {
                    setError("No accessible pages found. Please ensure you've shared pages with the integration.");
                }
            }
        } catch (e: any) {
            console.error("Failed to fetch pages", e);
            setError("Failed to load pages. Check your connection.");
        } finally {
            setLoading(false);
        }
    };

    const createDatabase = async () => {
        if (!selectedPageId) return;

        setStep('creating');
        setError(null);

        try {
            if ((window as any).ipcRenderer && settings.notionTokens?.accessToken) {
                const token = settings.notionTokens.accessToken;

                // 1. Check for existing DB
                const existing = await (window as any).ipcRenderer.invoke('check-existing-db', {
                    token,
                    pageId: selectedPageId
                });

                let result;
                if (existing) {
                    // Re-use
                    console.log("Found existing DB", existing);
                    result = { success: true, databaseId: existing.id, url: existing.url };
                } else {
                    // Create New
                    result = await (window as any).ipcRenderer.invoke('create-notion-database', {
                        token,
                        pageId: selectedPageId
                    });
                }

                if (result && result.success) {
                    // Save DB ID
                    const newTokens = { ...settings.notionTokens, databaseId: result.databaseId };
                    onSaveSettings({ ...settings, notionTokens: newTokens });
                    setDbUrl(result.url);
                    setStep('success');
                }
            }
        } catch (e: any) {
            console.error("Failed to create/link DB", e);
            setError("Failed to setup database. Please try again.");
            setStep('selecting'); // Go back
        }
    };

    const selectedPageTitle = pages.find(p => p.id === selectedPageId)?.title || "Select a page...";

    const filteredPages = pages.filter(page =>
        page.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const renderContent = () => {
        if (step === 'prompt') {
            return (
                <div className="space-y-4 pt-2">
                    <p className="text-sm text-muted-foreground">
                        Would you like to automatically backup your tasks and goals to Notion?
                        We can create a database in your Notion workspace to keep everything in sync.
                    </p>
                    {error && <p className="text-xs text-destructive">{error}</p>}
                    <DialogFooter className="mt-4 gap-2 sm:justify-start">
                        <Button
                            onClick={fetchPages}
                            disabled={loading}
                            className="w-full sm:w-auto"
                        >
                            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Yes, configure backup
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={() => onOpenChange(false)}
                            className="w-full sm:w-auto"
                        >
                            Not now
                        </Button>
                    </DialogFooter>
                </div>
            );
        }

        if (step === 'selecting') {
            return (
                <div className="space-y-4 pt-2">
                    <div className="space-y-2 flex flex-col">
                        <Label>Select a Page</Label>

                        <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={openCombobox}
                                    className="w-full justify-between"
                                >
                                    {selectedPageTitle}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                                <div className="p-2 border-b flex items-center gap-2">
                                    <Search className="w-4 h-4 opacity-50" />
                                    <Input
                                        placeholder="Search pages..."
                                        className="border-none h-8 select-none focus-visible:ring-0 px-0"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                                <ScrollArea className="h-[200px] p-1">
                                    {filteredPages.length === 0 ? (
                                        <p className="text-sm text-muted-foreground p-2 text-center">No pages found.</p>
                                    ) : (
                                        <div className="flex flex-col gap-1">
                                            {filteredPages.map(page => (
                                                <Button
                                                    key={page.id}
                                                    variant="ghost"
                                                    size="sm"
                                                    className={cn(
                                                        "justify-start font-normal",
                                                        selectedPageId === page.id && "bg-accent text-accent-foreground"
                                                    )}
                                                    onClick={() => {
                                                        setSelectedPageId(page.id);
                                                        setOpenCombobox(false);
                                                    }}
                                                >
                                                    <Check
                                                        className={cn(
                                                            "mr-2 h-4 w-4",
                                                            selectedPageId === page.id ? "opacity-100" : "opacity-0"
                                                        )}
                                                    />
                                                    {page.title}
                                                </Button>
                                            ))}
                                        </div>
                                    )}
                                </ScrollArea>
                            </PopoverContent>
                        </Popover>

                        <p className="text-xs text-muted-foreground">
                            The "Artisans Compass Backup" database will be created inside this page.
                        </p>
                    </div>
                    {error && <p className="text-xs text-destructive">{error}</p>}
                    <DialogFooter className="mt-4 gap-2 sm:justify-between">
                        <Button
                            variant="ghost"
                            onClick={() => setStep('prompt')}
                        >
                            Back
                        </Button>
                        <Button
                            onClick={createDatabase}
                            disabled={!selectedPageId || loading}
                        >
                            {/* Re-use loading state if needed for create action, currently distinct steps but `creating` step handles visual processing */}
                            Create Database
                        </Button>
                    </DialogFooter>
                </div>
            );
        }

        if (step === 'creating') {
            return (
                <div className="flex flex-col items-center justify-center py-8 space-y-4">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Creating database and syncing data...</p>
                </div>
            );
        }

        if (step === 'success') {
            return (
                <div className="flex flex-col items-center justify-center py-6 space-y-4 text-center">
                    <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                        <Check className="w-6 h-6 text-green-500" />
                    </div>
                    <div className="space-y-1">
                        <h4 className="font-semibold">Setup Complete!</h4>
                        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                            Your database has been created.
                        </p>
                    </div>

                    {dbUrl && (
                        <Button variant="outline" size="sm" className="gap-2" onClick={() => {
                            if ((window as any).ipcRenderer) {
                                (window as any).ipcRenderer.invoke('open-external', dbUrl);
                            } else {
                                window.open(dbUrl, '_blank');
                            }
                        }}>
                            Open in Notion <ExternalLink className="w-3 h-3" />
                        </Button>
                    )}

                    <Button className="w-full mt-4" onClick={onComplete}>
                        Done
                    </Button>
                </div>
            );
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Notion Backup Setup</DialogTitle>
                    {step === 'prompt' && <DialogDescription>Configure automatic data backup.</DialogDescription>}
                </DialogHeader>
                {renderContent()}
            </DialogContent>
        </Dialog>
    );
}
