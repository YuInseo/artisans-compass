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
import { useTheme } from "@/components/theme-provider"
import { Badge } from "@/components/ui/badge"
import { X, Cloud, Check, Moon, Sun, Monitor, Eye, EyeOff } from "lucide-react";
import { AppSettings } from "@/types"
import { useState, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"

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
    DragEndEvent
} from '@dnd-kit/core';
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

// Sortable Item Component
// Sortable Item Component
function SortableProjectType({ id, tag, color, isDefault, onDelete, onColorChange, onRename }: {
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
    } = useSortable({ id });

    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(tag);

    const [localColor, setLocalColor] = useState(color);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Sync local color with prop color (upstream changes)
    useEffect(() => {
        setLocalColor(color);
    }, [color]);

    const handleColorChange = (newColor: string) => {
        setLocalColor(newColor);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            onColorChange(newColor);
        }, 100); // 100ms debounce to prevent render lag
    };

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 'auto',
        opacity: isDragging ? 0.5 : 1,
    };

    const handleSave = () => {
        if (editName.trim() && editName !== tag) {
            onRename(editName.trim());
        }
        setIsEditing(false);
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="flex items-center gap-4 bg-background p-2 rounded border border-border/40 group"
        >
            <div {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground">
                <GripVertical className="w-4 h-4" />
            </div>

            {/* Color Picker Popover/Input */}
            <div className="relative group/picker w-8 h-8 flex-shrink-0">
                <div
                    className="absolute inset-0 rounded-full border-2 border-transparent ring-2 ring-offset-1 transition-transform group-hover/picker:scale-110 pointer-events-none"
                    style={{ backgroundColor: localColor }}
                />
                <input
                    type="color"
                    value={localColor}
                    onChange={(e) => handleColorChange(e.target.value)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    title="Change Color"
                />
            </div>

            <div className="flex-1 flex items-center gap-2">
                {isEditing ? (
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
                        <span className="font-medium text-sm">{tag}</span>
                        {isDefault && (
                            <span className="text-[10px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded uppercase tracking-wide">
                                (Default)
                            </span>
                        )}
                    </>
                )}
            </div>

            <div className="flex items-center">
                {/* Rename Trigger */}
                {!isEditing && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => setIsEditing(true)}
                    >
                        <Pencil className="w-3.5 h-3.5" />
                    </Button>
                )}

                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={onDelete}
                >
                    <X className="w-4 h-4" />
                </Button>
            </div>
        </div>
    );
}

