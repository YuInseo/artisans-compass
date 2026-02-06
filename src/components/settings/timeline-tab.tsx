
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { X, Pencil, GripVertical } from "lucide-react";
import { AppSettings } from "@/types"
import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { useTranslation } from 'react-i18next';
import { useDataStore } from "@/hooks/useDataStore";
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
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog"


interface RunningApp {
    id?: string;
    name: string;
    process: string;
    appIcon?: string;
}

interface TimelineTabProps {
    settings: AppSettings;
    onSaveSettings: (settings: AppSettings) => Promise<void>;
    runningApps: RunningApp[];
}

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
    id
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
    id?: string
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(tag);
    const [localColor, setLocalColor] = useState(color);

    useEffect(() => {
        setLocalColor(color);
    }, [color]);

    const handleSave = () => {
        if (editName && editName !== tag) {
            onRename?.(editName);
        } else {
            setEditName(tag);
        }
        setIsEditing(false);
    };

    const handleColorChange = (newColor: string) => {
        setLocalColor(newColor);
        onColorChange?.(newColor);
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            id={id}
            className={cn(
                "group flex items-center gap-3 p-3 bg-background border border-border/50 rounded-lg shadow-sm transition-all hover:border-primary/50 hover:shadow-md",
                isDefault && "border-primary/20 bg-primary/5",
                isOverlay && "shadow-lg scale-105 border-primary z-50 cursor-grabbing",
                isDragging && "opacity-30"
            )}
        >
            <div {...listeners} className="cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-foreground transition-colors p-1">
                <GripVertical className="w-4 h-4" />
            </div>

            <div className="relative w-6 h-6 rounded-full overflow-hidden border border-border/50 shrink-0 group/picker">
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
            id={`sortable-item-${props.id}`}
            setNodeRef={setNodeRef}
            style={style}
            attributes={attributes}
            listeners={listeners}
            isDragging={isDragging}
        />
    );
}

function NightTimeSlider({ value, onChange, onCommit }: { value: number, onChange: (val: number) => void, onCommit: (val: number) => void }) {
    const { t } = useTranslation();
    const min = 18;
    const max = 28;

    const displayValue = value >= 24 ? value - 24 : value;

    return (
        <div className="bg-muted/30 p-4 rounded-lg">
            <SliderPrimitive.Root
                className="relative flex w-full touch-none select-none items-center cursor-pointer group pt-6 pb-2"
                min={min}
                max={max}
                step={1}
                value={[value]}
                onValueChange={(val) => onChange(val[0])}
                onValueCommit={(val) => onCommit(val[0])}
            >
                <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-secondary">
                    <SliderPrimitive.Range className="absolute h-full bg-primary" />
                </SliderPrimitive.Track>
                <SliderPrimitive.Thumb className="block h-5 w-5 rounded-full border-2 border-primary bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50">
                    <span className="absolute -top-7 left-1/2 -translate-x-1/2 text-[10px] font-bold text-primary bg-background border border-primary/20 px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap">
                        {displayValue}:00
                    </span>
                </SliderPrimitive.Thumb>
            </SliderPrimitive.Root>

            <div className="flex justify-between text-[10px] text-muted-foreground mt-2 px-1">
                <span>18:00</span>
                <span>{t('settings.timeline.nextDay')} 04:00</span>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
                {t('settings.timeline.nightTimeStartDesc')}
            </p>
        </div>
    )
}

