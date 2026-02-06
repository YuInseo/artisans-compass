import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { useTheme } from "@/components/theme-provider"
import { Badge } from "@/components/ui/badge"
import { X, Cloud, Check, Moon, Sun, Monitor, Info, FileText, RefreshCw, AlertCircle, History, Settings, Palette, LayoutTemplate, Shield, Database } from "lucide-react";
import { AppSettings } from "@/types"
import { useState, useEffect } from "react"
import { toast } from "sonner";
import { cn } from "@/lib/utils"
import { useTranslation, Trans } from 'react-i18next';
import { TimelineTab } from "./settings/timeline-tab";
// @ts-ignore
import { NotionSetupDialog } from "./notion-setup-dialog"; // Import
import { version } from "../../package.json";

export type SettingsTab = 'general' | 'appearance' | 'timeline' | 'tracking' | 'integrations' | 'updatelog';

interface SettingsModalProps {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    settings: AppSettings | null;
    onSaveSettings: (settings: AppSettings) => Promise<void>;
    defaultTab?: SettingsTab; // Optional default tab
}



export function SettingsModal({ open, onOpenChange, settings, onSaveSettings, defaultTab = 'general' }: SettingsModalProps) {
    const { setTheme, theme } = useTheme()
    const { t, i18n } = useTranslation();
    const [activeTab, setActiveTab] = useState<SettingsTab>(defaultTab);
    const [activeSection, setActiveSection] = useState<string | null>(null);

    // Sync activeTab with defaultTab when open changes
    useEffect(() => {
        if (open) {
            setActiveTab(defaultTab);
            setActiveSection(null);
        }
    }, [open, defaultTab]);

    // Custom Quotes State


    // General Tab State
    const [newAppInput, setNewAppInput] = useState("");
    const [runningApps, setRunningApps] = useState<{ id?: string, name: string, process: string, appIcon?: string }[]>([]);

    useEffect(() => {
        if (open && activeTab === 'timeline') {
            if ((window as any).ipcRenderer) {
                (window as any).ipcRenderer.invoke('get-running-apps').then((apps: any[]) => {
                    setRunningApps(apps || []);
                });
            }
        }
    }, [open, activeTab]);

    // Tracking Tab State
    const [screenSources, setScreenSources] = useState<{ id: string, name: string, thumbnail: string }[]>([]);

    // Notion Setup Dialog State
    const [showNotionSetup, setShowNotionSetup] = useState(false);

    // Notion Credentials State (Integrations)
    const [notionSecret, setNotionSecret] = useState("");
    const [isSyncingHistory, setIsSyncingHistory] = useState(false);
    const [showImportDialog, setShowImportDialog] = useState(false);
    const [importDate, setImportDate] = useState(new Date().toISOString().split('T')[0]);
    const [isImporting, setIsImporting] = useState(false);

    // Auto Update State
    const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'ready' | 'error'>('idle');
    const [updateProgress, setUpdateProgress] = useState(0);
    const [updateError, setUpdateError] = useState<string | null>(null);

    // Update Log State
    const [updates, setUpdates] = useState<{ version: string, date: string, title: string, file: string }[]>([]);
    const [selectedUpdate, setSelectedUpdate] = useState<{ version: string, content: string } | null>(null);

    useEffect(() => {
        if (open && activeTab === 'updatelog') {
            fetch('/updates/index.json')
                .then(res => res.json())
                .then(async (data) => {
                    // Filter out "no release" versions or versions without proper title
                    let candidates = data.filter((update: any) =>
                        update.title &&
                        update.title.toLowerCase() !== 'no release' &&
                        !update.title.toLowerCase().includes('unreleased')
                    );

                    // Pre-validate candidates to filter out missing files (404/HTML fallback)
                    const lang = i18n.language || 'en';
                    const validatedUpdates = [];

                    for (const update of candidates) {
                        const v = update.version;
                        const f = update.file;
                        // Try localized first, then default
                        const localizedPath = `/updates/${lang}/${v}.md`;
                        const defaultPath = `/updates/${f}`;

                        try {
                            // Try localized
                            let res = await fetch(localizedPath);
                            let text = "";
                            if (!res.ok) {
                                // Fallback
                                res = await fetch(defaultPath);
                            }

                            if (res.ok) {
                                text = await res.text();
                                // Check for HTML fallback (SPA 404)
                                if (!text.trim().toLowerCase().startsWith('<!doctype html>')) {
                                    validatedUpdates.push(update);
                                }
                            }
                        } catch (e) {
                            // Build error? Ignore.
                        }
                    }

                    setUpdates(validatedUpdates);

                    // Select first by default if nothing selected and list is not empty
                    if (validatedUpdates.length > 0 && !selectedUpdate) {
                        const first = validatedUpdates[0];
                        // We already verified it exists, so just fetch again or assume it works
                        // To be safe and consistent with handleSelectUpdate logic:
                        handleSelectUpdate(first.version, first.file);
                    }
                })
                .catch(err => console.error("Failed to fetch updates index", err));
        }
    }, [open, activeTab]);

    // Confirmation Dialog State
    const [confirmConfig, setConfirmConfig] = useState<{
        title: string;
        description: string;
        actionLabel: string;
        onConfirm: () => void;
    } | null>(null);

    const handleConfirmClose = () => {
        setConfirmConfig(null);
    };

    // Info Dialog State
    const [infoConfig, setInfoConfig] = useState<{
        title: string;
        description: string;
        details?: any[];
    } | null>(null);

    const handleImport = async () => {
        if (!settings?.notionTokens?.accessToken || !settings?.notionTokens?.databaseId) return;
        setIsImporting(true);
        try {
            if ((window as any).ipcRenderer) {
                const result = await (window as any).ipcRenderer.invoke('import-notion-log', {
                    token: settings.notionTokens.accessToken,
                    databaseId: settings.notionTokens.databaseId,
                    dateStr: importDate
                });

                if (result.success && result.data) {
                    // Save to local
                    await (window as any).ipcRenderer.invoke('save-daily-log', importDate, result.data);
                    setInfoConfig({
                        title: t('settings.backup.importComplete') || "Import Complete",
                        description: t('settings.backup.importSuccessMsg', { date: importDate }) || `Successfully imported records for ${importDate}`,
                    });
                    setShowImportDialog(false);
                    window.location.reload();
                } else {
                    setInfoConfig({
                        title: t('settings.backup.importFailed'),
                        description: `Error: ${result.error || 'Unknown error'}`,
                    });
                }
            }
        } catch (e) {
            console.error("Import error", e);
            setInfoConfig({
                title: "Critical Error",
                description: "Import encountered a critical error. Check console for details.",
            });
        } finally {
            setIsImporting(false);
        }
    };

    const handleSelectUpdate = (version: string, file: string) => {
        const lang = i18n.language || 'en';
        // Try localized path first: /updates/{lang}/{version}.md
        // Note: The file argument from index.json is typically "vX.X.X.md", so we might need just the version or strip 'v' if needed.
        // But our workflow creates /updates/ko/0.0.82.md. 
        // Let's assume the version string passed here matches the filename in language folders.

        const targetVersion = version; // e.g. "0.0.82"
        const localizedPath = `/updates/${lang}/${targetVersion}.md`;

        fetch(localizedPath)
            .then(res => {
                if (res.ok) return res.text();
                // Fallback to default file path provided in index.json
                return fetch(`/updates/${file}`).then(res => {
                    if (res.ok) return res.text();
                    throw new Error("Update log not found");
                });
            })
            .then(text => {
                // Double check if text looks like HTML (DOCTYPE) which usually means 404 in SPA
                if (text.trim().toLowerCase().startsWith('<!doctype html>')) {
                    throw new Error("Invalid log content (HTML detected)");
                }
                setSelectedUpdate({ version, content: text });
            })
            .catch(err => {
                console.error("Failed to fetch update log", err);
                setSelectedUpdate({ version, content: `Error loading patch notes: ${err.message}` });
            });
    };

    // Simple Markdown Parser (Basic)
    const renderMarkdown = (text: string) => {
        if (!text) return null;
        const lines = text.split('\n');

        // Helper to parse inline styles
        const parseInline = (line: string) => {
            if (!line) return "";
            // Replace **bold** with <strong>bold</strong>
            const parts = line.split(/(\*\*.*?\*\*)/g);
            return parts.map((part, i) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                    return <strong key={i} className="font-bold text-foreground">{part.slice(2, -2)}</strong>;
                }
                return part;
            });
        };

        return lines.map((line, i) => {
            const trimmed = line.trim();
            if (line.startsWith('# ')) {
                return <h1 key={i} className="text-2xl font-bold mb-4 mt-6 border-b pb-2">{parseInline(line.replace('# ', ''))}</h1>;
            } else if (line.startsWith('## ')) {
                return <h2 key={i} className="text-xl font-semibold mb-3 mt-5">{parseInline(line.replace('## ', ''))}</h2>;
            } else if (line.startsWith('### ')) {
                return <h3 key={i} className="text-lg font-medium mb-2 mt-4">{parseInline(line.replace('### ', ''))}</h3>;
            } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                // Remove the bullet marker
                const content = trimmed.substring(2);
                return <div key={i} className="flex items-start mb-1 ml-4">
                    <span className="mr-2 text-foreground/70">•</span>
                    <span className="text-sm text-foreground/90 leading-relaxed">{parseInline(content)}</span>
                </div>;
            } else if (trimmed === '') {
                return <div key={i} className="h-2" />;
            } else {
                return <p key={i} className="mb-2 text-sm leading-relaxed text-muted-foreground">{parseInline(line)}</p>;
            }
        });
    };

    useEffect(() => {
        if (!open) return;

        const onUpdateState = (_: any, state: { status: string; info?: any; progress?: any; error?: string; message?: string }) => {
            console.log('[Settings] Update State:', state);

            // Map backend 'idle' with 'up-to-date' message to 'not-available' for UI feedback
            if (state.status === 'idle' && state.message === 'up-to-date') {
                setUpdateStatus('not-available');
                toast.info(t('update.upToDateTitle') || "You are using the latest version.");
                return;
            }

            // Map other statuses directly if they match
            // Backend: checking, available, downloading, ready, error, idle
            // Frontend: idle, checking, available, not-available, downloading, ready, error
            if (state.status === 'downloading' && state.progress) {
                setUpdateStatus('downloading');
                setUpdateProgress(state.progress.percent);
            } else {
                setUpdateStatus(state.status as any);

                // Auto-trigger download if available, as the UI implies it's happening
                if (state.status === 'available') {
                    // Only show toast if transitioning from checking or idle to avoid spamming
                    if (updateStatus === 'checking' || updateStatus === 'idle') {
                        toast.success(t('update.availableTitle') || "New update available. Downloading...", {
                            action: {
                                label: t('settings.updateLog') || "View Log",
                                onClick: () => setActiveTab('updatelog')
                            }
                        });
                    }

                    if ((window as any).ipcRenderer) {
                        (window as any).ipcRenderer.invoke('download-update').catch((err: any) => console.error("Failed to start download", err));
                    }
                }
            }

            if (state.error) {
                setUpdateError(state.error);
                toast.error(t('update.failedTitle') || "Update check failed.");
            }
        };

        if ((window as any).ipcRenderer) {
            (window as any).ipcRenderer.on('update-state', onUpdateState);
        }

        return () => {
            if ((window as any).ipcRenderer) {
                (window as any).ipcRenderer.removeListener('update-state', onUpdateState);
            }
        };
    }, [open]);

    const checkForUpdates = async () => {
        setUpdateStatus('checking');
        setUpdateError(null);

        // Timeout Safety
        const timeoutId = setTimeout(() => {
            setUpdateStatus((prev) => {
                if (prev === 'checking') {
                    const msg = t('update.timeout') || "Connection timed out.";
                    toast.error(msg);
                    setUpdateError(msg);
                    return 'error';
                }
                return prev;
            });
        }, 15000); // 15 seconds timeout

        if ((window as any).ipcRenderer) {
            try {
                const result = await (window as any).ipcRenderer.invoke('check-for-updates');

                // If we get a result back immediately (e.g. null in dev mode or "skipped"), 
                // and we are still in 'checking' phase, it means the event chain didn't happen.
                // We should manually settle the state.
                setUpdateStatus((prev) => {
                    if (prev === 'checking') {
                        clearTimeout(timeoutId);
                        // If result is null/undefined, likely skipped or no update info found
                        if (!result) {
                            // Basic dev mode check heuristic or just informative toast
                            toast.info("Update check complete. (Dev Mode: Update skipped)");
                            return 'not-available';
                        }
                        // If result exists but we are still checking, maybe wait a bit? 
                        // But usually events fire. Let's trust the events if result is present.
                        // However, if result indicates NO update, we might want to set not-available.
                        // For now, let's assume null result = dev/skip.
                        return prev;
                    }
                    return prev;
                });

            } catch (e: any) {
                clearTimeout(timeoutId);
                setUpdateStatus('error');
                setUpdateError(e.message);

                // User specifically mentioned this error string for dev mode
                if (e.message && (e.message.includes('not packed') || e.message.includes('dev update config'))) {
                    toast.info("Development Mode: Update check skipped.");
                } else {
                    toast.error(t('update.failedTitle') || "Update check failed.");
                }
            }
        } else {
            clearTimeout(timeoutId);
        }
    };

    const quitAndInstall = () => {
        if ((window as any).ipcRenderer) {
            (window as any).ipcRenderer.invoke('quit-and-install');
        }
    };

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
            targetProcessPatterns: settings.targetProcessPatterns.filter(p => p !== appToRemove)
        });
    };

    useEffect(() => {
        if (open && activeTab === 'general') {
            fetchRunningApps();
        }
        if (open && activeTab === 'tracking') {
            // Only fetch if not already loaded (cache)
            if (screenSources.length === 0) {
                const fetchSources = async () => {
                    if ((window as any).ipcRenderer) {
                        try {
                            const [sources, monitorNames] = await Promise.all([
                                (window as any).ipcRenderer.invoke('get-screen-sources'),
                                (window as any).ipcRenderer.invoke('get-monitor-names').catch(() => [])
                            ]);

                            console.log('[Settings] Screen Sources:', sources);
                            console.log('[Settings] Monitor Names (WMI):', monitorNames);

                            // Map WMI names to Electron sources by index
                            // This relies on the OS reporting order being consistent, which is the standard heuristic
                            const mappedSources = sources.map((s: any, index: number) => {
                                let displayName = s.name; // Default "Screen 1"

                                if (index < monitorNames.length) {
                                    const info = monitorNames[index];
                                    if (info.name && info.name.trim()) {
                                        // Format: "Samsung G7 (Screen 1)"
                                        displayName = `${info.name} (${s.name})`;
                                    }
                                }
                                return { ...s, name: displayName };
                            });

                            setScreenSources(mappedSources);
                        } catch (e) {
                            console.error("Failed to fetch screen sources", e);
                        }
                    }
                };
                fetchSources();
            }
        }
    }, [open, activeTab, screenSources.length]);

    // Sidebar Button Component
    const SidebarButton = ({ active, onClick, label, icon }: { active: boolean, onClick: () => void, label: string, icon?: React.ReactNode }) => (
        <button
            onClick={onClick}
            className={cn(
                "relative w-full text-left px-3 py-2 rounded-md text-sm transition-all duration-200 hover:scale-[1.01] group",
                active
                    ? "bg-primary/10 text-primary font-medium shadow-md"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
        >
            {active && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-7 bg-primary rounded-r-full transition-all duration-200" />
            )}
            <div className="relative z-10 flex items-center gap-2">
                {icon}
                <span className={cn("transition-colors", active ? "text-primary" : "text-muted-foreground")}>{label}</span>
            </div>
        </button>
    );

    // Section Button Component (Indented sub-items)
    const SectionButton = ({ active, onClick, label }: { active: boolean, onClick: () => void, label: string }) => (
        <button
            onClick={onClick}
            className={cn(
                "w-full text-left pl-10 pr-3 py-1.5 rounded-md text-sm transition-colors",
                active
                    ? "text-primary font-medium bg-primary/5"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
        >
            {label}
        </button>
    );

    const scrollToSection = (sectionId: string) => {
        const element = document.getElementById(sectionId);
        if (element) {
            // Check if element is inside the update log view (different scrolling container)
            // But we only call this for main tabs.
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            setActiveSection(sectionId);
        }
    };

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        if (!activeTab || activeTab === 'updatelog') return;

        const sectionMap: Record<string, string[]> = {
            general: ['settings-language', 'settings-weekly', 'settings-tracked-apps', 'settings-running-apps', 'settings-startup'],
            appearance: ['settings-theme', 'settings-color-theme', 'settings-widgets', 'settings-editor'],
            timeline: ['settings-project-types', 'settings-timeline-preview', 'settings-work-apps'],
            tracking: ['settings-screenshot-enable', 'settings-idle-time', 'settings-screenshot-interval', 'settings-timelapse', 'settings-screenshot-mode']
        };

        const currentSections = sectionMap[activeTab];
        if (!currentSections) return;

        const containerRect = e.currentTarget.getBoundingClientRect();
        let currentActive = currentSections[0];

        // Find the last section that has started (top is above a threshold)
        for (const id of currentSections) {
            const el = document.getElementById(id);
            if (el) {
                const rect = el.getBoundingClientRect();
                const relativeTop = rect.top - containerRect.top;
                // Threshold: 150px from top
                if (relativeTop < 200) {
                    currentActive = id;
                }
            }
        }

        if (currentActive !== activeSection) {
            setActiveSection(currentActive);
        }
    };

    const renderSidebar = () => (
        <div className="w-[210px] shrink-0 bg-muted/30 flex flex-col p-2 gap-[2px] justify-end md:justify-start select-none">
            <div className="px-3 pt-6 pb-3 md:pt-4">
                <h2 className="text-xs font-bold text-muted-foreground uppercase px-2 mb-1">{t('settings.userSettings')}</h2>
            </div>

            <SidebarButton
                active={activeTab === 'general'}
                onClick={() => { setActiveTab('general'); setActiveSection(null); }}
                label={t('settings.general')}
                icon={<Settings className="w-4 h-4 mr-2" />}
            />
            {activeTab === 'general' && (
                <div className="flex flex-col gap-[2px]">
                    <SectionButton
                        active={activeSection === 'settings-language'}
                        onClick={() => scrollToSection('settings-language')}
                        label={t('settings.language')}
                    />
                    <SectionButton
                        active={activeSection === 'settings-weekly'}
                        onClick={() => scrollToSection('settings-weekly')}
                        label={t('settings.weeklySchedule')}
                    />
                    <SectionButton
                        active={activeSection === 'settings-tracked-apps'}
                        onClick={() => scrollToSection('settings-tracked-apps')}
                        label={t('settings.monitoredProcesses')}
                    />
                    <SectionButton
                        active={activeSection === 'settings-running-apps'}
                        onClick={() => scrollToSection('settings-running-apps')}
                        label={t('settings.runningApps.title')}
                    />
                    <SectionButton
                        active={activeSection === 'settings-startup'}
                        onClick={() => scrollToSection('settings-startup')}
                        label={t('settings.startupBehavior')}
                    />
                </div>
            )}

            <SidebarButton
                active={activeTab === 'appearance'}
                onClick={() => { setActiveTab('appearance'); setActiveSection(null); }}
                label={t('settings.appearance.title')}
                icon={<Palette className="w-4 h-4 mr-2" />}
            />
            {activeTab === 'appearance' && (
                <div className="flex flex-col gap-[2px]">
                    <SectionButton
                        active={activeSection === 'settings-theme'}
                        onClick={() => scrollToSection('settings-theme')}
                        label={t('settings.theme')}
                    />
                    <SectionButton
                        active={activeSection === 'settings-color-theme'}
                        onClick={() => scrollToSection('settings-color-theme')}
                        label={t('settings.appearance.colorTheme')}
                    />
                    <SectionButton
                        active={activeSection === 'settings-widgets'}
                        onClick={() => scrollToSection('settings-widgets')}
                        label={t('settings.widgetSettings')}
                    />
                    <SectionButton
                        active={activeSection === 'settings-editor'}
                        onClick={() => scrollToSection('settings-editor')}
                        label={t('settings.appearance.indentationLines')}
                    />
                    <SectionButton
                        active={activeSection === 'settings-quotes'}
                        onClick={() => scrollToSection('settings-quotes')}
                        label={t('settings.appearance.customQuotes')}
                    />
                </div>
            )}

            <SidebarButton
                active={activeTab === 'timeline'}
                onClick={() => { setActiveTab('timeline'); setActiveSection(null); }}
                label={t('sidebar.timeline')}
                icon={<LayoutTemplate className="w-4 h-4" />}
            />
            {activeTab === 'timeline' && (
                <div className="flex flex-col gap-[2px]">
                    <SectionButton
                        active={activeSection === 'settings-project-types'}
                        onClick={() => scrollToSection('settings-project-types')}
                        label={t('settings.projectTypes')}
                    />
                    <SectionButton
                        active={activeSection === 'settings-timeline-preview'}
                        onClick={() => scrollToSection('settings-timeline-preview')}
                        label={t('settings.timeline.dragPreview')}
                    />
                    <SectionButton
                        active={activeSection === 'settings-work-apps'}
                        onClick={() => scrollToSection('settings-work-apps')}
                        label={t('settings.timeline.workApps')}
                    />
                </div>
            )}

            <SidebarButton
                active={activeTab === 'tracking'}
                onClick={() => { setActiveTab('tracking'); setActiveSection(null); }}
                label={t('settings.tracking.title')}
                icon={<Shield className="w-4 h-4 mr-2" />}
            />
            {activeTab === 'tracking' && (
                <div className="flex flex-col gap-[2px]">
                    <SectionButton
                        active={activeSection === 'settings-screenshot-enable'}
                        onClick={() => scrollToSection('settings-screenshot-enable')}
                        label={t('settings.tracking.screenshotActivation')}
                    />
                    <SectionButton
                        active={activeSection === 'settings-idle-time'}
                        onClick={() => scrollToSection('settings-idle-time')}
                        label={t('settings.tracking.idleDetection')}
                    />
                    <SectionButton
                        active={activeSection === 'settings-screenshot-interval'}
                        onClick={() => scrollToSection('settings-screenshot-interval')}
                        label={t('settings.tracking.screenshotInterval')}
                    />
                    <SectionButton
                        active={activeSection === 'settings-timelapse'}
                        onClick={() => scrollToSection('settings-timelapse')}
                        label={t('settings.tracking.timelapseSpeed')}
                    />
                    <SectionButton
                        active={activeSection === 'settings-screenshot-mode'}
                        onClick={() => scrollToSection('settings-screenshot-mode')}
                        label={t('settings.tracking.screenshotMode')}
                    />
                </div>
            )}

            <SidebarButton
                active={activeTab === 'integrations'}
                onClick={() => { setActiveTab('integrations'); setActiveSection(null); }}
                label={t('settings.backup.title')}
                icon={<Database className="w-4 h-4 mr-2" />}
            />
            <SidebarButton
                active={activeTab === 'updatelog'}
                onClick={() => { setActiveTab('updatelog'); setActiveSection(null); }}
                label={t('settings.updateLog') || "패치 노트"}
                icon={<History className="w-4 h-4 mr-2" />}
            />


            <div className="my-2 px-2"><Separator className="bg-border/50" /></div>

            {/* Close Button Mobile/Embedded */}
            <div className="mt-auto p-2 pb-5 md:hidden">
                <Button variant="destructive" className="w-full" onClick={() => onOpenChange?.(false)}>Close</Button>
            </div>

            <div className="mt-auto pl-5 py-4 text-xs text-muted-foreground/30 font-mono text-left mb-1 hidden md:block">
                v{version}
            </div>
        </div>
    );

    const renderGeneralTab = () => {
        if (!settings) return null;

        return (
            <div className="space-y-6 animate-in fade-in duration-300">
                {/* General Preferences Section */}
                <div>
                    <h3 className="text-xl font-bold mb-4 text-foreground">{t('settings.general')}</h3>
                    <Separator className="bg-border/60 mb-6" />

                    <div id="settings-language" className="space-y-4 mb-8">
                        <h5 className="text-base font-semibold text-foreground mb-1">{t('settings.language')}</h5>
                        <div className="flex flex-col gap-3">
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

                    <div id="settings-weekly" className="space-y-4 mb-8">
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
                <div id="settings-tracked-apps" className="space-y-2 pt-2">
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
                <div id="settings-running-apps" className="mt-8 pt-4">
                    <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">{t('settings.runningApps.title')}</h5>
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
                                <div className="p-4 text-center text-sm text-muted-foreground">{t('settings.runningApps.scanning')}</div>
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
                                                    {t('settings.runningApps.add')}
                                                </Button>
                                            </div>
                                        ))
                                    }
                                </>
                            )}
                        </div>
                    </div>
                    {/* Startup Behavior */}
                    <div id="settings-startup" className="mt-8 pt-4 border-t border-border/40">
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
                                            console.warn("Auto-launch change rejected by backend");
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

                    {/* Developer Options (Added to General Tab) */}
                    <div className="mt-8 pt-4 border-t border-border/40">
                        <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-4">{t('settings.developerOptions')}</h5>

                        <div className="flex flex-col gap-4">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label className="text-sm font-medium">{t('settings.developerMode')}</Label>
                                    <p className="text-xs text-muted-foreground">{t('settings.developerModeDesc')}</p>
                                </div>
                                <Switch
                                    checked={settings.developerMode || false}
                                    onCheckedChange={(checked) => {
                                        onSaveSettings({ ...settings, developerMode: checked });
                                        if ((window as any).ipcRenderer) {
                                            (window as any).ipcRenderer.send('toggle-devtools', checked);
                                        }
                                    }}
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label className="text-sm font-medium">{t('settings.debuggerMode')}</Label>
                                    <p className="text-xs text-muted-foreground">{t('settings.debuggerModeDesc')}</p>
                                </div>
                                <Switch
                                    checked={settings.debuggerMode || false}
                                    onCheckedChange={(checked) => onSaveSettings({ ...settings, debuggerMode: checked })}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Update Section */}
                    <div className="mt-8 pt-4 border-t border-border/40">
                        <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-4">{t('settings.softwareUpdate.title')}</h5>
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
                                        <h4 className="font-medium text-sm">{t('settings.softwareUpdate.statusTitle')}</h4>
                                        <p className="text-xs text-muted-foreground">
                                            {updateStatus === 'idle' && `${t('settings.softwareUpdate.currentVersion')}: v${version}`}
                                            {updateStatus === 'checking' && t('settings.softwareUpdate.checking')}
                                            {updateStatus === 'available' && t('settings.softwareUpdate.available')}
                                            {updateStatus === 'not-available' && `${t('settings.softwareUpdate.upToDate')} (v${version})`}
                                            {updateStatus === 'downloading' && `${t('settings.softwareUpdate.downloading')}: ${Math.round(updateProgress)}%`}
                                            {updateStatus === 'ready' && t('settings.softwareUpdate.ready')}
                                            {updateStatus === 'error' && t('settings.softwareUpdate.failed')}
                                        </p>
                                    </div>
                                </div>

                                {updateStatus === 'idle' || updateStatus === 'not-available' || updateStatus === 'error' ? (
                                    <Button variant="outline" size="sm" onClick={checkForUpdates}>
                                        {t('settings.softwareUpdate.checkForUpdates')}
                                    </Button>
                                ) : updateStatus === 'ready' ? (
                                    <Button size="sm" onClick={quitAndInstall}>
                                        {t('settings.softwareUpdate.restartAndInstall')}
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
            </div>
        );
    };

    const renderContent = () => {
        if (!settings) return null;

        return (
            <div className="flex-1 flex flex-col h-full overflow-hidden bg-background relative select-none">
                {/* Close Button X (Floating Top Right) */}
                <div className="absolute top-9 right-9 z-50 flex flex-col items-center gap-1 group cursor-pointer" onClick={() => onOpenChange?.(false)}>
                    <div className="w-9 h-9 border-2 border-muted-foreground/40 rounded-full flex items-center justify-center transition-colors group-hover:bg-muted-foreground/10 group-hover:border-foreground/60">
                        <X className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </div>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase opacity-0 group-hover:opacity-100 transition-opacity">Esc</span>
                </div>

                {/* UpdateLog Tab - Separate Layout with Independent Scrolling */}
                {activeTab === 'updatelog' && (
                    <div className="flex-1 flex flex-col h-full overflow-hidden px-10 py-[60px]">
                        <div className="space-y-6 animate-in fade-in duration-300 h-full flex flex-col">
                            <div>
                                <h3 className="text-xl font-bold mb-4 text-foreground">{t('settings.updateLog') || "패치 노트"}</h3>
                                <Separator className="bg-border/60" />
                            </div>

                            <div className="flex-1 flex gap-6 overflow-hidden">
                                {/* Version List */}
                                <div className="w-[200px] shrink-0 border-r border-border/40 pr-4 overflow-y-auto custom-scrollbar">
                                    <div className="space-y-1">
                                        {updates.map((update) => (
                                            <button
                                                key={update.version}
                                                onClick={() => handleSelectUpdate(update.version, update.file)}
                                                className={cn(
                                                    "w-full text-left px-3 py-2 rounded-md text-sm transition-colors",
                                                    selectedUpdate?.version === update.version
                                                        ? "bg-primary/10 text-primary font-medium"
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
                                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                                    {selectedUpdate ? (
                                        <div className="prose prose-sm dark:prose-invert max-w-none">
                                            {renderMarkdown(selectedUpdate.content)}
                                        </div>
                                    ) : (
                                        <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                                            Select a version to view details
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Other Tabs - Normal ScrollArea */}
                {activeTab !== 'updatelog' && (
                    <ScrollArea className="h-full px-10 py-[60px]" onScroll={handleScroll}>
                        <div className="max-w-[700px] pb-20">
                            {/* Tab Content */}
                            {activeTab === 'general' && renderGeneralTab()}

                            {activeTab === 'appearance' && (
                                <div className="space-y-8 animate-in fade-in duration-300">
                                    <div>
                                        <h3 className="text-xl font-bold mb-4 text-foreground">{t('settings.appearance.title')}</h3>
                                        <Separator className="bg-border/60" />
                                    </div>

                                    <div id="settings-theme" className="space-y-4">
                                        <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">{t('settings.theme')}</h5>
                                        <div className="grid grid-cols-3 gap-4">
                                            <ThemeCard
                                                active={theme === 'light'}
                                                onClick={() => {
                                                    setTheme('light');
                                                    if (settings.widgetDisplayMode !== 'none') {
                                                        onSaveSettings({ ...settings, widgetTheme: 'light' });
                                                    } else {
                                                        onSaveSettings({ ...settings, mainTheme: 'light' });
                                                    }
                                                }}
                                                icon={<Sun className="w-6 h-6" />}
                                                label={t('settings.light')}
                                            />
                                            <ThemeCard
                                                active={theme === 'dark'}
                                                onClick={() => {
                                                    setTheme('dark');
                                                    if (settings.widgetDisplayMode !== 'none') {
                                                        onSaveSettings({ ...settings, widgetTheme: 'dark' });
                                                    } else {
                                                        onSaveSettings({ ...settings, mainTheme: 'dark' });
                                                    }
                                                }}
                                                icon={<Moon className="w-6 h-6" />}
                                                label={t('settings.dark')}
                                            />
                                            <ThemeCard
                                                active={theme === 'system'}
                                                onClick={() => {
                                                    setTheme('system');
                                                    if (settings.widgetDisplayMode !== 'none') {
                                                        onSaveSettings({ ...settings, widgetTheme: 'system' });
                                                    } else {
                                                        onSaveSettings({ ...settings, mainTheme: 'system' });
                                                    }
                                                }}
                                                icon={<Monitor className="w-6 h-6" />}
                                                label={t('settings.system')}
                                            />
                                        </div>
                                    </div>

                                    <Separator className="bg-border/30" />

                                    <div id="settings-color-theme" className="space-y-4">
                                        <h5 className="text-base font-semibold text-foreground mb-1">{t('settings.appearance.colorTheme') || "Color Theme"}</h5>
                                        <div className="flex flex-col gap-4 bg-muted/30 p-4 rounded-lg">
                                            <div className="flex items-center gap-4">
                                                <Select
                                                    value={settings.themePreset || 'default'}
                                                    onValueChange={(val: any) => {
                                                        // Check if it's a saved theme ID
                                                        const savedTheme = settings.customThemes?.find(t => t.id === val);
                                                        if (savedTheme) {
                                                            // Maintain the selected ID but sync the CSS to customCSS property for the editor if they choose to edit later
                                                            onSaveSettings({
                                                                ...settings,
                                                                themePreset: val,
                                                                customCSS: savedTheme.css
                                                            });
                                                        } else {
                                                            onSaveSettings({ ...settings, themePreset: val });
                                                        }
                                                    }}
                                                >
                                                    <SelectTrigger className="w-[200px] bg-background border-none">
                                                        {/* Display name logic including handling saved themes visually if needed, though they switch to custom */}
                                                        <SelectValue placeholder="Select Theme" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="default">Default (Slate)</SelectItem>
                                                        <SelectItem value="discord">Discord (Gamer)</SelectItem>
                                                        <SelectItem value="midnight">Midnight (OLED)</SelectItem>

                                                        {settings.customThemes && settings.customThemes.length > 0 && (
                                                            <>
                                                                <Separator className="my-1 opacity-50" />
                                                                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{t('settings.appearance.myThemes')}</div>
                                                                {settings.customThemes.map(theme => (
                                                                    <SelectItem key={theme.id} value={theme.id}>
                                                                        {theme.name}
                                                                    </SelectItem>
                                                                ))}
                                                            </>
                                                        )}


                                                    </SelectContent>
                                                </Select>
                                                <div className="flex flex-col gap-2">
                                                    <span className="text-sm font-medium text-foreground">
                                                        {settings.themePreset === 'discord' ? "Gamer Style" :
                                                            settings.themePreset === 'midnight' ? "Pure Black" :

                                                                settings.customThemes?.some(t => t.id === settings.themePreset) ?
                                                                    (settings.customThemes?.find(t => t.id === settings.themePreset)?.name || "User Theme") :
                                                                    "Standard"}
                                                    </span>

                                                    {/* Edit Button Removed */}
                                                </div>
                                            </div>


                                        </div>
                                    </div>

                                    <div id="settings-widgets" className="space-y-4">
                                        <h5 className="text-base font-semibold text-foreground mb-1">{t('settings.widgetSettings')}</h5>

                                        <div className="flex flex-col gap-3">
                                            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{t('settings.appearance.widgetHeader')}</Label>
                                            <div className="flex items-center gap-4 bg-muted/30 p-4 rounded-lg">
                                                <Select
                                                    value={settings.widgetDisplayMode || 'none'}
                                                    onValueChange={(val: any) => onSaveSettings({ ...settings, widgetDisplayMode: val })}
                                                >
                                                    <SelectTrigger className="w-[180px] bg-background border-none">
                                                        <SelectValue placeholder={t('settings.appearance.selectDisplay')} />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="none">{t('settings.appearance.none')}</SelectItem>
                                                        <SelectItem value="quote">{t('settings.appearance.dailyQuote')}</SelectItem>
                                                        <SelectItem value="goals">{t('settings.appearance.focusGoals')}</SelectItem>
                                                        <SelectItem value="timer">{t('dashboard.timer') || 'Focus Timer'}</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <span className="text-sm text-foreground">{t('settings.appearance.widgetHeaderDesc')}</span>
                                            </div>
                                        </div>




                                    </div>

                                    <Separator className="bg-border/30" />

                                    <div id="settings-editor" className="space-y-4">
                                        <div className="flex flex-col gap-4">
                                            <div className="flex items-center justify-between">
                                                <div className="space-y-0.5">
                                                    <Label className="text-base font-medium">{t('settings.appearance.indentationLines')}</Label>
                                                    <p className="text-sm text-muted-foreground">{t('settings.appearance.indentationLinesDesc')}</p>
                                                </div>
                                                <Switch
                                                    checked={settings.showIndentationGuides !== false}
                                                    onCheckedChange={(checked) => onSaveSettings({ ...settings, showIndentationGuides: checked })}
                                                />
                                            </div>

                                            <div className="flex items-center justify-between">
                                                <div className="space-y-0.5">
                                                    <Label className="text-base font-medium">{t('settings.appearance.spellCheck')}</Label>
                                                    <p className="text-sm text-muted-foreground">{t('settings.appearance.spellCheckDesc')}</p>
                                                </div>
                                                <Switch
                                                    checked={settings.enableSpellCheck || false}
                                                    onCheckedChange={(checked) => onSaveSettings({ ...settings, enableSpellCheck: checked })}
                                                />
                                            </div>
                                        </div>

                                    </div>
                                </div>
                            )}

                            {activeTab === 'timeline' && (
                                <TimelineTab
                                    settings={settings}
                                    onSaveSettings={onSaveSettings}
                                    runningApps={runningApps}
                                />
                            )}

                            {activeTab === 'tracking' && (
                                <div className="space-y-6 animate-in fade-in duration-300">
                                    <div>
                                        <h3 className="text-xl font-bold mb-4 text-foreground">{t('settings.tracking.title')}</h3>
                                        <Separator className="bg-border/60" />
                                    </div>

                                    <div className="space-y-6">
                                        <div id="settings-screenshot-enable" className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                                            <div className="space-y-0.5">
                                                <Label className="text-base font-semibold">{t('settings.tracking.enableScreenshots')}</Label>
                                                <p className="text-xs text-muted-foreground opacity-80">{t('settings.tracking.enableScreenshotsDesc')}</p>
                                            </div>
                                            <Switch
                                                checked={settings.enableScreenshots !== false}
                                                onCheckedChange={(checked: boolean) => onSaveSettings({ ...settings, enableScreenshots: checked })}
                                            />
                                        </div>

                                        <div id="settings-idle-time" className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                                            <div className="space-y-0.5">
                                                <Label className="text-base font-semibold">{t('settings.tracking.detectIdleTime')}</Label>
                                                <p className="text-xs text-muted-foreground opacity-80">{t('settings.tracking.detectIdleTimeDesc')}</p>
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

                                        <div id="settings-screenshot-interval" className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                                            <div className="space-y-0.5">
                                                <Label className="text-base font-semibold">{t('settings.tracking.screenshotInterval')}</Label>
                                                <p className="text-xs text-muted-foreground opacity-80">{t('settings.tracking.screenshotIntervalDesc')}</p>
                                            </div>
                                            <Select
                                                value={String(settings.screenshotIntervalSeconds)}
                                                onValueChange={(val) => onSaveSettings({ ...settings, screenshotIntervalSeconds: parseInt(val) })}
                                            >
                                                <SelectTrigger className="w-[180px] bg-background border-none">
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

                                        <div id="settings-timelapse" className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                                            <div className="space-y-0.5">
                                                <Label className="text-base font-semibold">{t('settings.tracking.timelapseSpeed')}</Label>
                                                <p className="text-xs text-muted-foreground opacity-80">{t('settings.tracking.timelapseSpeedDesc')}</p>
                                            </div>
                                            <Select
                                                value={String(settings.timelapseDurationSeconds)}
                                                onValueChange={(val) => onSaveSettings({ ...settings, timelapseDurationSeconds: parseInt(val) })}
                                            >
                                                <SelectTrigger className="w-[180px] bg-background border-none">
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

                                        <div id="settings-screenshot-mode" className="space-y-6 p-4 bg-muted/30 rounded-lg">
                                            <div className="flex items-center justify-between">
                                                <div className="space-y-0.5">
                                                    <Label className="text-base font-semibold">{t('settings.tracking.screenshotMode')}</Label>
                                                    <p className="text-xs text-muted-foreground opacity-80">{t('settings.tracking.screenshotModeDesc')}</p>
                                                </div>
                                                <Select
                                                    value={settings.screenshotMode || 'window'}
                                                    onValueChange={(val: 'window' | 'screen' | 'process') => onSaveSettings({ ...settings, screenshotMode: val })}
                                                >
                                                    <SelectTrigger className="w-[180px] bg-background border-none">
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

                                            {settings.screenshotMode === 'active-app' && (
                                                <div className="flex flex-col gap-2 p-3 bg-muted/40 rounded-md border border-border/50 animate-in fade-in slide-in-from-top-2">
                                                    <div className="flex items-center gap-2">
                                                        <Info className="w-4 h-4 text-primary" />
                                                        <span className="text-sm font-medium">{t('settings.tracking.capturesFocused')}</span>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground ml-6">
                                                        {t('settings.tracking.capturesFocusedDesc')}
                                                    </p>
                                                </div>
                                            )}

                                            {settings.screenshotMode === 'window' && (
                                                <div className="flex flex-col gap-2 p-3 bg-muted/40 rounded-md border border-border/50 animate-in fade-in slide-in-from-top-2">
                                                    <div className="flex items-center gap-2">
                                                        <Info className="w-4 h-4 text-primary" />
                                                        <span className="text-sm font-medium">{t('settings.tracking.capturesWindow')}</span>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground ml-6">
                                                        {t('settings.tracking.capturesWindowDesc')}
                                                    </p>
                                                </div>
                                            )}

                                            {settings.screenshotMode === 'process' && (
                                                <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 bg-muted/20 p-3 rounded-lg border border-border/50">
                                                    <div className="flex items-center justify-between">
                                                        <div className="space-y-0.5">
                                                            <Label className="text-base font-semibold">{t('settings.tracking.selectApp')}</Label>
                                                            <p className="text-xs text-muted-foreground opacity-80">{t('settings.tracking.selectAppDesc')}</p>
                                                        </div>
                                                        <Select
                                                            value={settings.screenshotTargetProcess || ''}
                                                            onValueChange={(val) => onSaveSettings({ ...settings, screenshotTargetProcess: val })}
                                                        >
                                                            <SelectTrigger className="w-[200px] bg-background border-none">
                                                                <SelectValue placeholder={t('settings.tracking.selectProcess')} />
                                                            </SelectTrigger>
                                                            <SelectContent className="max-h-[300px]">
                                                                {settings.targetProcessPatterns && settings.targetProcessPatterns.length > 0 ? (
                                                                    settings.targetProcessPatterns
                                                                        .sort()
                                                                        .map((p, idx) => (
                                                                            <SelectItem key={`${p}-${idx}`} value={p}>
                                                                                {p}
                                                                            </SelectItem>
                                                                        ))
                                                                ) : (
                                                                    <div className="p-2 text-xs text-center text-muted-foreground">{t('settings.tracking.noMonitoredApps')}</div>
                                                                )}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>

                                                    <div className="flex gap-2">
                                                        <Input
                                                            placeholder="Add Process Name (e.g. Photoshop.exe)"
                                                            className="flex-1 h-8 text-sm"
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    const val = (e.currentTarget as HTMLInputElement).value?.trim();
                                                                    if (val && !settings.targetProcessPatterns?.includes(val)) {
                                                                        onSaveSettings({
                                                                            ...settings,
                                                                            targetProcessPatterns: [...(settings.targetProcessPatterns || []), val],
                                                                            screenshotTargetProcess: val // Auto-select new
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

                                                    <div className="flex items-center justify-between pt-2 px-1">
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
                                                <div className="flex items-center justify-between animate-in fade-in slide-in-from-top-2">
                                                    <div className="space-y-0.5">
                                                        <Label className="text-base font-semibold">{t('settings.tracking.selectDisplay')}</Label>
                                                        <p className="text-xs text-muted-foreground opacity-80">{t('settings.tracking.selectDisplayDesc')}</p>
                                                    </div>
                                                    <Select
                                                        value={settings.screenshotDisplayId || ''}
                                                        onValueChange={(val) => onSaveSettings({ ...settings, screenshotDisplayId: val })}
                                                    >
                                                        <SelectTrigger className="w-[250px] bg-background border-none">
                                                            <SelectValue placeholder={screenSources.length > 0 ? "Select Monitor" : "Loading Monitors..."} />
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

                                            <Separator className="bg-border/20" />

                                            <div className="flex items-center justify-between">
                                                <div className="space-y-0.5">
                                                    <Label className="text-base font-semibold">{t('settings.tracking.screenshotLocation')}</Label>
                                                    <p className="text-xs text-muted-foreground opacity-80">{t('settings.tracking.screenshotLocationDesc')}</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-2 pt-1">
                                                <Input
                                                    readOnly
                                                    value={settings.screenshotPath || t('settings.tracking.defaultAppData')}
                                                    className="flex-1 font-mono text-xs bg-background border-none opacity-80"
                                                />
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
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
                                            <p className="text-xs text-muted-foreground pt-1">
                                                {t('settings.tracking.oldScreenshotsDesc')}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'integrations' && (
                                <div className="space-y-6 animate-in fade-in duration-300">
                                    <div>
                                        <h3 className="text-xl font-bold mb-4 text-foreground">{t('settings.backup.title')}</h3>
                                        <Separator className="bg-border/60" />
                                    </div>

                                    <div className="space-y-4">
                                        {/* Data Management */}
                                        <div className="p-4 bg-muted/30 rounded-lg flex flex-col gap-4 border border-border/50 mb-4">
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
                                        </div>
                                        {/* Notion Card */}
                                        <div className="p-4 bg-muted/30 rounded-lg flex flex-col gap-4 border border-border/50">
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
                                                                                        console.log("[SettingsModal] Sync finished (finally block). Resetting state.");
                                                                                        console.log("[SettingsModal] Sync finished (finally block). Resetting state.");
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
                                                                type="password"
                                                                placeholder="secret_..."
                                                                className="h-7 text-xs font-mono"
                                                                value={notionSecret}
                                                                onChange={(e) => setNotionSecret(e.target.value)}
                                                            />
                                                            <p className="text-[10px] text-muted-foreground">
                                                                <Trans
                                                                    i18nKey="settings.backup.notionLinkInstructions"
                                                                    components={{
                                                                        1: <a
                                                                            href="https://www.notion.so/profile/integrations"
                                                                            onClick={(e) => {
                                                                                e.preventDefault();
                                                                                if ((window as any).ipcRenderer) {
                                                                                    (window as any).ipcRenderer.invoke('open-external', "https://www.notion.so/profile/integrations");
                                                                                } else {
                                                                                    window.open("https://www.notion.so/profile/integrations", "_blank");
                                                                                }
                                                                            }}
                                                                            className="underline hover:text-foreground transition-colors cursor-pointer"
                                                                        />
                                                                    }}
                                                                />
                                                            </p>
                                                        </div>
                                                        <Button
                                                            size="sm"
                                                            className="h-8 gap-2 w-full"
                                                            disabled={!notionSecret.trim()}
                                                            onClick={async () => {
                                                                if ((window as any).ipcRenderer) {
                                                                    try {
                                                                        const result = await (window as any).ipcRenderer.invoke('verify-notion-token', notionSecret.trim());

                                                                        if (result.success && result.tokens) {
                                                                            onSaveSettings({
                                                                                ...settings,
                                                                                notionTokens: result.tokens,
                                                                            });
                                                                            setNotionSecret(""); // Clear input on success
                                                                            setShowNotionSetup(true); // Trigger Setup Dialog
                                                                        }
                                                                    } catch (e) {
                                                                        console.error("Notion Verification failed", e);
                                                                        alert(t('settings.backup.verifyFailed'));
                                                                    }
                                                                }
                                                            }}
                                                        >
                                                            {t('settings.backup.connectSecret')}
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                        </div>
                    </ScrollArea>
                )}
            </div>
        );
    };


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
