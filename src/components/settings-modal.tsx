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
import { Slider } from "@/components/ui/slider"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { useTheme } from "@/components/theme-provider"
import { Badge } from "@/components/ui/badge"
import { X, Cloud, Check, Moon, Sun, Monitor, Eye, EyeOff, Info, FileText, RefreshCw } from "lucide-react";
import { AppSettings } from "@/types"
import { useState, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import { useTranslation, Trans } from 'react-i18next';
// @ts-ignore
import { NotionSetupDialog } from "./notion-setup-dialog"; // Import

interface SettingsModalProps {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    settings: AppSettings | null;
    onSaveSettings: (settings: AppSettings) => Promise<void>;
    defaultTab?: SettingsTab; // Optional default tab
}

import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    DragOverlay,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Pencil } from 'lucide-react';

type SettingsTab = 'general' | 'appearance' | 'timeline' | 'tracking' | 'integrations';
// Presentational Component for Project Type Item
function ProjectTypeItem({
    tag,
    color,
    isDefault,
    isOverlay,
    isDragging,
    listeners,
    attributes,
    style,
    setNodeRef,
    onDelete,
    onColorChange,
    onRename,
    id // Add id prop
}: {
    tag: string,
    color: string,
    isDefault: boolean,
    isOverlay?: boolean,
    isDragging?: boolean,
    listeners?: any,
    attributes?: any,
    style?: any,
    setNodeRef?: (node: HTMLElement | null) => void,
    onDelete?: () => void,
    onColorChange?: (color: string) => void,
    onRename?: (newName: string) => void,
    id?: string // Add id to type
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(tag);
    const [localColor, setLocalColor] = useState(color);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        setLocalColor(color);
    }, [color]);

    const handleColorChange = (newColor: string) => {
        setLocalColor(newColor);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            onColorChange?.(newColor);
        }, 100);
    };

    const handleSave = () => {
        if (editName.trim() && editName !== tag) {
            onRename?.(editName.trim());
        }
        setIsEditing(false);
    };

    return (
        <div
            id={id} // Apply id to div
            ref={setNodeRef}
            style={style}
            className={cn(
                "flex items-center gap-4 bg-background p-2 rounded border border-border/40 group",
                isOverlay && "shadow-xl border-primary/50 cursor-grabbing bg-background/95",
                isDragging && "opacity-30" // Lower opacity for the placeholder in the list
            )}
        >
            <div {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground">
                <GripVertical className="w-4 h-4" />
            </div>

            <div className="relative group/picker w-8 h-8 flex-shrink-0">
                <div
                    className="absolute inset-0 rounded-full border-2 border-transparent ring-2 ring-offset-1 transition-transform group-hover/picker:scale-110 pointer-events-none"
                    style={{ backgroundColor: localColor }}
                />
                {!isOverlay && (
                    <input
                        type="color"
                        value={localColor}
                        onChange={(e) => handleColorChange(e.target.value)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        title="Change Color"
                    />
                )}
            </div>

            <div className="flex-1 flex items-center gap-2">
                {isEditing && !isOverlay ? (
                    <div className="flex items-center gap-2 flex-1">
                        <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="h-7 text-sm"
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSave();
                                if (e.key === 'Escape') {
                                    setEditName(tag);
                                    setIsEditing(false);
                                }
                            }}
                            onBlur={handleSave}
                        />
                    </div>
                ) : (
                    <>
                        <span className="font-medium text-sm text-foreground">{tag}</span>
                        {isDefault && (
                            <span className="text-[10px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded uppercase tracking-wide">
                                (Default)
                            </span>
                        )}
                    </>
                )}
            </div>

            <div className="flex items-center">
                {!isEditing && !isOverlay && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => setIsEditing(true)}
                    >
                        <Pencil className="w-3.5 h-3.5" />
                    </Button>
                )}

                {!isOverlay && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={onDelete}
                    >
                        <X className="w-4 h-4" />
                    </Button>
                )}
            </div>
        </div>
    );
}

function SortableProjectType(props: {
    id: string,
    tag: string,
    color: string,
    isDefault: boolean,
    onDelete: () => void,
    onColorChange: (color: string) => void,
    onRename: (newName: string) => void
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: props.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <ProjectTypeItem
            {...props}
            id={`sortable-item-${props.id}`} // Pass prefixed ID for DOM width capture
            setNodeRef={setNodeRef}
            style={style}
            attributes={attributes}
            listeners={listeners}
            isDragging={isDragging}
        />
    );
}

