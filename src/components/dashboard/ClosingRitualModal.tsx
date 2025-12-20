import { useState, useEffect, useMemo, useRef } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

import { ArrowRight, ArrowLeft, Moon, ListTodo, Sparkles, LogOut } from "lucide-react";
import { Todo, Project } from "@/types";
import { DailyArchiveView } from "./DailyArchiveView";

import { useTodoStore } from "@/hooks/useTodoStore";
// BlockNote Imports
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import { todosToBlocks, blocksToTodos, customSchema } from "@/utils/blocknote-utils";
import "@blocknote/shadcn/style.css"; // Ensure styles are imported if not globally available, though they might be safely duped or already global

interface ClosingRitualModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentStats: any;
    onSaveLog: (log: string) => void;
    screenshots?: string[];
    sessions?: any[];
    projects?: Project[];
}

// --- BlockNote Components for Modal ---

interface BlueprintEditorProps {
    initialTodos: Todo[];
    onChange: (todos: Todo[]) => void;
    projectId: string; // Used for keying blocknote instance
}

function BlueprintEditor({ initialTodos, onChange }: BlueprintEditorProps) {
    const initialBlocks = useMemo(() => {
        if (initialTodos.length > 0) {
            return todosToBlocks(initialTodos);
        }
        return [{
            type: "checkListItem",
            content: ""
        }];
    }, [initialTodos]); // Only rely on initialTodos when mounting? No, we might switch projects.

    // Key to force re-creation of editor when projectId changes, ensuring clean slate/initialization
    // actually, useCreateBlockNote handles updates? typically no, it inits once.
    // So we should key the component.
    const editor = useCreateBlockNote({
        initialContent: initialBlocks as any,
        schema: customSchema,
    });

    useEffect(() => {
        // Debounce? BlockNote usually fine.
        const unsubscribe = editor.onChange(() => {
            const blocks = editor.document as any;
            const newTodos = blocksToTodos(blocks);
            onChange(newTodos);
        });
        return unsubscribe;
    }, [editor, onChange]);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            // DEBUG
            // console.log("Native Key:", e.key);

            // Manual Navigation Override (Fix for "Up arrow not working")
            if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                const selection = editor.getTextCursorPosition();
                if (selection) {
                    // Helper to flatten blocks including children
                    const getFlatBlocks = (blocks: any[]): any[] => {
                        let flat: any[] = [];
                        for (const b of blocks) {
                            flat.push(b);
                            if (b.children && b.children.length > 0) {
                                flat = flat.concat(getFlatBlocks(b.children));
                            }
                        }
                        return flat;
                    };

                    const flat = getFlatBlocks(editor.document);
                    const idx = flat.findIndex(b => b.id === selection.block.id);

                    if (e.key === "ArrowUp" && idx > 0) {
                        e.preventDefault();
                        e.stopPropagation();
                        // Focus previous block at end
                        editor.setTextCursorPosition(flat[idx - 1], 'end');
                    } else if (e.key === "ArrowDown" && idx < flat.length - 1) {
                        e.preventDefault();
                        e.stopPropagation();
                        // Focus next block at start
                        editor.setTextCursorPosition(flat[idx + 1], 'start');
                    }
                }
                // If not found or at edge, let default happen (though default might be broken for Up)
            }

            if (e.key === "Enter" && !e.shiftKey) {
                const selection = editor.getTextCursorPosition();
                if (selection && selection.block.type === "checkListItem") {
                    const text = Array.isArray(selection.block.content)
                        ? selection.block.content.map(c => c.type === 'text' ? c.text : '').join('')
                        : '';

                    if (text === "") {
                        e.preventDefault();
                        e.stopPropagation();
                        editor.insertBlocks(
                            [{ type: "checkListItem", props: { checked: false } }],
                            selection.block,
                            "after"
                        );
                        // Cursor usually moves to next block automatically with insertBlocks "after" if active
                    }
                }
            }
            if (e.key === "Backspace") {
                const selection = editor.getTextCursorPosition();
                if (selection && selection.block.type === "checkListItem") {
                    const text = Array.isArray(selection.block.content)
                        ? selection.block.content.map(c => c.type === 'text' ? c.text : '').join('')
                        : '';

                    if (text === "") {
                        e.preventDefault();
                        e.stopPropagation();

                        // Smart Deletion: Un-nest children if they exist
                        if (selection.block.children.length > 0) {
                            editor.insertBlocks(selection.block.children as any, selection.block, "after");
                        }

                        editor.removeBlocks([selection.block]);
                    }
                }
            }
        };

        // Capture phase is crucial here to beat BlockNote/Prosemirror
        container.addEventListener("keydown", handleKeyDown, { capture: true });
        return () => container.removeEventListener("keydown", handleKeyDown, { capture: true });
    }, [editor]);

    return (
        <div ref={containerRef}>
            <BlockNoteView
                editor={editor}
                theme="light" // CSS overrides handle it
                className="min-h-[300px] p-4 rounded-md"
                slashMenu={false}
                formattingToolbar={false}
                onChange={() => {
                    // Schema handles defaults now
                }}
            />
        </div>
    );
}

