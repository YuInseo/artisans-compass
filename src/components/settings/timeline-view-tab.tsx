
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { AppSettings } from "@/types"
import { useTranslation } from 'react-i18next';
import { useState } from "react"
import { cn } from "@/lib/utils"
// @ts-ignore
import { DebouncedColorPicker } from "@/components/ui/debounced-color-picker"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { X, Pencil, GripVertical } from "lucide-react";
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


interface TimelineViewTabProps {
    settings: AppSettings;
    onSaveSettings: (settings: AppSettings) => Promise<void>;
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
    const handleSave = () => {
        if (editName && editName !== tag) {
            onRename?.(editName);
        } else {
            setEditName(tag);
        }
        setIsEditing(false);
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

            <DebouncedColorPicker
                color={color}
                onChange={(newColor: string) => onColorChange?.(newColor)}
            />

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

export function TimelineViewTab({ settings, onSaveSettings }: TimelineViewTabProps) {
    const { t } = useTranslation();
    const [newTypeInput, setNewTypeInput] = useState("");
    const [activeDragId, setActiveDragId] = useState<string | null>(null);
    const [dragWidth, setDragWidth] = useState<number | undefined>(undefined);

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

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div>
                <h3 className="text-xl font-bold mb-4 text-foreground">{t('sidebar.timeline')}</h3>
                <Separator className="bg-border/60" />

                {/* Project Types & Colors Section */}
                <div className="space-y-4 mt-6" id="settings-project-types">
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

                <div className="space-y-4 mt-8">



                    {/* Drag Preview Toggle */}
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
            </div>

            {/* Confirmation Dialog */}
            <Dialog open={!!confirmConfig} onOpenChange={(open) => !open && handleConfirmClose()}>
                <DialogContent>
                    <DialogTitle>{confirmConfig?.title}</DialogTitle>
                    <DialogDescription>
                        {confirmConfig?.description}
                    </DialogDescription>
                    <DialogFooter>
                        <Button variant="outline" onClick={handleConfirmClose}>{t('common.cancel')}</Button>
                        <Button variant="destructive" onClick={() => {
                            confirmConfig?.onConfirm();
                            handleConfirmClose();
                        }}>
                            {confirmConfig?.actionLabel || "Confirm"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