export function SettingsModal({ open, onOpenChange, settings, onSaveSettings, defaultTab = 'general' }: SettingsModalProps) {
    const { setTheme, theme } = useTheme()
    const [activeTab, setActiveTab] = useState<SettingsTab>(defaultTab);

    // Sync activeTab with defaultTab when open changes
    useEffect(() => {
        if (open) {
            setActiveTab(defaultTab);
        }
    }, [open, defaultTab]);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || !settings?.projectTags) return;

        if (active.id !== over.id && settings) {
            const oldIndex = settings.projectTags.indexOf(active.id as string);
            const newIndex = settings.projectTags.indexOf(over.id as string);
            const newTags = arrayMove(settings.projectTags, oldIndex, newIndex);
            onSaveSettings({ ...settings, projectTags: newTags });
        }
    };


    // General Tab State
    const [newAppInput, setNewAppInput] = useState("");
    const [runningApps, setRunningApps] = useState<{ id: string, name: string, process?: string, appIcon?: string }[]>([]);

    // Tracking Tab State
    const [screenSources, setScreenSources] = useState<{ id: string, name: string, thumbnail: string }[]>([]);

    // Timeline Tab State
    const [newTypeInput, setNewTypeInput] = useState("");

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
            const fetchSources = async () => {
                if ((window as any).ipcRenderer) {
                    try {
                        const sources = await (window as any).ipcRenderer.invoke('get-screen-sources');
                        setScreenSources(sources);
                        // If no display selected yet, auto-select first
                        if (sources.length > 0 && !settings?.screenshotDisplayId) {
                            // Don't auto-save here to avoid side effects, just let user choose
                        }
                    } catch (e) {
                        console.error("Failed to fetch screen sources", e);
                    }
                }
            };
            fetchSources();
        }
    }, [open, activeTab]);

    const renderSidebar = () => (
        <div className="w-[210px] shrink-0 bg-muted/30 flex flex-col p-2 gap-[2px] justify-end md:justify-start">
            <div className="px-3 pt-6 pb-3 md:pt-4">
                <h2 className="text-xs font-bold text-muted-foreground uppercase px-2 mb-1">User Settings</h2>
            </div>

            <SidebarButton
                active={activeTab === 'general'}
                onClick={() => setActiveTab('general')}
                label="General"
            />
            <SidebarButton
                active={activeTab === 'appearance'}
                onClick={() => setActiveTab('appearance')}
                label="Appearance"
            />
            <SidebarButton
                active={activeTab === 'timeline'}
                onClick={() => setActiveTab('timeline')}
                label="Timeline"
            />
            <SidebarButton
                active={activeTab === 'tracking'}
                onClick={() => setActiveTab('tracking')}
                label="Tracking"
            />
            <SidebarButton
                active={activeTab === 'integrations'}
                onClick={() => setActiveTab('integrations')}
                label="Integrations"
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
                                    <h3 className="text-xl font-bold mb-4 text-foreground">General Preferences</h3>
                                    <Separator className="bg-border/60 mb-6" />

                                    <div className="space-y-4 mb-8">
                                        <h5 className="text-base font-semibold text-foreground mb-1">Weekly Schedule</h5>
                                        <div className="flex flex-col gap-3">
                                            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Start Of Week</Label>
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
                                                <span className="text-sm text-foreground">Day when your weekly goals reset</span>
                                            </div>
                                        </div>
                                    </div>
                                    <Separator className="bg-border/30 mb-8" />
                                </div>

                                <div>
                                    <h3 className="text-xl font-bold mb-4 text-foreground">Tracked Applications</h3>
                                    <p className="text-sm text-muted-foreground mb-4">
                                        Artisan's Compass automatically tracks time when these apps are active.
                                    </p>
                                    <Separator className="bg-border/60" />
                                </div>



                                {/* Active Apps Pills */}
                                <div className="space-y-2 pt-2">
                                    <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Monitored Processes</h5>
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
                                    <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">Detailed Running Apps</h5>
                                    <div className="rounded-lg overflow-hidden border border-border/50 bg-muted/30">
                                        {/* Search / Add Input Header */}
                                        <div className="p-2 border-b border-border/10 bg-muted/50">
                                            <div className="flex gap-2">
                                                <Input
                                                    placeholder="Search running apps or add process manually..."
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
                                                        Add
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
                                                        .filter(app => !newAppInput ||
                                                            (app.process && app.process.toLowerCase().includes(newAppInput.toLowerCase())) ||
                                                            (app.name && app.name.toLowerCase().includes(newAppInput.toLowerCase()))
                                                        )
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
                                </div>
                            </div>
                        )}

                        {activeTab === 'appearance' && (
                            <div className="space-y-8 animate-in fade-in duration-300">
                                <div>
                                    <h3 className="text-xl font-bold mb-4 text-foreground">Appearance</h3>
                                    <Separator className="bg-border/60" />
                                </div>

                                <div className="space-y-4">
                                    <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">Theme</h5>
                                    <div className="grid grid-cols-3 gap-4">
                                        <ThemeCard
                                            active={theme === 'light'}
                                            onClick={() => setTheme('light')}
                                            icon={<Sun className="w-6 h-6" />}
                                            label="Light"
                                        />
                                        <ThemeCard
                                            active={theme === 'dark'}
                                            onClick={() => setTheme('dark')}
                                            icon={<Moon className="w-6 h-6" />}
                                            label="Dark"
                                        />
                                        <ThemeCard
                                            active={theme === 'system'}
                                            onClick={() => setTheme('system')}
                                            icon={<Monitor className="w-6 h-6" />}
                                            label="System"
                                        />
                                    </div>
                                </div>

                                <Separator className="bg-border/30" />

                                <div className="space-y-4">
                                    <h5 className="text-base font-semibold text-foreground mb-1">Widget Settings</h5>

                                    <div className="flex flex-col gap-3">
                                        <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Widget Header Display</Label>
                                        <div className="flex items-center gap-4 bg-muted/30 p-4 rounded-lg">
                                            <Select
                                                value={settings.widgetDisplayMode || 'none'}
                                                onValueChange={(val: any) => onSaveSettings({ ...settings, widgetDisplayMode: val })}
                                            >
                                                <SelectTrigger className="w-[180px] bg-background border-none">
                                                    <SelectValue placeholder="Select Display" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">None</SelectItem>
                                                    <SelectItem value="quote">Daily Quote</SelectItem>
                                                    <SelectItem value="goals">Focus Goals</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <span className="text-sm text-foreground">Content shown at top of widget</span>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-3">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Widget Max Height</Label>
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
                                                <span>Short</span>
                                                <span>Tall</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <Separator className="bg-border/30" />

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h5 className="text-base font-semibold text-foreground mb-1">Checkbox Visibility</h5>
                                            <p className="text-sm text-muted-foreground">
                                                Control when task checkboxes are displayed.
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
                                                    <span className="font-medium text-sm">Design Mode (High Visibility)</span>
                                                    <span className="text-xs text-muted-foreground">Checkboxes are always visible.</span>
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
                                                    <span className="font-medium text-sm">Focus Mode (Low Visibility)</span>
                                                    <span className="text-xs text-muted-foreground">Checkboxes appear only on hover. Cleaner look.</span>
                                                </div>
                                            </div>
                                            <EyeOff className="w-5 h-5 text-muted-foreground" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'timeline' && (
                            <div className="space-y-6 animate-in fade-in duration-300">
                                <div>
                                    <h3 className="text-xl font-bold mb-4 text-foreground">Timeline Configurations</h3>
                                    <Separator className="bg-border/60" />
                                </div>

                                <div className="grid gap-8">
                                    {/* Project Types & Colors Section */}
                                    <div className="space-y-4">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center justify-between">
                                                <h5 className="text-base font-semibold text-foreground">Project Types & Colors</h5>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        id="custom-colors"
                                                        checked={settings.enableCustomProjectColors || false}
                                                        onChange={(e) => onSaveSettings({ ...settings, enableCustomProjectColors: e.target.checked })}
                                                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                                    />
                                                    <Label htmlFor="custom-colors" className="text-sm font-normal text-muted-foreground cursor-pointer select-none">
                                                        Allow custom colors per project
                                                    </Label>
                                                </div>
                                            </div>
                                            <p className="text-sm text-muted-foreground pb-2">
                                                The top-most project tag will be the default for new projects. Drag to reorder.
                                            </p>
                                        </div>

                                        <div className="bg-muted/30 p-4 rounded-lg space-y-4">
                                            <div className="space-y-2 max-h-[300px] overflow-y-auto px-1 custom-scrollbar">
                                                <DndContext
                                                    sensors={sensors}
                                                    collisionDetection={closestCenter}
                                                    onDragEnd={handleDragEnd}
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
                                                                    if (confirm(`Delete project type "${tag}"?`)) {
                                                                        const updatedTags = settings.projectTags.filter(t => t !== tag);
                                                                        const updatedColors = { ...settings.typeColors };
                                                                        delete updatedColors[tag];
                                                                        onSaveSettings({ ...settings, projectTags: updatedTags, typeColors: updatedColors });
                                                                    }
                                                                }}
                                                            />
                                                        ))}
                                                    </SortableContext>
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
                                        <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Visible Project Rows</Label>
                                        <div className="flex items-center gap-4 bg-muted/30 p-4 rounded-lg">
                                            <Input
                                                type="number"
                                                min={1}
                                                max={20}
                                                value={settings.visibleProjectRows}
                                                onChange={(e) => onSaveSettings({ ...settings, visibleProjectRows: parseInt(e.target.value) || 3 })}
                                                className="w-24 bg-background border-none"
                                            />
                                            <span className="text-sm text-foreground">Rows shown before scrolling</span>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-3">
                                        <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Default Project Duration</Label>
                                        <div className="flex items-center gap-4 bg-muted/30 p-4 rounded-lg">
                                            <Input
                                                type="number"
                                                min={1}
                                                max={365}
                                                value={settings.defaultProjectDurationDays}
                                                onChange={(e) => onSaveSettings({ ...settings, defaultProjectDurationDays: parseInt(e.target.value) || 14 })}
                                                className="w-24 bg-background border-none"
                                            />
                                            <span className="text-sm text-foreground">Days (for new projects)</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'tracking' && (
                            <div className="space-y-6 animate-in fade-in duration-300">
                                <div>
                                    <h3 className="text-xl font-bold mb-4 text-foreground">Values & Privacy</h3>
                                    <Separator className="bg-border/60" />
                                </div>

                                <div className="space-y-6">
                                    <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                                        <div className="space-y-0.5">
                                            <Label className="text-base font-semibold">Screenshot Interval</Label>
                                            <p className="text-xs text-muted-foreground opacity-80">Frequency of automated captures.</p>
                                        </div>
                                        <Select
                                            value={String(settings.screenshotIntervalSeconds)}
                                            onValueChange={(val) => onSaveSettings({ ...settings, screenshotIntervalSeconds: parseInt(val) })}
                                        >
                                            <SelectTrigger className="w-[180px] bg-background border-none">
                                                <SelectValue placeholder="Select interval" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="10">10 Seconds (Test)</SelectItem>
                                                <SelectItem value="300">5 Minutes</SelectItem>
                                                <SelectItem value="900">15 Minutes</SelectItem>
                                                <SelectItem value="1800">30 Minutes</SelectItem>
                                                <SelectItem value="3600">1 Hour</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                                        <div className="space-y-0.5">
                                            <Label className="text-base font-semibold">Timelapse Speed</Label>
                                            <p className="text-xs text-muted-foreground opacity-80">Playback duration for daily review.</p>
                                        </div>
                                        <Select
                                            value={String(settings.timelapseDurationSeconds)}
                                            onValueChange={(val) => onSaveSettings({ ...settings, timelapseDurationSeconds: parseInt(val) })}
                                        >
                                            <SelectTrigger className="w-[180px] bg-background border-none">
                                                <SelectValue placeholder="Select duration" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="3">3 Seconds</SelectItem>
                                                <SelectItem value="5">5 Seconds</SelectItem>
                                                <SelectItem value="10">10 Seconds</SelectItem>
                                                <SelectItem value="30">30 Seconds</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-6 p-4 bg-muted/30 rounded-lg">
                                        <div className="flex items-center justify-between">
                                            <div className="space-y-0.5">
                                                <Label className="text-base font-semibold">Screenshot Mode</Label>
                                                <p className="text-xs text-muted-foreground opacity-80">Choose how screenshots are captured.</p>
                                            </div>
                                            <Select
                                                value={settings.screenshotMode || 'window'}
                                                onValueChange={(val: 'window' | 'screen' | 'process') => onSaveSettings({ ...settings, screenshotMode: val })}
                                            >
                                                <SelectTrigger className="w-[180px] bg-background border-none">
                                                    <SelectValue placeholder="Select Mode" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="window">Active Window</SelectItem>
                                                    <SelectItem value="process">Specific App</SelectItem>
                                                    <SelectItem value="screen">Display / Monitor</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {settings.screenshotMode === 'process' && (
                                            <div className="flex items-center justify-between animate-in fade-in slide-in-from-top-2">
                                                <div className="space-y-0.5">
                                                    <Label className="text-base font-semibold">Select App</Label>
                                                    <p className="text-xs text-muted-foreground opacity-80">Only capture this application.</p>
                                                </div>
                                                <Select
                                                    value={settings.screenshotTargetProcess || ''}
                                                    onValueChange={(val) => onSaveSettings({ ...settings, screenshotTargetProcess: val })}
                                                >
                                                    <SelectTrigger className="w-[250px] bg-background border-none">
                                                        <SelectValue placeholder="Select Process" />
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
                                                            <div className="p-2 text-xs text-center text-muted-foreground">No monitored apps configured.</div>
                                                        )}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        )}

                                        {settings.screenshotMode === 'screen' && (
                                            <div className="flex items-center justify-between animate-in fade-in slide-in-from-top-2">
                                                <div className="space-y-0.5">
                                                    <Label className="text-base font-semibold">Select Display</Label>
                                                    <p className="text-xs text-muted-foreground opacity-80">Which monitor to capture.</p>
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
                                                <Label className="text-base font-semibold">Screenshot Location</Label>
                                                <p className="text-xs text-muted-foreground opacity-80">Where images are stored.</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 pt-1">
                                            <Input
                                                readOnly
                                                value={settings.screenshotPath || "Default (AppData)"}
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
                                                Change
                                            </Button>
                                        </div>
                                        <p className="text-xs text-muted-foreground pt-1">
                                            Old screenshots remain in the previous location.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'integrations' && (
                            <div className="space-y-6 animate-in fade-in duration-300">
                                <div>
                                    <h3 className="text-xl font-bold mb-4 text-foreground">Integrations</h3>
                                    <Separator className="bg-border/60" />
                                </div>

                                <div className="space-y-4">
                                    {/* Google Drive Card */}
                                    <div className="p-4 bg-muted/30 rounded-lg flex flex-col gap-4 border border-border/50">
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                                                    <Cloud className="w-5 h-5 text-blue-500" />
                                                </div>
                                                <div>
                                                    <h4 className="font-semibold text-base">Google Drive</h4>
                                                    <p className="text-sm text-muted-foreground">Sync artifacts and browse files directly.</p>
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
                                                {settings.googleDriveTokens ? `Access valid until: ${new Date(settings.googleDriveTokens.expiryDate).toLocaleDateString()}` : "Connect to enable Drive features."}
                                            </div>

                                            {settings.googleDriveTokens ? (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={async () => {
                                                        const confirm = window.confirm("Are you sure you want to disconnect Google Drive?");
                                                        if (confirm) {
                                                            onSaveSettings({ ...settings, googleDriveTokens: undefined });
                                                            if ((window as any).ipcRenderer) {
                                                                await (window as any).ipcRenderer.invoke('logout-google-drive');
                                                            }
                                                        }
                                                    }}
                                                    className="h-8 text-destructive hover:text-destructive"
                                                >
                                                    Disconnect
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
                                                    Connect Drive
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>
                </ScrollArea>
            </div>
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[1000px] h-[85vh] p-0 gap-0 overflow-hidden bg-background border-none shadow-2xl rounded-lg flex font-sans" hideCloseButton>
                <DialogTitle className="sr-only">Settings</DialogTitle>
                <DialogDescription className="sr-only">Adjust preferences and settings</DialogDescription>
                {renderSidebar()}
                {renderContent()}
            </DialogContent>
        </Dialog>
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