export function TimelineTab({ settings, onSaveSettings, runningApps }: TimelineTabProps) {
    const { t } = useTranslation();
    const { previewSettings } = useDataStore();
    const [newTypeInput, setNewTypeInput] = useState("");
    const [activeDragId, setActiveDragId] = useState<string | null>(null);
    const [dragWidth, setDragWidth] = useState<number | undefined>(undefined);
    const [runningAppsSearch, setRunningAppsSearch] = useState("");

    // Confirmation Dialog State
    const [confirmConfig, setConfirmConfig] = useState<{
        title: string;
        description: string;
        actionLabel: string;
        onConfirm: () => void;
    } | null>(null);

    // Local state for Night Time Start preview
    const [previewTime, setPreviewTime] = useState(settings.nightTimeStart || 22);

    useEffect(() => {
        setPreviewTime(settings.nightTimeStart || 22);
    }, [settings.nightTimeStart]);

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

    const handleDragStart = (event: any) => {
        const { active } = event;
        setActiveDragId(active.id);

        const element = document.getElementById(`sortable-item-${active.id}`);
        if (element) {
            setDragWidth(element.offsetWidth);
        }
    };

    const handleDragCancel = () => {
        setActiveDragId(null);
        setDragWidth(undefined);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            // Reorder settings.projectTags
            const oldIndex = settings.projectTags.indexOf(active.id as string);
            const newIndex = settings.projectTags.indexOf(over.id as string);

            if (oldIndex !== -1 && newIndex !== -1) {
                const newTags = arrayMove(settings.projectTags, oldIndex, newIndex);
                onSaveSettings({ ...settings, projectTags: newTags });
            }
        }

        setActiveDragId(null);
        setDragWidth(undefined);
    };

    const handleConfirmClose = () => {
        setConfirmConfig(null);
    };


    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div>
                <h3 className="text-xl font-bold mb-4 text-foreground">{t('settings.timelineConfig')}</h3>
                <Separator className="bg-border/60" />

                {/* Project Types & Colors Section */}
                <div className="space-y-4" id="settings-project-types">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                            <h5 className="text-base font-semibold text-foreground">{t('settings.projectTypes')}</h5>
                            <div className="flex items-center gap-2">
                                <Label htmlFor="custom-colors" className="text-sm font-normal text-muted-foreground cursor-pointer select-none">
                                    {t('settings.allowCustomColors')}
                                </Label>
                                <Switch
                                    id="custom-colors"
                                    checked={settings.enableCustomProjectColors || false}
                                    onCheckedChange={(checked) => onSaveSettings({ ...settings, enableCustomProjectColors: checked })}
                                />
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
                                                typeColors: { ...(settings.typeColors || {}), [tag]: "#808080" }
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
                <Separator className="bg-border/60" />
            </div>

            <div className="space-y-4" id="settings-timeline-preview">
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

            {/* Work Apps Filter Section */}
            <div className="flex flex-col bg-muted/30 rounded-lg border border-border/50 overflow-hidden" id="settings-work-apps">
                {/* Header / Main Switch */}
                <div className="flex items-center justify-between p-4 bg-muted/20">
                    <div className="space-y-0.5">
                        <Label className="text-base font-semibold">{t('settings.timeline.filterWorkApps') || "Show Only Work Programs"}</Label>
                        <p className="text-xs text-muted-foreground opacity-80">
                            {t('settings.timeline.filterWorkAppsDesc') || "Only show configured work programs in the timeline visualization."}
                        </p>
                    </div>
                    <Switch
                        checked={settings.filterTimelineByWorkApps || false}
                        onCheckedChange={(checked) => onSaveSettings({ ...settings, filterTimelineByWorkApps: checked })}
                    />
                </div>

                {settings.filterTimelineByWorkApps && (
                    <div className="flex flex-col gap-4 p-4 border-t border-border/50 animate-in slide-in-from-top-2 fade-in duration-200">
                        <div className="flex flex-col gap-2">
                            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                                {t('settings.timeline.configuredApps') || "Configured Apps"}
                            </Label>
                            <div className="flex flex-wrap gap-2 min-h-[40px] p-3 rounded-lg bg-background border border-border/50">
                                {settings.workApps?.map(app => (
                                    <div key={app} className="flex items-center gap-1 bg-muted px-2 py-1.5 rounded text-xs font-medium border border-border">
                                        {app}
                                        <button
                                            onClick={() => onSaveSettings({ ...settings, workApps: settings.workApps?.filter(a => a !== app) })}
                                            className="hover:text-destructive transition-colors ml-1"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}
                                {(!settings.workApps || settings.workApps.length === 0) && (
                                    <div className="text-xs text-muted-foreground italic p-1">No apps configured</div>
                                )}
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <Input
                                placeholder="Add Process Name (e.g. Code.exe)..."
                                className="h-9 text-sm bg-background border-input"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        const val = (e.currentTarget as HTMLInputElement).value?.trim();
                                        if (val && !settings.workApps?.includes(val)) {
                                            onSaveSettings({
                                                ...settings,
                                                workApps: [...(settings.workApps || []), val]
                                            });
                                            (e.currentTarget as HTMLInputElement).value = '';
                                        }
                                    }
                                }}
                            />
                            <Button
                                size="sm"
                                className="h-9 shrink-0"
                                onClick={(e) => {
                                    const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                                    const val = input.value?.trim();
                                    if (val && !settings.workApps?.includes(val)) {
                                        onSaveSettings({
                                            ...settings,
                                            workApps: [...(settings.workApps || []), val]
                                        });
                                        input.value = '';
                                    }
                                }}
                            >
                                Add
                            </Button>
                        </div>

                        <div className="pt-4 border-t border-border/50">
                            <h4 className="text-sm font-semibold mb-2">{t('settings.runningApps') || "Running Apps Details"}</h4>
                            <div className="bg-muted/40 rounded-lg p-2 border border-border/50">
                                <Input
                                    className="h-8 mb-2 bg-background/50 border-border/50"
                                    placeholder={t("common.search")}
                                    onChange={(e) => setRunningAppsSearch(e.target.value)}
                                />
                                <div className="space-y-1 max-h-[200px] overflow-y-auto custom-scrollbar pr-1">
                                    {runningApps
                                        .filter(app => !runningAppsSearch || app.name.toLowerCase().includes(runningAppsSearch.toLowerCase()) || app.process.toLowerCase().includes(runningAppsSearch.toLowerCase()))
                                        .map(app => {
                                            const isAdded = settings.workApps?.some(wa => wa.toLowerCase() === app.process.toLowerCase());
                                            return (
                                                <div key={app.process} className="flex items-center justify-between p-2 rounded hover:bg-muted/50 group">
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="text-sm font-medium truncate">{app.name}</span>
                                                        <span className="text-xs text-muted-foreground truncate">{app.process}</span>
                                                    </div>
                                                    <Button
                                                        size="sm"
                                                        variant={isAdded ? "secondary" : "ghost"}
                                                        className={cn("h-7 text-xs", isAdded ? "opacity-50" : "hover:bg-primary/10 hover:text-primary")}
                                                        disabled={isAdded}
                                                        onClick={() => {
                                                            if (!isAdded) {
                                                                onSaveSettings({
                                                                    ...settings,
                                                                    workApps: [...(settings.workApps || []), app.process]
                                                                });
                                                            }
                                                        }}
                                                    >
                                                        {isAdded ? "Added" : "Add"}
                                                    </Button>
                                                </div>
                                            );
                                        })}
                                    {runningApps.length === 0 && (
                                        <div className="text-center py-4 text-xs text-muted-foreground">
                                            {t('settings.loadingApps')}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="space-y-4">
                <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <Label className="text-base font-semibold">{t('settings.timeline.nightTimeStart')}</Label>
                    </div>
                    <div className="px-1">
                        <NightTimeSlider
                            value={previewTime}
                            onChange={(val) => {
                                setPreviewTime(val);
                                previewSettings({ nightTimeStart: val });
                            }}
                            onCommit={(val) => onSaveSettings({ ...settings, nightTimeStart: val })}
                        />
                    </div>

                </div>
            </div>

            {/* Confirmation Dialog needed for deletion */}
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
        </div>
    )
}
