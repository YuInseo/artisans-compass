import { useState, useEffect } from "react";
import { PlannedSession } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Trash2 } from "lucide-react";
import { format } from "date-fns";

interface PlanEditorProps {
    isOpen: boolean;
    onClose: () => void;
    session: Partial<PlannedSession> | null;
    onSave: (session: Partial<PlannedSession>) => void;
    onDelete: (id: string) => void;
}

export function PlanEditor({ isOpen, onClose, session, onSave, onDelete }: PlanEditorProps) {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [duration, setDuration] = useState(60); // minutes
    const [color, setColor] = useState("blue"); // default color

    useEffect(() => {
        if (session) {
            setTitle(session.title || "");
            setDescription(session.description || "");
            setDuration(session.duration ? Math.round(session.duration / 60) : 60);
            setColor(session.color || "blue");
        } else {
            setTitle("");
            setDescription("");
            setDuration(60);
            setColor("blue");
        }
    }, [session, isOpen]);

    const handleSave = () => {
        if (!session) return;
        onSave({
            ...session,
            title,
            description,
            duration: duration * 60, // back to seconds
            color
        });
        onClose();
    };

    const handleDelete = () => {
        if (session && session.id) {
            onDelete(session.id);
            onClose();
        }
    };

    if (!session) return null;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>
                        {session.id ? "Edit Planned Session" : "Plan Session"}
                    </DialogTitle>
                    <div className="text-xs text-muted-foreground">
                        {session.start && format(new Date(session.start), 'PPP p')}
                    </div>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="title" className="text-right">
                            Title
                        </Label>
                        <Input
                            id="title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="col-span-3"
                            placeholder="Focus Task"
                            autoFocus
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="duration" className="text-right">
                            Duration
                        </Label>
                        <Input
                            id="duration"
                            type="number"
                            value={duration}
                            onChange={(e) => setDuration(parseInt(e.target.value) || 0)}
                            className="col-span-3"
                        />
                        <span className="text-xs text-muted-foreground absolute right-8">min</span>
                    </div>
                    <div className="grid grid-cols-4 items-start gap-4">
                        <Label htmlFor="desc" className="text-right mt-2">
                            Notes
                        </Label>
                        <Textarea
                            id="desc"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="col-span-3 min-h-[100px]"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">Color</Label>
                        <div className="col-span-3 flex gap-2">
                            {['blue', 'green', 'orange', 'purple'].map((c) => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => setColor(c)}
                                    className={`w-6 h-6 rounded-full border-2 transition-all ${color === c ? 'border-foreground scale-110' : 'border-transparent opacity-70 hover:opacity-100'
                                        }`}
                                    style={{ backgroundColor: `var(--${c}-500, ${c})` }} // Fallback for now if vars aren't set, usually we map to specific tailwind colors
                                />
                            ))}
                        </div>
                    </div>
                </div>
                <DialogFooter className="flex justify-between sm:justify-between">
                    {session.id && (
                        <Button variant="ghost" size="icon" onClick={handleDelete} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    )}
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={onClose}>Cancel</Button>
                        <Button onClick={handleSave}>Save</Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
