import { useState, useEffect, useRef } from "react";
import { PlannedSession } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Trash2, Pencil, X, Calendar as CalendarIcon, Flag, List, Inbox, Clock, Check } from "lucide-react";
import { format } from "date-fns";

import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils";


interface PlanEditorProps {
    isOpen: boolean;
    onClose: () => void;
    session: Partial<PlannedSession> | null;
    onSave: (session: Partial<PlannedSession>) => void;
    onChange?: (session: Partial<PlannedSession>) => void; // Immediate update
    onDelete: (id: string) => void;
    mode?: 'dialog' | 'sidebar' | 'card';
    tags?: string[]; // Available project tags
}

export function PlanEditor({ isOpen, onClose, session, onSave, onChange, onDelete, mode = 'dialog', tags = [] }: PlanEditorProps) {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [duration, setDuration] = useState(60); // minutes
    const [color, setColor] = useState("blue"); // default color
    const [priority, setPriority] = useState<'high' | 'medium' | 'low' | undefined>(undefined);
    const [tag, setTag] = useState<string | undefined>(undefined);
    const [isCompleted, setIsCompleted] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isPriorityOpen, setIsPriorityOpen] = useState(false);
    const [isTagOpen, setIsTagOpen] = useState(false);

    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (session) {
            setTitle(session.title || "");
            setDescription(session.description || "");
            setDuration(session.duration ? Math.round(session.duration / 60) : 60);
            setColor(session.color || "blue");
            setPriority(session.priority);
            setTag(session.tag);
            setIsCompleted(session.isCompleted || false);
            // If it's a new session (no ID), start in edit mode
            setIsEditing(!session.id);
        } else {
            setTitle("");
            setDescription("");
            setDuration(60);
            setColor("blue");
            setPriority(undefined);
            setTag(undefined);
            setIsCompleted(false);
            setIsEditing(true);
        }
    }, [session, isOpen]);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        };
    }, []);

    const handleSave = () => {
        if (!session) return;
        onSave({
            ...session,
            title,
            description,
            duration: duration * 60, // back to seconds
            color,
            priority,
            tag,
            isCompleted
        });
        if (mode === 'dialog') {
            onClose();
        } else {
            setIsEditing(false);
        }
    };

    const toggleCompletion = () => {
        const newStatus = !isCompleted;
        setIsCompleted(newStatus);
        // Immediate save for completion toggle in card mode
        if (session) {
            onSave({
                ...session,
                isCompleted: newStatus
            });
        }
    };

    const handleDelete = () => {
        if (session && session.id) {
            onDelete(session.id);
            onClose();
        }
    };

    // Auto-save helper
    const triggerAutoSave = (updates: Partial<typeof session>) => {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
            if (session) {
                onSave({ ...session, ...updates });
            }
        }, 1000);
    }

    if (!session && mode === 'dialog') return null;
    if (!session && mode !== 'dialog' && !isOpen) return null;

    const renderViewMode = () => (
        <div className={mode === 'card' ? "flex flex-col h-full" : "h-full flex flex-col p-6 space-y-6"}>
            {/* CARD MODE LAYOUT */}
            {mode === 'card' && (
                <>
                    {/* Header: Checkbox | Date | Flag */}
                    <div className="flex items-center justify-between mb-3 text-muted-foreground select-none">
                        <div className="flex items-center gap-3">
                            <div
                                className={`w-5 h-5 rounded flex items-center justify-center cursor-pointer border transition-colors ${isCompleted ? "bg-primary border-primary text-primary-foreground" : "hover:bg-muted/50 border-input"}`}
                                onClick={toggleCompletion}
                            >
                                {isCompleted && <Check className="w-3.5 h-3.5" />}
                            </div>
                            <div className="h-4 w-[1px] bg-border/60"></div>
                            <div className="flex items-center gap-1 text-xs text-blue-500 font-medium">
                                <CalendarIcon className="w-3.5 h-3.5" />
                                <span>
                                    {session?.start && format(new Date(session.start), 'M月 d日')}, {session?.start && format(new Date(session.start), 'a h:mm')} - {session?.start && format(new Date(session.start + (duration * 60 * 1000)), 'a h:mm')}
                                </span>
                            </div>
                        </div>

                        <Popover open={isPriorityOpen} onOpenChange={setIsPriorityOpen}>
                            <PopoverTrigger asChild>
                                <Button variant="ghost" size="icon" className={cn("h-6 w-6", priority ? "text-foreground" : "text-muted-foreground")}>
                                    <Flag className={cn("w-4 h-4",
                                        priority === 'high' && "fill-red-500 text-red-500",
                                        priority === 'medium' && "fill-orange-500 text-orange-500",
                                        priority === 'low' && "fill-blue-500 text-blue-500"
                                    )} />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-40 p-1" align="end">
                                <div className="flex flex-col gap-1">
                                    <Button variant="ghost" size="sm" className="justify-start h-8 font-normal" onClick={() => { setPriority('high'); setIsPriorityOpen(false); triggerAutoSave({ priority: 'high' }); }}>
                                        <Flag className="mr-2 h-4 w-4 fill-red-500 text-red-500" />
                                        High
                                    </Button>
                                    <Button variant="ghost" size="sm" className="justify-start h-8 font-normal" onClick={() => { setPriority('medium'); setIsPriorityOpen(false); triggerAutoSave({ priority: 'medium' }); }}>
                                        <Flag className="mr-2 h-4 w-4 fill-orange-500 text-orange-500" />
                                        Medium
                                    </Button>
                                    <Button variant="ghost" size="sm" className="justify-start h-8 font-normal" onClick={() => { setPriority('low'); setIsPriorityOpen(false); triggerAutoSave({ priority: 'low' }); }}>
                                        <Flag className="mr-2 h-4 w-4 fill-blue-500 text-blue-500" />
                                        Low
                                    </Button>
                                    <Button variant="ghost" size="sm" className="justify-start h-8 font-normal" onClick={() => { setPriority(undefined); setIsPriorityOpen(false); triggerAutoSave({ priority: undefined }); }}>
                                        <X className="mr-2 h-4 w-4" />
                                        None
                                    </Button>
                                </div>
                            </PopoverContent>
                        </Popover>
                    </div>

                    {/* Title & Actions */}
                    <div className="flex items-start justify-between mb-4 select-none">
                        <div className="flex-1 mr-2">
                            <Input
                                className="text-xl font-bold leading-tight px-0 border-none shadow-none focus-visible:ring-0 h-auto p-0"
                                value={title}
                                placeholder="Untitled"
                                onChange={(e) => {
                                    setTitle(e.target.value);
                                    // Immediate update for UI
                                    onChange?.({ ...session, title: e.target.value });
                                    triggerAutoSave({ title: e.target.value });
                                }}
                            />
                        </div>
                        <List className="w-5 h-5 text-muted-foreground hover:text-foreground cursor-pointer" />
                    </div>

                    {/* Content Area (Editable Textarea) */}
                    <div className="flex-1 mb-4 flex flex-col min-h-[100px] overflow-y-auto max-h-[400px]">
                        <textarea
                            ref={(el) => {
                                if (el) {
                                    el.style.height = 'auto'; // Reset
                                    el.style.height = el.scrollHeight + 'px'; // Set to content
                                }
                            }}
                            className="w-full bg-transparent border-none resize-none focus:ring-0 p-0 text-sm leading-relaxed placeholder:text-muted-foreground/50 overflow-hidden text-foreground"
                            placeholder="내용을 입력하거나 메뉴를 위해 '/'를 입력하세요."
                            value={description}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    const cursorPosition = e.currentTarget.selectionStart;
                                    const textBefore = description.substring(0, cursorPosition);
                                    const textAfter = description.substring(cursorPosition);

                                    // Find current line
                                    const lastNewline = textBefore.lastIndexOf('\n');
                                    const currentLine = textBefore.substring(lastNewline + 1);

                                    // Check for checklist pattern "- [ ] " or "- [x] "
                                    const checkboxMatch = currentLine.match(/^(\s*-\s\[[ x]\]\s)(.*)/);
                                    // Check for bullet pattern "- "
                                    const bulletMatch = currentLine.match(/^(\s*-\s)(.*)/);

                                    if (checkboxMatch) {
                                        e.preventDefault();
                                        const prefix = checkboxMatch[1];
                                        const content = checkboxMatch[2];

                                        if (!content.trim()) {
                                            // Empty checklist item -> Break out (remove line)
                                            const newText = textBefore.substring(0, lastNewline + 1) + textAfter;
                                            setDescription(newText);
                                            // Trigger autosave/resize needs to happen after state update, but here we can just update
                                            setTimeout(() => {
                                                const target = e.target as HTMLTextAreaElement;
                                                target.selectionStart = target.selectionEnd = lastNewline + 1;
                                                target.style.height = 'auto';
                                                target.style.height = target.scrollHeight + 'px';
                                                triggerAutoSave({ description: newText });
                                            }, 0);
                                        } else {
                                            // Non-empty -> Add new checkbox line
                                            // Reset checkbox to empty [ ]
                                            const newPrefix = prefix.replace('[x]', '[ ]');
                                            const newText = textBefore + '\n' + newPrefix + textAfter;
                                            setDescription(newText);
                                            setTimeout(() => {
                                                const target = e.target as HTMLTextAreaElement;
                                                target.selectionStart = target.selectionEnd = cursorPosition + 1 + newPrefix.length;
                                                target.style.height = 'auto';
                                                target.style.height = target.scrollHeight + 'px';
                                                onChange?.({ ...session, description: newText });
                                                triggerAutoSave({ description: newText });
                                            }, 0);
                                        }
                                        return;
                                    }

                                    if (bulletMatch) {
                                        e.preventDefault();
                                        const prefix = bulletMatch[1];
                                        const content = bulletMatch[2];

                                        if (!content.trim()) {
                                            // Empty bullet -> Break out
                                            const newText = textBefore.substring(0, lastNewline + 1) + textAfter;
                                            setDescription(newText);
                                            setTimeout(() => {
                                                const target = e.target as HTMLTextAreaElement;
                                                target.selectionStart = target.selectionEnd = lastNewline + 1;
                                                target.style.height = 'auto';
                                                target.style.height = target.scrollHeight + 'px';
                                                triggerAutoSave({ description: newText });
                                            }, 0);
                                        } else {
                                            // Non-empty -> Add new bullet line
                                            const newText = textBefore + '\n' + prefix + textAfter;
                                            setDescription(newText);
                                            setTimeout(() => {
                                                const target = e.target as HTMLTextAreaElement;
                                                target.selectionStart = target.selectionEnd = cursorPosition + 1 + prefix.length;
                                                target.style.height = 'auto';
                                                target.style.height = target.scrollHeight + 'px';
                                                onChange?.({ ...session, description: newText });
                                                triggerAutoSave({ description: newText });
                                            }, 0);
                                        }
                                        return;
                                    }
                                }
                            }}
                            onChange={(e) => {
                                const newDesc = e.target.value;
                                setDescription(newDesc);

                                // Auto-resize
                                e.target.style.height = 'auto';
                                e.target.style.height = e.target.scrollHeight + 'px';

                                onChange?.({ ...session, description: newDesc });
                                triggerAutoSave({ description: newDesc });
                            }}
                        />
                    </div>

                    {/* Footer: Inbox | Icons */}
                    <div className="mt-auto flex items-center justify-between text-muted-foreground pt-2 select-none border-t border-border/40">
                        <Popover open={isTagOpen} onOpenChange={setIsTagOpen}>
                            <PopoverTrigger asChild>
                                <div className="flex items-center gap-2 hover:bg-muted/50 py-1 px-2 -ml-2 rounded-md cursor-pointer transition-colors max-w-[150px]">
                                    <Inbox className="w-4 h-4 shrink-0" />
                                    <span className="text-xs font-medium truncate">{tag || "기본함"}</span>
                                </div>
                            </PopoverTrigger>
                            <PopoverContent className="w-[200px] p-1" align="start">
                                <div className="flex flex-col gap-1 max-h-[300px] overflow-y-auto">
                                    <Button variant="ghost" size="sm" className="justify-start h-8 font-normal" onClick={() => { setTag(undefined); setIsTagOpen(false); triggerAutoSave({ tag: undefined }); }}>
                                        <Inbox className="mr-2 h-4 w-4" />
                                        기본함
                                    </Button>
                                    {tags.map((t) => (
                                        <Button key={t} variant="ghost" size="sm" className="justify-start h-8 font-normal" onClick={() => { setTag(t); setIsTagOpen(false); triggerAutoSave({ tag: t }); }}>
                                            <div className="w-3 h-3 rounded-full bg-primary/20 mr-2" />
                                            {t}
                                        </Button>
                                    ))}
                                    {tags.length === 0 && (
                                        <div className="p-2 text-xs text-muted-foreground text-center">No projects</div>
                                    )}
                                </div>
                            </PopoverContent>
                        </Popover>

                        <div className="flex items-center gap-3">
                            <div className="text-xs text-muted-foreground mr-2 font-mono">{duration}m</div>
                            {/* Color Picker (Mini) */}
                            <div className="flex gap-1">
                                {['blue', 'green', 'orange', 'purple'].map((c) => (
                                    <div
                                        key={c}
                                        onClick={() => { setColor(c); triggerAutoSave({ color: c }); }}
                                        className={`w-3 h-3 rounded-full cursor-pointer transition-transform hover:scale-125 ${color === c ? 'ring-1 ring-offset-1 ring-foreground' : 'opacity-50 hover:opacity-100'}`}
                                        style={{ backgroundColor: `var(--${c}-500, ${c})` }}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* DIALOG/SIDEBAR MODE LAYOUT (Legacy/Fallback) */}
            {mode !== 'card' && (
                <>
                    <div className="flex items-center justify-between mb-4 border-b pb-4">
                        <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full bg-${color}-500`} style={{ backgroundColor: `var(--${color}-500, ${color})` }} />
                            <span className="text-sm font-medium text-muted-foreground">
                                {session?.start ? format(new Date(session.start), 'PPP') : 'New Session'}
                            </span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => setIsEditing(true)} className="h-8 w-8 hover:bg-accent">
                                <span className="sr-only">Edit</span>
                                <Pencil className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 hover:bg-accent">
                                <span className="sr-only">Close</span>
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div>
                            <h2 className="text-2xl font-bold tracking-tight">{title || "Untitled Session"}</h2>
                            <div className="flex items-center gap-2 mt-2 text-muted-foreground">
                                <Clock className="w-4 h-4" />
                                <span>
                                    {session?.start && format(new Date(session.start), 'p')} - {session?.start && format(new Date(session.start + (duration * 60 * 1000)), 'p')}
                                </span>
                                <span className="text-xs bg-muted px-1.5 py-0.5 rounded-md">
                                    {duration}m
                                </span>
                            </div>
                        </div>

                        {description && (
                            <div className="bg-muted/30 p-4 rounded-lg border border-border/40">
                                <p className="whitespace-pre-wrap text-sm leading-relaxed">{description}</p>
                            </div>
                        )}
                    </div>

                    <div className="mt-auto pt-6 flex justify-between border-t border-border/50">
                        {session?.id && (
                            <Button variant="ghost" size="sm" onClick={handleDelete} className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-2">
                                <Trash2 className="w-4 h-4" />
                                Delete
                            </Button>
                        )}
                    </div>
                </>
            )}
        </div>
    );

    const renderEditContent = () => (
        <div className={mode === 'sidebar' ? "h-full flex flex-col p-6 space-y-6 bg-background animate-in slide-in-from-right-4 duration-200" : mode === 'card' ? "flex flex-col gap-3 p-1" : "grid gap-4 py-4"}>
            {(mode === 'sidebar' || mode === 'card') && (
                <div className="flex items-center justify-between mb-1">
                    <h2 className="text-sm font-semibold text-muted-foreground">{session?.id ? "Edit Session" : "Plan Session"}</h2>
                    <div className="flex gap-1">
                        {session?.id && (
                            <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)} className="h-6 text-xs text-muted-foreground px-2">
                                Cancel
                            </Button>
                        )}
                    </div>
                </div>
            )}

            <div className={mode === 'dialog' ? "grid gap-4" : "space-y-3"}>
                <div className={mode === 'dialog' ? "grid grid-cols-4 items-center gap-4" : "flex flex-col gap-1.5"}>
                    <Label htmlFor="title" className={mode === 'dialog' ? "text-right" : "text-xs font-medium"}>
                        Title
                    </Label>
                    <Input
                        id="title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className={mode === 'dialog' ? "col-span-3" : "h-8 text-sm"}
                        placeholder="Focus Task"
                        autoFocus
                    />
                </div>
                <div className={mode === 'dialog' ? "grid grid-cols-4 items-center gap-4 relative" : "flex flex-col gap-1.5 relative"}>
                    <Label htmlFor="duration" className={mode === 'dialog' ? "text-right" : "text-xs font-medium"}>
                        Duration (min)
                    </Label>
                    <div className={mode === 'dialog' ? "col-span-3 relative" : "relative"}>
                        <Input
                            id="duration"
                            type="number"
                            value={duration}
                            onChange={(e) => setDuration(parseInt(e.target.value) || 0)}
                            className="pr-10 h-8 text-sm"
                        />
                        <span className="text-xs text-muted-foreground absolute right-3 top-2">min</span>
                    </div>
                </div>
                <div className={mode === 'dialog' ? "grid grid-cols-4 items-start gap-4" : "flex flex-col gap-1.5"}>
                    <Label htmlFor="desc" className={mode === 'dialog' ? "text-right mt-2" : "text-xs font-medium"}>
                        Notes
                    </Label>
                    <Textarea
                        id="desc"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className={mode === 'dialog' ? "col-span-3 min-h-[100px]" : "min-h-[80px] text-sm"}
                    />
                </div>
                <div className={mode === 'dialog' ? "grid grid-cols-4 items-center gap-4" : "flex flex-col gap-1.5"}>
                    <Label className={mode === 'dialog' ? "text-right" : "text-xs font-medium"}>Color</Label>
                    <div className={mode === 'dialog' ? "col-span-3 flex gap-2" : "flex gap-2"}>
                        {['blue', 'green', 'orange', 'purple'].map((c) => (
                            <button
                                key={c}
                                type="button"
                                onClick={() => setColor(c)}
                                className={`w-6 h-6 rounded-full border-2 transition-all ${color === c ? 'border-foreground scale-110 shadow-sm' : 'border-transparent opacity-70 hover:opacity-100'
                                    }`}
                                style={{ backgroundColor: `var(--${c}-500, ${c})` }}
                            />
                        ))}
                    </div>
                </div>
            </div>

            <div className={mode === 'sidebar' ? "mt-auto pt-6 flex justify-between border-t border-border/50" : mode === 'card' ? "mt-2 pt-3 flex justify-end gap-2 border-t border-border/40" : "hidden"}>
                {mode === 'sidebar' && session?.id && (
                    <Button variant="ghost" size="icon" onClick={handleDelete} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                        <Trash2 className="w-4 h-4" />
                    </Button>
                )}
                <div className="flex gap-2 ml-auto">
                    {(mode === 'sidebar' || mode === 'card') && !session?.id && (
                        <Button variant="outline" size="sm" onClick={onClose} className="h-8">Cancel</Button>
                    )}
                    {mode !== 'sidebar' && mode !== 'card' && (
                        <Button variant="outline" onClick={onClose}>Cancel</Button>
                    )}
                    <Button size="sm" onClick={handleSave} className="h-8">{mode === 'card' ? 'Save Changes' : 'Save'}</Button>
                </div>
            </div>
        </div>
    );

    if (mode === 'sidebar' || mode === 'card') {
        // Card wrapper logic
        if (mode === 'card') {
            return (
                <div className="w-[320px] bg-card text-card-foreground shadow-xl rounded-xl border border-border/50 p-4">
                    {/* For card mode, we ALWAYS use renderViewMode because it contains inline editing now */}
                    {renderViewMode()}
                </div>
            )
        }
        return isEditing ? renderEditContent() : renderViewMode();
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>
                        {session?.id ? "Edit Planned Session" : "Plan Session"}
                    </DialogTitle>
                    <div className="text-xs text-muted-foreground">
                        {session?.start && format(new Date(session.start), 'PPP p')}
                    </div>
                </DialogHeader>
                {renderEditContent()}
                <DialogFooter className="flex justify-between sm:justify-between">
                    {session?.id && (
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


