
import { Separator } from "@/components/ui/separator"
import { Clock } from "lucide-react"
import { useState, useEffect } from "react"
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from "@/lib/utils"

const version = import.meta.env.PACKAGE_VERSION;

interface UpdateLog {
    version: string;
    date: string;
    title: string;
    file: string;
    content?: string;
}

// Helper to fetch update content with fallback strategies
async function fetchUpdateContent(version: string, file: string, lang: string): Promise<string | null> {
    const primaryLang = lang.split('-')[0]; // e.g. 'ko-KR' -> 'ko'

    // Define language strategies to try
    const strategies = [
        lang,           // e.g. 'ko-KR'
        primaryLang,    // e.g. 'ko'
        'en'            // Fallback to English
    ];

    // Remove duplicates and empty strings
    const uniqueLangs = [...new Set(strategies)].filter(Boolean);

    const pathStrategies: string[] = [];

    for (const l of uniqueLangs) {
        // Priority 1: Exact filename in lang folder (e.g. ko/v0.3.1.md)
        pathStrategies.push(`/updates/${l}/${file}`);
        // Priority 2: Version based in lang folder (e.g. ko/0.3.1.md - for legacy support)
        pathStrategies.push(`/updates/${l}/${version}.md`);
    }

    // Finally root fallback (e.g. v0.3.1.md)
    pathStrategies.push(`/updates/${file}`);



    for (const path of pathStrategies) {
        try {
            // Add cache busting for content too, just in case
            const res = await fetch(`${path}?t=${Date.now()}`);
            if (res.ok) {
                const text = await res.text();
                // Validate content is not HTML (SPA fallback)
                if (!text.trim().toLowerCase().startsWith('<!doctype html')) {
                    return text;
                }
            }
        } catch (e) {
            // Ignore errors and continue to next strategy
        }
    }
    return null;
}