export function SettingsModal({ open, onOpenChange, settings, onSaveSettings, defaultTab = 'general' }: SettingsModalProps) {
    const { setTheme, theme } = useTheme()
    const { t, i18n } = useTranslation();
    const [activeTab, setActiveTab] = useState<SettingsTab>(defaultTab);

    // Sync activeTab with defaultTab when open changes
    useEffect(() => {
        if (open) {
            setActiveTab(defaultTab);
        }
    }, [open, defaultTab]);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const [activeDragId, setActiveDragId] = useState<string | null>(null);
    const [dragWidth, setDragWidth] = useState<number | undefined>(undefined);

    const handleDragStart = (event: any) => {
        const { active } = event;
        setActiveDragId(active.id);
        // Use prefixed ID to avoid collisions and ensure we get the correct element from the list
        const node = document.getElementById(`sortable-item-${active.id}`);
        if (node) {
            setDragWidth(node.offsetWidth);
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (active.id !== over?.id && settings?.projectTags && over) {
            const oldIndex = settings.projectTags.indexOf(active.id as string);
            const newIndex = settings.projectTags.indexOf(over.id as string);

            if (oldIndex !== undefined && newIndex !== undefined && oldIndex !== -1 && newIndex !== -1) {
                const newTags = arrayMove(settings.projectTags, oldIndex, newIndex);
                onSaveSettings({ ...settings, projectTags: newTags });
            }
        }

        setDragWidth(undefined);
    };

    const handleDragCancel = () => {
        setActiveDragId(null);
        setDragWidth(undefined);
    };


    // General Tab State
    const [newAppInput, setNewAppInput] = useState("");
    const [runningApps, setRunningApps] = useState<{ id: string, name: string, process?: string, appIcon?: string }[]>([]);

    // Tracking Tab State
    const [screenSources, setScreenSources] = useState<{ id: string, name: string, thumbnail: string }[]>([]);

    // Timeline Tab State
    const [newTypeInput, setNewTypeInput] = useState("");

    // Notion Setup Dialog State
    const [showNotionSetup, setShowNotionSetup] = useState(false);

    // Notion Credentials State (Integrations)
    const [notionSecret, setNotionSecret] = useState("");
    const [isSyncingHistory, setIsSyncingHistory] = useState(false);

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

    const renderSidebar = () => (
        <div className="w-[210px] shrink-0 bg-muted/30 flex flex-col p-2 gap-[2px] justify-end md:justify-start">
            <div className="px-3 pt-6 pb-3 md:pt-4">
                <h2 className="text-xs font-bold text-muted-foreground uppercase px-2 mb-1">User Settings</h2>
            </div>

            <SidebarButton
                active={activeTab === 'general'}
                onClick={() => setActiveTab('general')}
                label={t('settings.general')}
            />
            <SidebarButton
                active={activeTab === 'appearance'}
                onClick={() => setActiveTab('appearance')}
                label={t('settings.appearance.title')}
            />
            <SidebarButton
                active={activeTab === 'timeline'}
                onClick={() => setActiveTab('timeline')}
                label={t('sidebar.timeline')}
            />
            <SidebarButton
                active={activeTab === 'tracking'}
                onClick={() => setActiveTab('tracking')}
                label={t('settings.tracking.title')}
            />
            <SidebarButton
                active={activeTab === 'integrations'}
                onClick={() => setActiveTab('integrations')}
                label={t('settings.backup.title')}
            />

            <div className="my-2 px-2"><Separator className="bg-border/50" /></div>

            {/* Close Button Mobile/Embedded */}
            <div className="mt-auto p-2 pb-5 md:hidden">
                <Button variant="destructive" className="w-full" onClick={() => onOpenChange?.(false)}>Close</Button>
            </div>
        </div>
    );

    const renderContent = () => {
        if (!settings) return null;

        return (
            <div className="flex-1 flex flex-col h-full overflow-hidden bg-background relative">
                {/* Close Button X (Floating Top Right) */}
                <div className="absolute top-9 right-9 z-50 flex flex-col items-center gap-1 group cursor-pointer" onClick={() => onOpenChange?.(false)}>
                    <div className="w-9 h-9 border-2 border-muted-foreground/40 rounded-full flex items-center justify-center transition-colors group-hover:bg-muted-foreground/10 group-hover:border-foreground/60">
                        <X className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </div>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase opacity-0 group-hover:opacity-100 transition-opacity">Esc</span>
                </div>

                <ScrollArea className="h-full px-10 py-[60px]">
                    <div className="max-w-[700px] pb-20">
                        {/* Tab Content */}
                        {activeTab === 'general' && (
                            <div className="space-y-6 animate-in fade-in duration-300">
                                {/* General Preferences Section */}
                                <div>
                                    <h3 className="text-xl font-bold mb-4 text-foreground">{t('settings.general')}</h3>
                                    <Separator className="bg-border/60 mb-6" />

                                    <div className="space-y-4 mb-8">
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

                                    <div className="space-y-4 mb-8">
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
                                <div className="space-y-2 pt-2">
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
                                <div className="mt-8 pt-4">
                                    <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">{t('settings.runningApps')}</h5>
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
                                                <div className="p-4 text-center text-sm text-muted-foreground">Scanning...</div>
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
                                                                    Add
                                                                </Button>
                                                            </div>
                                                        ))
                                                    }
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    {/* Startup Behavior */}
                                    <div className="mt-8 pt-4 border-t border-border/40">
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
                                                            // revert visual state or just don't update settings (switch might be uncontrolled or controlled by settings)
                                                            // Since it's controlled by `settings.autoLaunch`, doing nothing effectively reverts it on next render (or keeps it).
                                                            // Ideally we should tell user why (e.g. dev mode) but console warn is there.
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
                                </div>
                            </div>
                        )}

                        {activeTab === 'appearance' && (
                            <div className="space-y-8 animate-in fade-in duration-300">
                                <div>
                                    <h3 className="text-xl font-bold mb-4 text-foreground">{t('settings.appearance.title')}</h3>
                                    <Separator className="bg-border/60" />
                                </div>

                                <div className="space-y-4">
                                    <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">{t('settings.theme')}</h5>
                                    <div className="grid grid-cols-3 gap-4">
                                        <ThemeCard
                                            active={theme === 'light'}
                                            onClick={() => setTheme('light')}
                                            icon={<Sun className="w-6 h-6" />}
                                            label={t('settings.light')}
                                        />
                                        <ThemeCard
                                            active={theme === 'dark'}
                                            onClick={() => setTheme('dark')}
                                            icon={<Moon className="w-6 h-6" />}
                                            label={t('settings.dark')}
                                        />
                                        <ThemeCard
                                            active={theme === 'system'}
                                            onClick={() => setTheme('system')}
                                            icon={<Monitor className="w-6 h-6" />}
                                            label={t('settings.system')}
                                        />
                                    </div>
                                </div>

                                <Separator className="bg-border/30" />

                                <div className="space-y-4">
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

                                    <div className="flex flex-col gap-3">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{t('settings.appearance.widgetMaxHeight')}</Label>
                                            <span className="text-xs text-muted-foreground">{settings.widgetMaxHeight || 800}px</span>
                                        </div>
                                        <div className="bg-muted/30 p-4 rounded-lg">
                                            <Slider
                                                min={300}
                                                max={1200}
                                                step={50}
                                                value={[settings.widgetMaxHeight || 800]}
                                                onValueChange={(val) => onSaveSettings({ ...settings, widgetMaxHeight: val[0] })}
                                            />
                                            <div className="flex justify-between text-[10px] text-muted-foreground mt-2 px-1">
                                                <span>{t('settings.appearance.short')}</span>
                                                <span>{t('settings.appearance.tall')}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <Separator className="bg-border/30" />

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h5 className="text-base font-semibold text-foreground mb-1">{t('settings.appearance.checkboxVisibility')}</h5>
                                            <p className="text-sm text-muted-foreground">
                                                {t('settings.appearance.checkboxVisibilityDesc')}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        <div
                                            className={cn(
                                                "flex items-center justify-between p-3 rounded-md cursor-pointer border-2 transition-all",
                                                settings.checkboxVisibility === 'high'
                                                    ? "bg-primary/10 border-primary"
                                                    : "bg-muted/30 border-transparent hover:border-border"
                                            )}
                                            onClick={() => onSaveSettings({ ...settings, checkboxVisibility: 'high' })}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-5 h-5 rounded-full flex items-center justify-center border border-muted-foreground/40">
                                                    {settings.checkboxVisibility === 'high' && <div className="w-3 h-3 rounded-full bg-primary" />}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-sm">{t('settings.appearance.designMode')}</span>
                                                    <span className="text-xs text-muted-foreground">{t('settings.appearance.designModeDesc')}</span>
                                                </div>
                                            </div>
                                            <Eye className="w-5 h-5 text-muted-foreground" />
                                        </div>

                                        <div
                                            className={cn(
                                                "flex items-center justify-between p-3 rounded-md cursor-pointer border-2 transition-all",
                                                settings.checkboxVisibility === 'low'
                                                    ? "bg-primary/10 border-primary"
                                                    : "bg-muted/30 border-transparent hover:border-border"
                                            )}
                                            onClick={() => onSaveSettings({ ...settings, checkboxVisibility: 'low' })}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-5 h-5 rounded-full flex items-center justify-center border border-muted-foreground/40">
                                                    {settings.checkboxVisibility === 'low' && <div className="w-3 h-3 rounded-full bg-primary" />}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-sm">{t('settings.appearance.focusMode')}</span>
                                                    <span className="text-xs text-muted-foreground">{t('settings.appearance.focusModeDesc')}</span>
                                                </div>
                                            </div>
                                            <EyeOff className="w-5 h-5 text-muted-foreground" />
                                        </div>
                                    </div>

                                    <Separator className="bg-border/30" />

                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h5 className="text-base font-semibold text-foreground mb-1">{t('settings.appearance.indentationLines')}</h5>
                                                <p className="text-sm text-muted-foreground">
                                                    {t('settings.appearance.indentationLinesDesc')}
                                                </p>
                                            </div>
                                            <Switch
                                                checked={settings.showIndentationGuides !== false}
                                                onCheckedChange={(checked) => onSaveSettings({ ...settings, showIndentationGuides: checked })}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'timeline' && (
                            <div className="space-y-6 animate-in fade-in duration-300">
                                <div>
                                    <h3 className="text-xl font-bold mb-4 text-foreground">{t('settings.timelineConfig')}</h3>
                                    <Separator className="bg-border/60" />
                                </div>

                                <div className="space-y-4">
                                    <h3 className="text-lg font-medium">{t('settings.timeline.title')}</h3>

                                    <div className="flex items-center justify-between p-4 border rounded-lg bg-card">
                                        <div className="space-y-0.5">
                                            <Label className="text-base">{t('settings.timeline.showPreview')}</Label>
                                            <p className="text-sm text-muted-foreground">
                                                {t('settings.timeline.showPreviewDesc')}
                                            </p>
                                        </div>
                                        <Switch
                                            checked={settings.showTimelinePreview}
                                            onCheckedChange={(checked) => onSaveSettings({ ...settings, showTimelinePreview: checked })}
                                        />
                                    </div>
                                </div>
                                <div className="grid gap-8">

                                    {/* Project Types & Colors Section */}
                                    <div className="space-y-4">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center justify-between">
                                                <h5 className="text-base font-semibold text-foreground">{t('settings.projectTypes')}</h5>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        id="custom-colors"
                                                        checked={settings.enableCustomProjectColors || false}
                                                        onChange={(e) => onSaveSettings({ ...settings, enableCustomProjectColors: e.target.checked })}
                                                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                                    />
                                                    <Label htmlFor="custom-colors" className="text-sm font-normal text-muted-foreground cursor-pointer select-none">
                                                        {t('settings.allowCustomColors')}
                                                    </Label>
                                                </div>
                                            </div>
                                            <p className="text-sm text-muted-foreground pb-2">
                                                {t('settings.projectTagDesc')}
                                            </p>
                                        </div>

                                        <div className="bg-muted/30 p-4 rounded-lg space-y-4">
                                            <div className="space-y-2 max-h-[300px] overflow-y-auto px-1 custom-scrollbar">
                                                <DndContext
                                                    sensors={sensors}
                                                    collisionDetection={closestCenter}
                                                    onDragEnd={handleDragEnd}
                                                    onDragStart={handleDragStart}
                                                    onDragCancel={handleDragCancel}
                                                >
                                                    <SortableContext
                                                        items={settings.projectTags || []}
                                                        strategy={verticalListSortingStrategy}
                                                    >
                                                        {(settings.projectTags || ["Main", "Sub", "Practice"]).map((tag, index) => (
                                                            <SortableProjectType
                                                                key={tag}
                                                                id={tag}
                                                                tag={tag}
                                                                color={settings.typeColors?.[tag] || "#3b82f6"}
                                                                isDefault={index === 0}
                                                                onColorChange={(newColor) => {
                                                                    const newColors = { ...(settings.typeColors || {}), [tag]: newColor };
                                                                    onSaveSettings({ ...settings, typeColors: newColors });
                                                                }}
                                                                onRename={(newName) => {
                                                                    if (newName && !settings.projectTags.includes(newName)) {
                                                                        const updatedTags = settings.projectTags.map(t => t === tag ? newName : t);
                                                                        const updatedColors = { ...settings.typeColors };
                                                                        if (updatedColors[tag]) {
                                                                            updatedColors[newName] = updatedColors[tag];
                                                                            delete updatedColors[tag];
                                                                        }
                                                                        onSaveSettings({ ...settings, projectTags: updatedTags, typeColors: updatedColors });
                                                                    }
                                                                }}
                                                                onDelete={() => {
                                                                    setConfirmConfig({
                                                                        title: "Delete Project Type",
                                                                        description: `Delete project type "${tag}"?`,
                                                                        actionLabel: "Delete",
                                                                        onConfirm: () => {
                                                                            const updatedTags = settings.projectTags.filter(t => t !== tag);
                                                                            const updatedColors = { ...settings.typeColors };
                                                                            delete updatedColors[tag];
                                                                            onSaveSettings({ ...settings, projectTags: updatedTags, typeColors: updatedColors });
                                                                        }
                                                                    });
                                                                }}
                                                            />
                                                        ))}
                                                    </SortableContext>
                                                    <DragOverlay modifiers={[restrictToVerticalAxis]} dropAnimation={null}>
                                                        {activeDragId ? (
                                                            <ProjectTypeItem
                                                                tag={activeDragId}
                                                                color={settings.typeColors?.[activeDragId] || "#3b82f6"}
                                                                isDefault={settings.projectTags.indexOf(activeDragId) === 0}
                                                                isOverlay={true}
                                                                // Apply captured width, fallback to auto if missed
                                                                style={{ width: dragWidth ?? 'auto' }}
                                                            />
                                                        ) : null}
                                                    </DragOverlay>
                                                </DndContext>
                                            </div>

                                            {/* Add New Type */}
                                            <div className="flex gap-2 pt-2">
                                                <Input
                                                    placeholder="New Type Name..."
                                                    value={newTypeInput}
                                                    onChange={(e) => setNewTypeInput(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' && newTypeInput.trim()) {
                                                            const tag = newTypeInput.trim();
                                                            if (!settings.projectTags.includes(tag)) {
                                                                onSaveSettings({
                                                                    ...settings,
                                                                    projectTags: [...settings.projectTags, tag],
                                                                    typeColors: { ...(settings.typeColors || {}), [tag]: "#808080" } // Default gray
                                                                });
                                                                setNewTypeInput("");
                                                            }
                                                        }
                                                    }}
                                                    className="h-9 bg-background"
                                                />
                                                <Button
                                                    size="sm"
                                                    disabled={!newTypeInput.trim()}
                                                    onClick={() => {
                                                        const tag = newTypeInput.trim();
                                                        if (tag && !settings.projectTags.includes(tag)) {
                                                            onSaveSettings({
                                                                ...settings,
                                                                projectTags: [...settings.projectTags, tag],
                                                                typeColors: { ...(settings.typeColors || {}), [tag]: "#808080" }
                                                            });
                                                            setNewTypeInput("");
                                                        }
                                                    }}
                                                >
                                                    Add
                                                </Button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-3">
                                        <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{t('settings.visibleRows')}</Label>
                                        <div className="flex items-center gap-4 bg-muted/30 p-4 rounded-lg">
                                            <Input
                                                type="number"
                                                min={1}
                                                max={20}
                                                value={settings.visibleProjectRows}
                                                onChange={(e) => onSaveSettings({ ...settings, visibleProjectRows: parseInt(e.target.value) || 3 })}
                                                className="w-24 bg-background border-none"
                                            />
                                            <span className="text-sm text-foreground">{t('settings.rowsShown')}</span>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-3">
                                        <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{t('settings.defaultDuration')}</Label>
                                        <div className="flex items-center gap-4 bg-muted/30 p-4 rounded-lg">
                                            <Input
                                                type="number"
                                                min={1}
                                                max={365}
                                                value={settings.defaultProjectDurationDays}
                                                onChange={(e) => onSaveSettings({ ...settings, defaultProjectDurationDays: parseInt(e.target.value) || 14 })}
                                                className="w-24 bg-background border-none"
                                            />
                                            <span className="text-sm text-foreground">{t('settings.daysForNew')}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'tracking' && (
                            <div className="space-y-6 animate-in fade-in duration-300">
                                <div>
                                    <h3 className="text-xl font-bold mb-4 text-foreground">{t('settings.tracking.title')}</h3>
                                    <Separator className="bg-border/60" />
                                </div>

                                <div className="space-y-6">
                                    <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                                        <div className="space-y-0.5">
                                            <Label className="text-base font-semibold">{t('settings.tracking.enableScreenshots')}</Label>
                                            <p className="text-xs text-muted-foreground opacity-80">{t('settings.tracking.enableScreenshotsDesc')}</p>
                                        </div>
                                        <Switch
                                            checked={settings.enableScreenshots !== false}
                                            onCheckedChange={(checked: boolean) => onSaveSettings({ ...settings, enableScreenshots: checked })}
                                        />
                                    </div>

                                    <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
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

                                    <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
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

                                    <div className="space-y-6 p-4 bg-muted/30 rounded-lg">
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
                                            <div className="flex items-center justify-between animate-in fade-in slide-in-from-top-2">
                                                <div className="space-y-0.5">
                                                    <Label className="text-base font-semibold">{t('settings.tracking.selectApp')}</Label>
                                                    <p className="text-xs text-muted-foreground opacity-80">{t('settings.tracking.selectAppDesc')}</p>
                                                </div>
                                                <Select
                                                    value={settings.screenshotTargetProcess || ''}
                                                    onValueChange={(val) => onSaveSettings({ ...settings, screenshotTargetProcess: val })}
                                                >
                                                    <SelectTrigger className="w-[250px] bg-background border-none">
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
                                    {/* Google Drive Card */}
                                    <div className="p-4 bg-muted/30 rounded-lg flex flex-col gap-4 border border-border/50">
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                                                    <Cloud className="w-5 h-5 text-blue-500" />
                                                </div>
                                                <div>
                                                    <h4 className="font-semibold text-base">{t('settings.backup.drive')}</h4>
                                                    <p className="text-sm text-muted-foreground">{t('settings.backup.driveDesc')}</p>
                                                </div>
                                            </div>
                                            {settings.googleDriveTokens ? (
                                                <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20 px-2 py-0.5 flex items-center gap-1">
                                                    <Check className="w-3 h-3" />
                                                    {settings.googleDriveTokens.email || "Connected"}
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-muted-foreground px-2 py-0.5">
                                                    Not Connected
                                                </Badge>
                                            )}
                                        </div>

                                        <div className="flex items-center justify-between pt-2">
                                            <div className="text-xs text-muted-foreground">
                                                {settings.googleDriveTokens ? t('settings.backup.accessValid', { date: new Date(settings.googleDriveTokens.expiryDate).toLocaleDateString() }) : t('settings.backup.connectToEnable')}
                                            </div>

                                            {settings.googleDriveTokens ? (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => {
                                                        setConfirmConfig({
                                                            title: t('settings.backup.disconnectTitle', { service: "Google Drive" }),
                                                            description: t('settings.backup.disconnectConfirm'),
                                                            actionLabel: t('settings.backup.disconnect'),
                                                            onConfirm: async () => {
                                                                onSaveSettings({ ...settings, googleDriveTokens: undefined });
                                                                if ((window as any).ipcRenderer) {
                                                                    await (window as any).ipcRenderer.invoke('logout-google-drive');
                                                                }
                                                            }
                                                        });
                                                    }}
                                                    className="h-8 text-destructive hover:text-destructive"
                                                >
                                                    {t('settings.backup.disconnect')}
                                                </Button>
                                            ) : (
                                                <Button
                                                    size="sm"
                                                    className="h-8 gap-2"
                                                    onClick={async () => {
                                                        if ((window as any).ipcRenderer) {
                                                            try {
                                                                // Trigger Auth
                                                                const result = await (window as any).ipcRenderer.invoke('start-google-auth');
                                                                if (result.success && result.tokens) {
                                                                    // Update Local State via onSaveSettings to sync
                                                                    onSaveSettings({ ...settings, googleDriveTokens: result.tokens });
                                                                }
                                                            } catch (e) {
                                                                console.error("Auth failed", e);
                                                                alert("Authentication failed. Check console for details.");
                                                            }
                                                        }
                                                    }}
                                                >
                                                    {t('settings.backup.connect')}
                                                </Button>
                                            )}
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
                                            <div className="text-xs text-muted-foreground">
                                                {settings.notionTokens ? t('settings.backup.connectedWorkspace', { name: settings.notionTokens.workspaceName || 'Unknown' }) : t('settings.backup.connectNotion')}
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
                                                                            const progressHandler = (_: any, p: { processed: number, total: number }) => {
                                                                                const percent = Math.round((p.processed / p.total) * 100);
                                                                                // Update Bars
                                                                                const labelEl = document.getElementById('sync-progress-label');
                                                                                if (labelEl) labelEl.innerText = p.processed === 0 ? t('settings.backup.initializing') : t('settings.backup.syncingProgress', { processed: p.processed, total: p.total });

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
                                                                                        description: `Error: ${res.error}`, // Error message might be technical, keeping as is or using generic error? Using generic + error might be better but let's stick to simple replacement. Ideally res.error should be user friendly or we just show it.
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
                                                                                (window as any).ipcRenderer.removeListener('notion-sync-progress', progressHandler);
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
                                                    )}

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
                </ScrollArea >
            </div >
        );
    };

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

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent
                    className="max-w-none w-full h-full p-0 gap-0 bg-transparent border-none shadow-none flex items-center justify-center pointer-events-none transform-none !translate-x-0 !translate-y-0 left-0 top-0"
                    hideCloseButton
                >
                    <div className="flex max-w-[1000px] h-[85vh] w-full bg-background border border-border shadow-2xl rounded-lg overflow-hidden font-sans pointer-events-auto relative">
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
                                {infoConfig.details.map((d: any, i: number) => (
                                    <div key={i} className="flex flex-col py-2 border-b border-border/30 last:border-0 hover:bg-muted/30">
                                        <div className={cn("flex justify-between items-center", d.status === 'error' ? "text-destructive" : "text-foreground")}>
                                            <span className="opacity-90 font-medium">{d.date || d.file}</span>
                                            <div className="flex gap-3 items-center">
                                                {d.blocks !== undefined && <span className="text-[10px] opacity-60 uppercase tracking-widest">{d.blocks} blocks</span>}
                                                <span className={cn("font-bold", d.status === 'success' ? "text-green-600" : "text-red-500")}>
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

function SidebarButton({ active, onClick, label }: { active: boolean, onClick: () => void, label: string }) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "w-full flex items-center justify-between px-2.5 py-1.5 rounded-md transition-colors mb-0.5 group",
                active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            )}
        >
            <span className={cn("font-medium text-base md:text-sm", active ? "font-bold" : "")}>{label}</span>
        </button>
    )
}

function ThemeCard({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
    return (
        <div
            onClick={onClick}
            className={cn(
                "cursor-pointer rounded-lg p-3 flex flex-col items-center gap-2 transition-all border-2",
                active
                    ? "bg-muted/50 border-primary"
                    : "bg-muted/30 border-transparent hover:bg-muted/50"
            )}
        >

            <div className={cn("mt-2 p-2 rounded-full bg-background", active ? "text-primary" : "text-muted-foreground")}>
                {icon}
            </div>
            <span className={cn("text-xs font-bold pt-1 pb-2", active ? "text-foreground" : "text-muted-foreground")}>
                {label}
            </span>
            {active && (
                <div className="absolute top-2 right-2">
                    <div className="bg-primary rounded-full p-0.5">
                        <Check className="w-3 h-3 text-white" />
                    </div>
                </div>
            )}
        </div>
    )
}
