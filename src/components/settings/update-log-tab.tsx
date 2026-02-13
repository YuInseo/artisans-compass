

import { Separator } from "@/components/ui/separator"
import { Clock } from "lucide-react"
import { useState, useEffect } from "react"
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from "@/lib/utils"

interface UpdateLog {
    version: string;
    date: string;
    title: string;
    file: string;
    content?: string;
}

export function UpdateLogTab() {
    const { t, i18n } = useTranslation();
    const [updates, setUpdates] = useState<UpdateLog[]>([]);
    const [selectedUpdate, setSelectedUpdate] = useState<UpdateLog | null>(null);

    const handleSelectUpdate = async (version: string, file: string) => {
        const selected = updates.find(u => u.version === version);
        if (selected?.content) {
            setSelectedUpdate(selected);
            return;
        }

        try {
            const lang = i18n.language || 'en';
            const localizedPath = `/updates/${lang}/${version}.md`;

            // Try localized first
            let res = await fetch(localizedPath);
            let text = "";

            if (res.ok) {
                text = await res.text();
                if (text.trim().toLowerCase().startsWith('<!doctype html')) {
                    // Fallback to default
                    res = await fetch(`/updates/${file}`);
                    text = await res.text();
                }
            } else {
                // Fallback to default
                res = await fetch(`/updates/${file}`);
                text = await res.text();
            }

            if (!res.ok || text.trim().toLowerCase().startsWith('<!doctype html')) {
                setSelectedUpdate({ ...selected!, content: "## Failed to load release notes." });
                return;
            }

            const updatedLog = { ...(selected || { version, date: "", title: "", file }), content: text };

            setUpdates(prev => prev.map(u => u.version === version ? updatedLog : u));
            setSelectedUpdate(updatedLog);

        } catch (e) {
            console.error("Failed to load update content", e);
            if (selected) {
                setSelectedUpdate({ ...selected, content: "## Failed to load release notes." });
            }
        }
    };

    useEffect(() => {
        fetch('/updates/index.json')
            .then(res => res.json())
            .then(async (data: { version: string, date: string, title: string, file: string }[]) => {
                // Filter out empty or missing logs
                const lang = i18n.language || 'en';

                const validUpdates = await Promise.all(data.map(async (update) => {
                    const localizedPath = `/updates/${lang}/${update.version}.md`;

                    try {
                        // Try localized first
                        let res = await fetch(localizedPath);
                        let text = "";

                        if (res.ok) {
                            text = await res.text();
                            if (text.trim().toLowerCase().startsWith('<!doctype html')) {
                                // Fallback to default
                                res = await fetch(`/updates/${update.file}`);
                                text = await res.text();
                            }
                        } else {
                            // Fallback to default
                            res = await fetch(`/updates/${update.file}`);
                            text = await res.text();
                        }

                        // Final Check
                        if (!res.ok || text.trim().toLowerCase().startsWith('<!doctype html') || text.includes("No release notes.")) {
                            return null;
                        }

                        return update;
                    } catch (e) {
                        return null;
                    }
                }));

                const filteredUpdates = validUpdates.filter(u => u !== null) as typeof data;
                setUpdates(filteredUpdates);

                // Select first by default if nothing selected
                if (filteredUpdates.length > 0) {
                    const v = filteredUpdates[0].version;
                    handleSelectUpdate(v, filteredUpdates[0].file);
                }
            })
            .catch(err => console.error("Failed to fetch updates index", err));
    }, [i18n.language]); // Refetch if language changes? Maybe.

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
                                    <span className="font-semibold">v{update.version}</span>
                                    <span className="text-[10px] opacity-70 truncate">{update.date}</span>
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