export function UpdateLogTab() {
    const { t, i18n } = useTranslation();
    const [updates, setUpdates] = useState<UpdateLog[]>([]);
    const [selectedUpdate, setSelectedUpdate] = useState<UpdateLog | null>(null);

    const handleSelectUpdate = async (version: string, file: string) => {
        const selected = updates.find(u => u.version === version);

        // If content is already loaded (and not just empty string/null), show it
        if (selected?.content) {
            setSelectedUpdate(selected);
            return;
        }

        try {
            const lang = i18n.language || 'en';
            // Start loading state (optional UI improvement)
            const text = await fetchUpdateContent(version, file, lang);

            const content = text || "## Failed to load release notes for this version.";

            // Attempt to parse date from content if missing or if we want to ensure accuracy
            const parsedDate = parseDateFromContent(content);
            const finalDate = parsedDate || selected?.date || "";

            // Update the single item with content AND date if we found one
            const updatedLog = {
                ...(selected || { version, title: "", file }),
                date: finalDate, // Use parsed date preference, fallback to existing
                content
            };

            // Update the list state to reflect the new date immediately
            setUpdates(prev => prev.map(u => u.version === version ? updatedLog : u));
            setSelectedUpdate(updatedLog);

        } catch (e) {
            console.error("Failed to load update content", e);
            if (selected) {
                const fallback = { ...selected, content: "## Failed to load release notes." };
                setUpdates(prev => prev.map(u => u.version === version ? fallback : u));
                setSelectedUpdate(fallback);
            }
        }
    };

    // Helper to parse date from markdown content
    const parseDateFromContent = (text: string): string | null => {
        // Match "**Date**: YYYY-MM-DD" or "Date: YYYY-MM-DD" or "날짜: YYYY-MM-DD" etc.
        // Flexible regex to catch common patterns in different languages
        const dateRegex = /(?:Date|날짜|日付|日時)\s*(?:[:：])?\s*(?:\*\*)?\s*(?:[:：])?\s*(\d{4}-\d{2}-\d{2})/i;
        const match = text.match(dateRegex);
        return match ? match[1] : null;
    };

    useEffect(() => {
        // Fetch index only
        // Add cache busting to force fresh load!
        fetch(`/updates/index.json?t=${Date.now()}`)
            .then(res => res.json())
            .then(async (data: { version: string, date: string, title: string, file: string }[]) => {

                // Initialize the list with basic data immediately
                setUpdates(data);

                // Auto-select the first item
                if (data.length > 0) {
                    const first = data[0];
                    handleSelectUpdate(first.version, first.file);
                }
            })
            .catch(err => console.error("Failed to fetch updates index", err));
    }, [i18n.language]);

    // Cleanup effect when language changes
    useEffect(() => {
        setUpdates(prev => prev.map(u => ({ ...u, content: undefined })));
        if (selectedUpdate) {
            handleSelectUpdate(selectedUpdate.version, selectedUpdate.file);
        }
    }, [i18n.language]);


    return (
        <div className="space-y-6 flex flex-col h-full animate-in fade-in duration-300">
            <div>
                <h3 className="text-xl font-bold mb-4 text-foreground">{t('settings.updates.title')}</h3>
                <Separator className="bg-border/60" />
            </div>

            <div className="flex flex-col md:flex-row gap-6 h-[500px] border rounded-lg overflow-hidden bg-background">
                {/* Sidebar List */}
                <div className="w-full md:w-1/3 border-r bg-muted/10 flex flex-col">
                    <div className="p-3 border-b bg-muted/20 font-medium text-xs text-muted-foreground uppercase tracking-wider">
                        {t('settings.updates.versionHistory')}
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                        {updates.map(update => (
                            <button
                                key={update.version}
                                onClick={() => handleSelectUpdate(update.version, update.file)}
                                className={cn(
                                    "w-full text-left px-3 py-2.5 rounded-md text-sm transition-all flex items-center justify-between group",
                                    selectedUpdate?.version === update.version
                                        ? "bg-primary/10 text-primary font-medium ring-1 ring-primary/20"
                                        : "hover:bg-muted text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <div className="flex flex-col">
                                    <span className="font-semibold flex items-center gap-2">
                                        v{update.version}
                                        {update.version === version && (
                                            <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-medium">
                                                {t('settings.softwareUpdate.currentVersionLabel')}
                                            </span>
                                        )}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground/70">{update.date || "Unknown Date"}</span>
                                </div>
                            </button>
                        ))}
                        {updates.length === 0 && (
                            <div className="text-sm text-muted-foreground p-2 text-center">No update logs found.</div>
                        )}
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 p-4">
                    {selectedUpdate ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                            <div className="mb-6 pb-4 border-b">
                                <h2 className="text-2xl font-bold m-0 p-0 text-foreground">v{selectedUpdate.version}</h2>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                    <Clock className="w-3.5 h-3.5" />
                                    <span>{selectedUpdate.date}</span>
                                </div>
                            </div>
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                    h1: ({ node, ...props }: any) => <h1 className="text-xl font-bold mb-3 mt-5 border-b pb-1" {...props} />,
                                    h2: ({ node, ...props }: any) => <h2 className="text-lg font-semibold mb-2 mt-4" {...props} />,
                                    h3: ({ node, ...props }: any) => <h3 className="text-base font-medium mb-2 mt-3" {...props} />,
                                    ul: ({ node, ...props }: any) => <ul className="list-disc pl-5 mb-2 space-y-1" {...props} />,
                                    ol: ({ node, ...props }: any) => <ol className="list-decimal pl-5 mb-2 space-y-1" {...props} />,
                                    li: ({ node, ...props }: any) => <li className="pl-1 text-sm text-foreground/90" {...props} />,
                                    p: ({ node, ...props }: any) => <p className="mb-2 text-sm leading-relaxed text-muted-foreground" {...props} />,
                                    a: ({ node, ...props }: any) => <a className="text-primary hover:underline underline-offset-4" {...props} />,
                                    blockquote: ({ node, ...props }: any) => <blockquote className="border-l-4 border-muted pl-4 italic text-muted-foreground my-4" {...props} />,
                                    code: ({ node, ...props }: any) => <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono" {...props} />,
                                }}
                            >
                                {selectedUpdate.content || ""}
                            </ReactMarkdown>
                        </div>
                    ) : (
                        <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                            Select a version to view details
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
