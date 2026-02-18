import { useState, useEffect } from "react";
import { Project } from "@/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDataStore } from "@/hooks/useDataStore";
import { useTranslation } from "react-i18next";

interface ProjectSettingsModalProps {
    project: Project | null;
    isOpen: boolean;
    onClose: () => void;
    onSave: (updated: Project) => void;
    onDelete: (id: string) => void;
    onManageTypes?: (tab: 'timeline') => void;
}

const DEFAULT_COLORS = [
    "#3b82f6", // Blue (Main)
    "#22c55e", // Green (Sub)
    "#eab308", // Yellow (Practice)
    "#ef4444", // Red
];

export function ProjectSettingsModal({ project, isOpen, onClose, onSave, onDelete, onManageTypes }: ProjectSettingsModalProps) {
    const { t } = useTranslation();
    const { settings } = useDataStore();
    const [name, setName] = useState(project?.name || "");
    const [type, setType] = useState(project?.type || "Main");
    const [isCompleted, setIsCompleted] = useState(project?.isCompleted || false);
    const [locked, setLocked] = useState(project?.locked || false);
    const [color, setColor] = useState<string | undefined>(project?.color);

    // Update local state when project changes or modal opens
    useEffect(() => {
        if (project && isOpen) {
            setName(project.name);
            setType(project.type);
            setIsCompleted(project.isCompleted);
            setLocked(!!project.locked);
            setColor(project.color);
        }
    }, [project, isOpen]);

    const handleSave = () => {
        if (!project) return;
        // If custom colors disabled, ensure we don't save a custom color (or we can leave it to be ignored by renderer)
        // Let's clear it if disabled to avoid confusion when re-enabling?
        // Actually, better to keep it but just not use it. But for cleanliness, if disabled, maybe we should save undefined?
        // Let's just save whatever is in state. The renderer decides what to show.
        onSave({ ...project, name, type, isCompleted, locked, color });
        onClose();
    };



    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('modals.projectSettings.title')}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-right">
                            {t('modals.projectSettings.name')}
                        </Label>
                        <Input
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="col-span-3"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="type" className="text-right">
                            {t('modals.projectSettings.type')}
                        </Label>
                        <div className="col-span-3 flex flex-wrap gap-2 items-center">
                            {(settings?.projectTags || ["Main", "Sub", "Practice"]).map(t => (
                                <Button
                                    key={t}
                                    type="button"
                                    variant={type === t ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setType(t)}
                                    className="relative transition-all"
                                    style={{
                                        // Show type color as border or background hint
                                        borderColor: type === t ? 'transparent' : settings?.typeColors?.[t] || 'transparent',
                                        backgroundColor: type === t ? (settings?.typeColors?.[t] || 'primary') : 'transparent',
                                        color: type === t ? '#fff' : 'inherit'
                                    }}
                                >
                                    {t}
                                </Button>
                            ))}
                            {/* Manage Types Hint */}
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-xs text-muted-foreground ml-auto"
                                onClick={() => {
                                    if (onManageTypes) {
                                        onClose(); // Close this modal logic first? Or let parent handle? 
                                        // Parent opens SettingsModal. SettingsModal likely has higher z-index or stacks.
                                        // But safer to close current specific modal to avoid clutter.
                                        onManageTypes('timeline');
                                    } else {
                                        alert(t('modals.projectSettings.manageTypesAlert'));
                                    }
                                }}
                            >
                                {t('modals.projectSettings.editTypes')}
                            </Button>
                        </div>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="status" className="text-right">
                            {t('modals.projectSettings.status')}
                        </Label>
                        <div className="col-span-3 flex gap-2">
                            <Button
                                type="button"
                                variant={isCompleted ? "outline" : "default"}
                                size="sm"
                                onClick={() => setIsCompleted(false)}
                            >
                                {t('modals.projectSettings.active')}
                            </Button>
                            <Button
                                type="button"
                                variant={isCompleted ? "default" : "outline"}
                                size="sm"
                                onClick={() => {
                                    setIsCompleted(true);
                                    setLocked(true); // Auto-lock on completion
                                }}
                            >
                                {t('modals.projectSettings.completed')}
                            </Button>
                        </div>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="locked" className="text-right">
                            {t('modals.projectSettings.locked')}
                        </Label>
                        <div className="col-span-3 flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="locked"
                                checked={locked}
                                onChange={(e) => setLocked(e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <label htmlFor="locked" className="text-sm text-muted-foreground">
                                {t('modals.projectSettings.preventDrag')}
                            </label>
                        </div>
                    </div>

                    {/* Color Picker Section */}
                    {/* Color Picker Section - Only confirm if enabled */}
                    {settings?.enableCustomProjectColors && (
                        <div className="grid grid-cols-4 items-start gap-4">
                            <Label className="text-right pt-2">
                                {t('modals.projectSettings.color')}
                            </Label>
                            <div className="col-span-3">
                                <div className="space-y-2">
                                    <div className="flex flex-wrap gap-2">
                                        {DEFAULT_COLORS.map((c) => (
                                            <button
                                                key={c}
                                                type="button"
                                                className={`w-8 h-8 rounded-full border-2 transition-all ${color === c ? 'border-primary ring-2 ring-primary ring-offset-2' : 'border-transparent hover:scale-110'}`}
                                                style={{ backgroundColor: c }}
                                                onClick={() => setColor(c)}
                                                aria-label={`Select color ${c}`}
                                            />
                                        ))}
                                        <button
                                            type="button"
                                            className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-mono bg-muted text-muted-foreground transition-all ${!color ? 'border-primary ring-2 ring-primary ring-offset-2' : 'border-transparent hover:scale-110'}`}
                                            onClick={() => setColor(undefined)}
                                            title={t('modals.projectSettings.defaultColor')}
                                        >
                                            /
                                        </button>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        {t('modals.projectSettings.overrideColor', { type })}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="destructive" onClick={() => { onDelete(project!.id); onClose(); }}>{t('modals.projectSettings.delete')}</Button>
                    <Button onClick={handleSave}>{t('modals.projectSettings.saveChanges')}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
