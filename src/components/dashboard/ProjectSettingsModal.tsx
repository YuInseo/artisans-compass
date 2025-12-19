import { useState, useEffect } from "react";
import { Project } from "@/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ProjectSettingsModalProps {
    project: Project | null;
    isOpen: boolean;
    onClose: () => void;
    onSave: (updated: Project) => void;
    onDelete: (id: string) => void;
}

export function ProjectSettingsModal({ project, isOpen, onClose, onSave, onDelete }: ProjectSettingsModalProps) {
    const [name, setName] = useState(project?.name || "");
    const [type, setType] = useState(project?.type || "Main");
    const [isCompleted, setIsCompleted] = useState(project?.isCompleted || false);
    const [locked, setLocked] = useState(project?.locked || false);

    // Update local state when project changes or modal opens
    useEffect(() => {
        if (project && isOpen) {
            setName(project.name);
            setType(project.type);
            setIsCompleted(project.isCompleted);
            setLocked(!!project.locked);
        }
    }, [project, isOpen]);

    const handleSave = () => {
        if (!project) return;
        onSave({ ...project, name, type, isCompleted, locked });
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Project Settings</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-right">
                            Name
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
                            Type
                        </Label>
                        <div className="col-span-3 flex gap-2">
                            {["Main", "Sub", "Practice"].map(t => (
                                <Button
                                    key={t}
                                    type="button"
                                    variant={type === t ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setType(t)}
                                >
                                    {t}
                                </Button>
                            ))}
                        </div>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="status" className="text-right">
                            Status
                        </Label>
                        <div className="col-span-3 flex gap-2">
                            <Button
                                type="button"
                                variant={isCompleted ? "outline" : "default"}
                                size="sm"
                                onClick={() => setIsCompleted(false)}
                            >
                                Active
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
                                Completed
                            </Button>
                        </div>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="locked" className="text-right">
                            Locked
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
                                Prevent dragging and resizing
                            </label>
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="destructive" onClick={() => { onDelete(project!.id); onClose(); }}>Delete</Button>
                    <Button onClick={handleSave}>Save changes</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