// --- Leftover Render Helper ---
const LeftoverList = ({ todos, depth = 0, movedIds, onMove }: { todos: Todo[], depth?: number, movedIds: Set<string>, onMove: (t: Todo) => void }) => {
    return (
        <div className="flex flex-col gap-1">
            {todos.map(t => {
                if (movedIds.has(t.id)) return null;
                return (
                    <div key={t.id} className="flex flex-col">
                        <div
                            onClick={() => onMove(t)}
                            className={`
                                group flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer 
                                hover:bg-accent/50 transition-colors select-none
                                border border-transparent hover:border-border/50
                            `}
                            style={{ marginLeft: depth * 16 }}
                        >
                            <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 group-hover:bg-primary transition-colors" />
                            <span className="text-sm text-foreground/80 group-hover:text-foreground truncate flex-1">
                                {t.text || "Untitled"}
                            </span>
                            <ArrowRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity -ml-2 group-hover:ml-0" />
                        </div>
                        {t.children && t.children.length > 0 && (
                            <LeftoverList todos={t.children} depth={depth + 1} movedIds={movedIds} onMove={onMove} />
                        )}
                    </div>
                );
            })}
        </div>
    );
};


export function ClosingRitualModal({ isOpen, onClose, currentStats, onSaveLog, screenshots = [], sessions = [], projects = [] }: ClosingRitualModalProps) {
    const { projectTodos, activeProjectId } = useTodoStore();
    const [step, setStep] = useState<1 | 2>(1);

    const [tomorrowPlans, setTomorrowPlans] = useState<Record<string, Todo[]>>({});

    const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
    const [isSaving, setIsSaving] = useState(false);
    const [materialChecked, setMaterialChecked] = useState(true);


    const [movedIds, setMovedIds] = useState<Set<string>>(new Set());
    const [editorVersion, setEditorVersion] = useState(0);

    const todayTodos = useMemo(() => {
        if (selectedProjectId === 'all') {
            return Object.values(projectTodos).flat();
        }
        return projectTodos[selectedProjectId] || [];
    }, [projectTodos, selectedProjectId]);

    // Initialize/Reset state
    useEffect(() => {
        if (isOpen) {
            console.log("Opening Ritual Modal");
            setStep(1);
            setTomorrowPlans({});
            // Default to active project if valid, otherwise first project or all
            if (activeProjectId && activeProjectId !== 'none' && projects.find(p => p.id === activeProjectId)) {
                setSelectedProjectId(activeProjectId);
            } else {
                setSelectedProjectId(projects.length > 0 ? projects[0].id : "all");
            }

            setIsSaving(false);
            setMaterialChecked(true);
            setMovedIds(new Set());
            setEditorVersion(0);
        }
    }, [isOpen, activeProjectId, projects]);

    // Ensure selectedProjectId is valid
    useEffect(() => {
        if (projects.length > 0 && !projects.find(p => p.id === selectedProjectId) && selectedProjectId !== 'all') {
            setSelectedProjectId(projects[0].id);
        }
    }, [projects, selectedProjectId]);

    const handleNext = () => {
        console.log("Advancing to Plan step");
        setStep(2);
    };
    const handleBack = () => setStep(1);

    // Serialization for Save
    const handleFinish = async () => {
        setIsSaving(true);
        await new Promise(r => setTimeout(r, 800)); // Visual delay

        let finalLog = "";

        // Helper to serialize a tree of todos to markdown
        const serializeTodos = (todos: Todo[], depth = 0): string => {
            return todos.map(t => {
                const indent = "    ".repeat(depth);
                const status = t.completed ? "[x]" : "[ ]";
                let line = `${indent}- ${status} ${t.text}`;
                if (t.children && t.children.length > 0) {
                    line += "\n" + serializeTodos(t.children, depth + 1);
                }
                return line;
            }).join("\n");
        };

        // Create the log content
        // 1. Today's Achievements (Focus Points)
        const completedTasks = todayTodos.filter(t => t.completed);
        if (completedTasks.length > 0) {
            finalLog += `## Focus Points\n${serializeTodos(completedTasks)}\n\n`;
        } else {
            finalLog += `## Focus Points\n(No tasks completed)\n\n`;
        }

        // 2. Tomorrow's Blueprint
        finalLog += `## Tomorrow's Blueprint\n`;
        projects.forEach(p => {
            const planList = tomorrowPlans[p.id];
            if (planList && planList.length > 0) {
                finalLog += `### ${p.name}\n${serializeTodos(planList)}\n\n`;
            }
        });
        const miscPlan = tomorrowPlans['all'];
        if (miscPlan && miscPlan.length > 0) {
            finalLog += `### Miscellaneous\n${serializeTodos(miscPlan)}\n`;
        }

        onSaveLog(finalLog);

        if ((window as any).ipcRenderer) {
            try {
                (window as any).ipcRenderer.send('quit-app');
            } catch (e) {
                console.log("Quit app signal sent");
            }
        }
        onClose();
    };



    // --- Actions for Right Panel ---
    // (Most handling is now internal to BlockNote, we just sync state)

    // Sync Handler for Blueprint
    const handleBlueprintChange = (todos: Todo[]) => {
        setTomorrowPlans(prev => ({
            ...prev,
            [selectedProjectId]: todos
        }));
    };

    // --- Move Handler ---
    const handleMoveLeftover = (todo: Todo) => {
        // Add to Right Panel (Tomorrow Plans)
        setTomorrowPlans(prev => {
            const currentList = prev[selectedProjectId] || [];
            // Clone the todo
            const clone = JSON.parse(JSON.stringify(todo));
            return {
                ...prev,
                [selectedProjectId]: [...currentList, clone]
            };
        });

        // Mark as moved (Hide from Left)
        setMovedIds(prev => {
            const next = new Set(prev);
            next.add(todo.id);
            return next;
        });

        // Force Right Panel refresh
        setEditorVersion(v => v + 1);
    };

    // Derived Logic
    const currentProjectName = projects.find(p => p.id === selectedProjectId)?.name || "All Projects";

    const filteredLeftovers = useMemo(() => {
        return todayTodos.filter(t => !t.completed);
    }, [todayTodos]);

    // --- Render ---

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent hideCloseButton className="sm:max-w-[1200px] bg-card border-border shadow-2xl rounded-2xl overflow-hidden p-0 gap-0 w-full h-[90vh] flex flex-col font-sans">
                {/* Header */}
                <div className="bg-muted/30 text-foreground px-8 py-4 flex items-center justify-between shrink-0 h-16 border-b border-border/50">
                    <div className="flex items-center gap-3">
                        <div className="bg-primary/10 p-1.5 rounded-lg border border-primary/20">
                            <Moon className="w-4 h-4 text-primary" />
                        </div>
                        <DialogTitle className="text-lg font-medium tracking-tight text-foreground">
                            Plan & Prepare
                        </DialogTitle>
                        <DialogDescription className="sr-only">End of Day Ritual Review and Planning</DialogDescription>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 bg-background/50 overflow-hidden relative flex flex-col">
                    {/* Step 1: Review */}
                    {step === 1 && (
                        <div className="h-full animate-in fade-in slide-in-from-right-8 duration-500">
                            <DailyArchiveView
                                date={new Date()}
                                todos={todayTodos}
                                screenshots={screenshots}
                                sessions={sessions}
                                stats={currentStats}
                                hideCloseButton={true}
                            />
                        </div>
                    )}

                    {/* Step 2: Plan & Prepare (2-Column Layout) */}
                    {step === 2 && (
                        <div className="h-full flex flex-col animate-in fade-in slide-in-from-right-8 duration-500 bg-background">
                            {/* Toolbar / Project Selector */}
                            <div className="px-8 py-3 bg-card border-b border-border flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <span className="text-sm font-medium text-muted-foreground">Planning Context:</span>
                                    <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                                        <SelectTrigger className="w-[240px] h-9">
                                            <SelectValue placeholder="Select Project" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {projects.map(p => (
                                                <SelectItem key={p.id} value={p.id}>
                                                    <span className="flex items-center gap-2">
                                                        <span className={`w-2 h-2 rounded-full ${p.type === 'Main' ? 'bg-blue-500' : 'bg-green-500'}`} />
                                                        {p.name}
                                                    </span>
                                                </SelectItem>
                                            ))}
                                            <SelectItem value="all">
                                                <span className="flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-slate-500" />
                                                    Miscellaneous
                                                </span>
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <span className="text-xs text-muted-foreground">
                                    Organize tomorrow's tasks for <span className="font-semibold text-primary">{currentProjectName}</span>
                                </span>
                            </div>

                            <div className="flex-1 flex overflow-hidden">
                                {/* Left Column: Leftovers (Interactive List) */}
                                <div className="w-1/3 border-r border-border bg-muted/10 flex flex-col min-w-[300px]">
                                    <div className="px-6 py-4 border-b border-border/50">
                                        <h3 className="text-xs font-bold text-muted-foreground flex items-center gap-2 uppercase tracking-wider">
                                            <ListTodo className="w-3 h-3" />
                                            Today's Leftovers
                                        </h3>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                                        {filteredLeftovers.length === 0 ? (
                                            <div className="text-center py-10 text-muted-foreground text-sm">
                                                <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                                All done! Nothing to carry over.
                                            </div>
                                        ) : (
                                            <div className="opacity-100">
                                                <LeftoverList todos={filteredLeftovers} movedIds={movedIds} onMove={handleMoveLeftover} />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Right Column: Blueprint (Active BlockNote) */}
                                <div className="flex-1 flex flex-col bg-card">
                                    <div className="px-6 py-4 border-b border-border/50">
                                        <h3 className="text-xs font-bold text-muted-foreground flex items-center gap-2 uppercase tracking-wider">
                                            <Sparkles className="w-3 h-3" />
                                            Tomorrow's Blueprint
                                        </h3>
                                    </div>

                                    <div className="flex-1 overflow-y-auto p-0 custom-scrollbar relative">
                                        <div className="p-4 min-h-full">
                                            <BlueprintEditor
                                                key={`${selectedProjectId}-${editorVersion}`}
                                                initialTodos={tomorrowPlans[selectedProjectId] || []}
                                                onChange={handleBlueprintChange}
                                                projectId={selectedProjectId}
                                            />
                                        </div>
                                    </div>


                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-8 bg-card border-t border-border flex justify-between shrink-0 items-center h-20">
                    {step === 1 ? (
                        <>
                            <div />
                            <Button onClick={handleNext} className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl px-10 h-12 text-base font-semibold shadow-lg hover:shadow-xl transition-all">
                                Review Plans <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button onClick={handleBack} variant="ghost" className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl px-6 h-12 text-sm font-medium transition-all">
                                <ArrowLeft className="w-4 h-4 mr-2" /> Daily Archive
                            </Button>
                            <Button
                                onClick={handleFinish}
                                disabled={isSaving || !materialChecked}
                                className={`rounded-xl px-10 h-12 text-base font-semibold shadow-lg hover:shadow-xl transition-all ${!materialChecked ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 text-white shadow-green-200'}`}
                            >
                                {isSaving ? "Closing..." : "Commit Daily Ritual"} <LogOut className="w-4 h-4 ml-2" />
                            </Button>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
