import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogDescription,
    DialogHeader,
    DialogFooter,
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
import { X, Cloud, Check, Moon, Sun, Monitor, FileText, RefreshCw, History, Settings, Palette, LayoutTemplate, Shield, Database, Activity, Loader2 } from "lucide-react";
import { AppSettings, AppInfo } from "@/types"
import { useState, useEffect, useMemo } from "react"
import { toast } from "sonner";
import { cn } from "@/lib/utils"
import { useTranslation, Trans } from 'react-i18next';
import { useDataStore } from "@/hooks/useDataStore";
import { TimetableTab } from "./settings/timeline-tab";
import { TimelineViewTab } from "./settings/timeline-view-tab";
import { GeneralTab } from "./settings/general-tab";
import { TrackingTab } from "./settings/tracking-tab";
// @ts-ignore
import { NotionSetupDialog } from "./notion-setup-dialog"; // Import
import { QuoteManager } from "./settings/QuoteManager";
import { ReminderManager } from "./settings/ReminderManager";
import { version } from "../../package.json";
import { themes } from "@/config/themes";
export type SettingsTab = 'general' | 'appearance' | 'quotes' | 'reminders' | 'timetable' | 'timeline' | 'tracking' | 'integrations' | 'updatelog';

interface SettingsModalProps {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    settings: AppSettings | null;
    onSaveSettings: (settings: AppSettings) => Promise<void>;
    defaultTab?: SettingsTab; // Optional default tab
}



export function SettingsModal({ open, onOpenChange, settings, onSaveSettings, defaultTab = 'general' }: SettingsModalProps) {
    const { setTheme } = useTheme()
    const { t, i18n } = useTranslation();
    const [activeTab, setActiveTab] = useState<SettingsTab>(defaultTab);
    const [activeSection, setActiveSection] = useState<string | null>(null);
    const { dailyLog } = useDataStore();

    // Sync activeTab with defaultTab when open changes
    useEffect(() => {
        if (open) {
            setActiveTab(defaultTab);
            setActiveSection(null);
        }
    }, [open, defaultTab]);

    // Custom Quotes State


    // General Tab State
    // General Tab State\n
    // Recovery State
    const [isRecovering, setIsRecovering] = useState(false);
    const [recoveryResult, setRecoveryResult] = useState<{
        success: boolean;
        count: number;
        stats?: {
            days: number;
            images: number;
            sessions: number;
        };
        error?: string;
    } | null>(null);

    const [runningApps, setRunningApps] = useState<AppInfo[]>([]);

    useEffect(() => {
        if (open && activeTab === 'timeline') {
            if ((window as any).ipcRenderer) {
                (window as any).ipcRenderer.invoke('get-running-apps').then(async (apps: AppInfo[]) => {
                    setRunningApps(apps || []);

                    // Merge into history if settings available
                    if (settings && apps && apps.length > 0) {
                        const existingKnown = settings.knownApps || [];
                        const knownProcessMap = new Set(existingKnown.map(a => a.process.toLowerCase()));

                        const newApps = apps.filter(a => !knownProcessMap.has(a.process.toLowerCase()));

                        if (newApps.length > 0) {
                            const updatedKnown = [...existingKnown, ...newApps];
                            // Sort by name for neatness? Optional.
                            updatedKnown.sort((a, b) => a.name.localeCompare(b.name));

                            // We need to save this, but be careful not to trigger infinite loops if onSaveSettings changes modal state
                            // The parent handles persistence.
                            await onSaveSettings({
                                ...settings,
                                knownApps: updatedKnown
                            });
                        }
                    }
                });
            }
        }
    }, [open, activeTab]);

    // Combined list of running apps and known apps (history)
    const allApps = useMemo(() => {
        const unique = new Map<string, AppInfo>();

        // Add known apps first (history)
        if (settings?.knownApps) {
            settings.knownApps.forEach(app => {
                if (app.process) unique.set(app.process.toLowerCase(), app);
            });
        }

        // Add apps from daily log history
        if (dailyLog?.sessions) {
            dailyLog.sessions.forEach((session: any) => {
                const procName = session.process || session.name;
                if (procName && !unique.has(procName.toLowerCase())) {
                    unique.set(procName.toLowerCase(), {
                        name: procName,
                        process: procName,
                        appIcon: undefined
                    });
                }
            });
        }

        // Add running apps (current, might have newer info)
        runningApps.forEach(app => {
            if (app.process) unique.set(app.process.toLowerCase(), app);
        });

        return Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [settings?.knownApps, runningApps, dailyLog]);


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
                    const lang = (i18n.language || 'en').split('-')[0];
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
        const lang = (i18n.language || 'en').split('-')[0];
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
            general: ['settings-language', 'settings-weekly', 'settings-tracked-apps-card', 'settings-startup', 'settings-developer-mode'],
            appearance: ['settings-theme', 'settings-color-theme', 'settings-widgets', 'settings-editor'],
            timetable: ['settings-work-apps'],
            timeline: ['settings-project-types', 'settings-timeline-preview'],
            tracking: ['settings-screenshots']
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
                        active={activeSection === 'settings-tracked-apps-card'}
                        onClick={() => scrollToSection('settings-tracked-apps-card')}
                        label={t('settings.trackedApps')}
                    />
                    <SectionButton
                        active={activeSection === 'settings-startup'}
                        onClick={() => scrollToSection('settings-startup')}
                        label={t('settings.startupBehavior')}
                    />
                    <SectionButton
                        active={activeSection === 'settings-developer-mode'}
                        onClick={() => scrollToSection('settings-developer-mode')}
                        label={t('settings.developerMode') || "Developer Mode"}
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
                        label={t('settings.editor') || "Editor Settings"}
                    />
                </div>
            )}

            <SidebarButton
                active={activeTab === 'quotes'}
                onClick={() => { setActiveTab('quotes'); setActiveSection(null); }}
                label={t('settings.appearance.customQuotes.title')}
                icon={<div className="w-4 h-4 mr-2 flex items-center justify-center font-serif text-xs font-bold">“</div>}
            />

            <SidebarButton
                active={activeTab === 'reminders'}
                onClick={() => { setActiveTab('reminders'); setActiveSection(null); }}
                label={t('settings.appearance.reminders.title')}
                icon={<div className="w-4 h-4 mr-2 flex items-center justify-center font-bold text-xs">!</div>}
            />

            <SidebarButton
                active={activeTab === 'timetable'}
                onClick={() => { setActiveTab('timetable'); setActiveSection(null); }}
                label={t('sidebar.timetable')}
                icon={<LayoutTemplate className="w-4 h-4 mr-2" />}
            />
            {activeTab === 'timetable' && (
                <div className="flex flex-col gap-[2px]">
                    <SectionButton
                        active={activeSection === 'settings-work-apps'}
                        onClick={() => scrollToSection('settings-work-apps')}
                        label={t('settings.timeline.workApps')}
                    />
                </div>
            )}

            <SidebarButton
                active={activeTab === 'timeline'}
                onClick={() => { setActiveTab('timeline'); setActiveSection(null); }}
                label={t('sidebar.timeline')}
                icon={<Activity className="w-4 h-4 mr-2" />}
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
                        active={activeSection === 'settings-screenshots'}
                        onClick={() => scrollToSection('settings-screenshots')}
                        label={t('settings.tracking.title')}
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
            <GeneralTab
                settings={settings}
                onSaveSettings={onSaveSettings}
                updateStatus={updateStatus}
                updateProgress={updateProgress}
                updateError={updateError}
                checkForUpdates={checkForUpdates}
                quitAndInstall={quitAndInstall}
            />
        );
    };

    const renderContent = () => {
        if (!settings) return null;

        return (
            <div className="flex-1 flex flex-col h-full overflow-hidden bg-background relative select-none">
                {/* Close Button X (Floating Top Right) */}
                <div className="absolute top-4 right-6 z-50 flex flex-col items-center gap-1 group cursor-pointer" onClick={() => onOpenChange?.(false)}>
                    <div className="w-9 h-9 border-2 border-muted-foreground/40 rounded-full flex items-center justify-center transition-colors group-hover:bg-muted-foreground/10 group-hover:border-foreground/60">
                        <X className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </div>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase opacity-0 group-hover:opacity-100 transition-opacity">Esc</span>
                </div>

                {/* UpdateLog Tab - Separate Layout with Independent Scrolling */}
                {activeTab === 'updatelog' && (
                    <div className="flex-1 flex flex-col h-full overflow-hidden px-10 pt-6 pb-[60px]">
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
                )
                }

                {/* Other Tabs - Normal ScrollArea */}
                {
                    activeTab !== 'updatelog' && (
                        <ScrollArea className="h-full px-10 pt-6 pb-[60px]" onScroll={handleScroll}>
                            <div className="max-w-[700px] pb-20">
                                {/* Tab Content */}
                                {activeTab === 'general' && renderGeneralTab()}

                                {activeTab === 'appearance' && (
                                    <>
                                        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pb-1 mb-4">
                                            <h3 className="text-xl font-bold text-foreground">{t('settings.appearance.title')}</h3>
                                            <Separator className="bg-border/60 mt-2" />
                                        </div>
                                        <div className="space-y-8 animate-in fade-in duration-300">

                                            {/* Main Window Style Section */}
                                            <div className="space-y-4">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                                                        <LayoutTemplate className="w-4 h-4" />
                                                    </div>
                                                    <h5 className="text-sm font-bold text-foreground">{t('settings.appearance.main') || "Main Window"}</h5>
                                                </div>

                                                <div className="pl-1 border-l-2 border-border/40 ml-2 space-y-6">
                                                    {/* Main Theme Cards */}
                                                    <div className="space-y-3 pl-4">
                                                        <h6 className="text-xs font-semibold text-muted-foreground uppercase">{t('settings.theme')}</h6>
                                                        <div className="grid grid-cols-3 gap-3">
                                                            {(['light', 'dark', 'system'] as const).map((tKey) => (
                                                                <ThemeCard
                                                                    key={tKey}
                                                                    active={(settings.mainTheme || 'system') === tKey}
                                                                    onClick={() => {
                                                                        setTheme(tKey);
                                                                        onSaveSettings({ ...settings!, mainTheme: tKey });
                                                                    }}
                                                                    icon={
                                                                        tKey === 'light' ? <Sun className="w-5 h-5" /> :
                                                                            tKey === 'dark' ? <Moon className="w-5 h-5" /> :
                                                                                <Monitor className="w-5 h-5" />
                                                                    }
                                                                    label={t(`settings.${tKey}`)}
                                                                />
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* Main Color Preset */}
                                                    <div className="space-y-3 pl-4">
                                                        <h6 className="text-xs font-semibold text-muted-foreground uppercase">{t('settings.appearance.colorTheme')}</h6>
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <Select
                                                                value={settings!.themePreset || 'standard'}
                                                                onValueChange={(val) => onSaveSettings({ ...settings!, themePreset: val as any })}
                                                            >
                                                                <SelectTrigger className="w-full">
                                                                    <SelectValue placeholder="Select Color Theme" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {Object.entries(themes).map(([key, config]) => (
                                                                        <SelectItem key={key} value={key}>
                                                                            {config.name}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                            <div className="flex items-center text-xs text-muted-foreground">
                                                                {themes[settings!.themePreset || 'standard']?.description}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="my-6"><Separator /></div>

                                            {/* Widget Style Section */}
                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <div className="p-1.5 rounded-md bg-secondary text-secondary-foreground">
                                                            <Activity className="w-4 h-4" />
                                                        </div>
                                                        <div className="space-y-0.5">
                                                            <h5 className="text-sm font-bold text-foreground">{t('settings.appearance.widget') || "Widget"}</h5>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Label htmlFor="separate-widget-theme" className="text-xs text-muted-foreground font-normal">
                                                            {t('settings.appearance.separateWidgetTheme') || "Use separate style"}
                                                        </Label>
                                                        <Switch
                                                            id="separate-widget-theme"
                                                            checked={settings.separateWidgetTheme || false}
                                                            onCheckedChange={(checked) => {
                                                                const updates: any = { separateWidgetTheme: checked };
                                                                if (checked) {
                                                                    // Initialize widget settings if empty
                                                                    if (!settings.widgetTheme) updates.widgetTheme = settings.mainTheme || 'dark';
                                                                    if (!settings.widgetThemePreset) updates.widgetThemePreset = settings.themePreset || 'standard';
                                                                }
                                                                onSaveSettings({ ...settings!, ...updates });
                                                            }}
                                                        />
                                                    </div>
                                                </div>

                                                {settings.separateWidgetTheme && (
                                                    <div className="pl-1 border-l-2 border-border/40 ml-2 space-y-6 animate-in fade-in slide-in-from-top-2 duration-200">
                                                        {/* Widget Theme Cards */}
                                                        <div className="space-y-3 pl-4">
                                                            <h6 className="text-xs font-semibold text-muted-foreground uppercase">{t('settings.theme')}</h6>
                                                            <div className="grid grid-cols-3 gap-3">
                                                                {(['light', 'dark', 'system'] as const).map((tKey) => (
                                                                    <ThemeCard
                                                                        key={tKey}
                                                                        active={(settings!.widgetTheme || 'dark') === tKey}
                                                                        onClick={() => onSaveSettings({ ...settings!, widgetTheme: tKey })}
                                                                        icon={
                                                                            tKey === 'light' ? <Sun className="w-5 h-5" /> :
                                                                                tKey === 'dark' ? <Moon className="w-5 h-5" /> :
                                                                                    <Monitor className="w-5 h-5" />
                                                                        }
                                                                        label={t(`settings.${tKey}`)}
                                                                    />
                                                                ))}
                                                            </div>
                                                        </div>

                                                        {/* Widget Color Preset */}
                                                        <div className="space-y-3 pl-4">
                                                            <h6 className="text-xs font-semibold text-muted-foreground uppercase">{t('settings.appearance.colorTheme')}</h6>
                                                            <div className="grid grid-cols-2 gap-4">
                                                                <Select
                                                                    value={settings!.widgetThemePreset || settings!.themePreset || 'standard'}
                                                                    onValueChange={(val) => onSaveSettings({ ...settings!, widgetThemePreset: val as any })}
                                                                >
                                                                    <SelectTrigger className="w-full">
                                                                        <SelectValue placeholder="Select Widget Color Theme" />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        {Object.entries(themes).map(([key, config]) => (
                                                                            <SelectItem key={key} value={key}>
                                                                                {config.name}
                                                                            </SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                                <div className="flex items-center text-xs text-muted-foreground">
                                                                    {themes[settings!.widgetThemePreset || settings!.themePreset || 'standard']?.description}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {!settings.separateWidgetTheme && (
                                                    <div className="pl-7 text-xs text-muted-foreground italic">
                                                        {t('settings.appearance.widgetFollowsMain') || "Widget is currently using the Main Window style."}
                                                    </div>
                                                )}
                                            </div>

                                            <Separator className="bg-border/30" />



                                            <div id="settings-widgets" className="space-y-4">
                                                <h5 className="text-base font-semibold text-foreground mb-1">{t('settings.widgetSettings')}</h5>

                                                <div className="flex flex-col gap-3">
                                                    <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{t('settings.appearance.widgetHeader')}</Label>
                                                    <div className="flex items-center gap-4 bg-muted/30 p-4 rounded-lg">
                                                        <Select
                                                            value={settings!.widgetDisplayMode || 'none'}
                                                            onValueChange={(val: any) => onSaveSettings({ ...settings!, widgetDisplayMode: val })}
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
                                                            checked={settings!.showIndentationGuides !== false}
                                                            onCheckedChange={(checked) => onSaveSettings({ ...settings!, showIndentationGuides: checked })}
                                                        />
                                                    </div>

                                                    <div className="flex items-center justify-between">
                                                        <div className="space-y-0.5">
                                                            <Label className="text-base font-medium">{t('settings.appearance.spellCheck')}</Label>
                                                            <p className="text-sm text-muted-foreground">{t('settings.appearance.spellCheckDesc')}</p>
                                                        </div>
                                                        <Switch
                                                            checked={settings!.enableSpellCheck || false}
                                                            onCheckedChange={(checked) => onSaveSettings({ ...settings!, enableSpellCheck: checked })}
                                                        />
                                                    </div>
                                                </div>

                                            </div>
                                        </div>
                                    </>
                                )}

                                {activeTab === 'quotes' && (
                                    <>
                                        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pb-1 mb-4">
                                            <h3 className="text-xl font-bold text-foreground">Custom Quotes</h3>
                                            <Separator className="bg-border/60 mt-2" />
                                        </div>
                                        <div className="space-y-6 animate-in fade-in duration-300">
                                            <QuoteManager />
                                        </div>
                                    </>
                                )}

                                {activeTab === 'reminders' && (
                                    <>
                                        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pb-1 mb-4">
                                            <h3 className="text-xl font-bold text-foreground">Reminders</h3>
                                            <Separator className="bg-border/60 mt-2" />
                                        </div>
                                        <div className="space-y-6 animate-in fade-in duration-300">
                                            <ReminderManager />
                                        </div>
                                    </>
                                )}

                                {activeTab === 'timetable' && (
                                    <TimetableTab
                                        settings={settings!}
                                        onSaveSettings={onSaveSettings}
                                        runningApps={allApps}
                                    />
                                )}

                                {activeTab === 'timeline' && (
                                    <TimelineViewTab
                                        settings={settings!}
                                        onSaveSettings={onSaveSettings}
                                    />
                                )}

                                {activeTab === 'tracking' && (
                                    <TrackingTab
                                        settings={settings!}
                                        onSaveSettings={onSaveSettings}
                                        screenSources={screenSources}
                                    />
                                )}

                                {activeTab === 'integrations' && (
                                    <>
                                        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 py-2 mb-4">
                                            <h3 className="text-xl font-bold text-foreground">{t('settings.backup.title')}</h3>
                                            <Separator className="bg-border/60 mt-4" />
                                        </div>

                                        <div className="space-y-6 animate-in fade-in duration-300">
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
                                                    <div className="flex gap-4 mt-2">
                                                        <Button
                                                            variant="secondary"
                                                            disabled={isRecovering}
                                                            onClick={async () => {
                                                                if ((window as any).ipcRenderer) {
                                                                    setIsRecovering(true);
                                                                    try {
                                                                        const result = await (window as any).ipcRenderer.invoke('recover-from-screenshots');
                                                                        setRecoveryResult(result);
                                                                    } catch (error) {
                                                                        console.error("Recovery failed", error);
                                                                        setRecoveryResult({ success: false, count: 0, error: String(error) });
                                                                    } finally {
                                                                        setIsRecovering(false);
                                                                    }
                                                                }
                                                            }}
                                                            className="flex-1 gap-2"
                                                        >
                                                            {isRecovering ? (
                                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                            ) : (
                                                                <RefreshCw className="w-4 h-4" />
                                                            )}
                                                            {isRecovering ? 'Recovering...' : t('settings.backup.importScreenshots')}
                                                        </Button>
                                                    </div>

                                                    {/* Recovery Result Dialog */}
                                                    <Dialog open={!!recoveryResult} onOpenChange={(open) => {
                                                        if (!open) setRecoveryResult(null);
                                                    }}>
                                                        <DialogContent>
                                                            <DialogHeader>
                                                                <DialogTitle>
                                                                    {recoveryResult?.success ? 'Recovery Complete' : 'Recovery Failed'}
                                                                </DialogTitle>
                                                                <DialogDescription className="space-y-2 pt-2">
                                                                    {recoveryResult?.success ? (
                                                                        <div className="flex flex-col gap-2">
                                                                            <div className="text-sm">
                                                                                Successfully processed data from previous screenshots.
                                                                            </div>
                                                                            {recoveryResult.stats && (
                                                                                <div className="bg-muted p-3 rounded-md text-sm space-y-1">
                                                                                    <div className="flex justify-between">
                                                                                        <span className="text-muted-foreground">Days Processed:</span>
                                                                                        <span className="font-medium">{recoveryResult.stats.days}</span>
                                                                                    </div>
                                                                                    <div className="flex justify-between">
                                                                                        <span className="text-muted-foreground">Screenshots Found:</span>
                                                                                        <span className="font-medium">{recoveryResult.stats.images}</span>
                                                                                    </div>
                                                                                    <div className="flex justify-between">
                                                                                        <span className="text-muted-foreground">Sessions Recovered:</span>
                                                                                        <span className="font-medium">{recoveryResult.stats.sessions}</span>
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                            <div className="text-xs text-muted-foreground mt-2">
                                                                                The app needs to reload to apply these changes.
                                                                            </div>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="text-destructive">
                                                                            {recoveryResult?.error || 'An unknown error occurred during recovery.'}
                                                                        </div>
                                                                    )}
                                                                </DialogDescription>
                                                            </DialogHeader>
                                                            <DialogFooter>
                                                                <Button variant="outline" onClick={() => setRecoveryResult(null)}>
                                                                    Close
                                                                </Button>
                                                                {recoveryResult?.success && (
                                                                    <Button onClick={() => window.location.reload()}>
                                                                        Reload App
                                                                    </Button>
                                                                )}
                                                            </DialogFooter>
                                                        </DialogContent>
                                                    </Dialog>
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
                                    </>
                                )}

                            </div>
                        </ScrollArea>
                    )
                }
            </div >
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
            </Dialog >
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
