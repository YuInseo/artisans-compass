import { TimeTableGraph } from "./TimeTableGraph";
import { Session, Todo, Project } from "@/types";
import { ChevronRight, Sparkles, Ghost, Lock, Unlock, Plus, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEffect, useState, useMemo, useRef } from "react";
import { format } from "date-fns";
import { useTodoStore } from "@/hooks/useTodoStore";
import { useDataStore } from "@/hooks/useDataStore";
import { useTheme } from "@/components/theme-provider";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

import "@blocknote/core/fonts/inter.css";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import "@blocknote/shadcn/style.css";
import { todosToBlocks, blocksToTodos, customSchema } from "@/utils/blocknote-utils";


interface DailyPanelProps {
    onEndDay: (todos: Todo[], screenshots: string[]) => void;
    projects?: Project[];
}

export function DailyPanel({ onEndDay, projects = [] }: DailyPanelProps) {
    // Use Store
    const {
        projectTodos,
        activeProjectId,
        setActiveProjectId,
        setTodos,
        loadTodos
    } = useTodoStore();
    const todos = useMemo(() => projectTodos[activeProjectId] || [], [projectTodos, activeProjectId]);

    const { settings, isWidgetMode, setWidgetMode, saveSettings } = useDataStore();
    const [isWidgetLocked, setIsWidgetLocked] = useState(false);
    const [isPinned, setIsPinned] = useState(false);
    const { theme, setTheme } = useTheme();
    const headerRef = useRef<HTMLDivElement>(null);
    const editorContentRef = useRef<HTMLDivElement>(null);



    // Dynamic Widget Height Logic
    useEffect(() => {
        if (!isWidgetMode || !headerRef.current || !editorContentRef.current || !(window as any).ipcRenderer) return;

        const calculateAndResize = () => {
            const headerHeight = headerRef.current?.offsetHeight || 0;
            const contentHeight = editorContentRef.current?.offsetHeight || 0;
            // Add padding (pt-4 + pb-4 = 32px roughly from parent container)
            // Parent div (line 192) has py-4 (16+16=32).
            const totalHeight = headerHeight + contentHeight + 40;

            const maxHeight = settings?.widgetMaxHeight || 800;
            const finalHeight = Math.min(totalHeight, maxHeight);

            (window as any).ipcRenderer.send('resize-widget', { width: 435, height: finalHeight });
        };

        const observer = new ResizeObserver(() => {
            // Debounce or just run? Run is fine.
            calculateAndResize();
        });

        observer.observe(headerRef.current);
        observer.observe(editorContentRef.current);

        return () => observer.disconnect();
    }, [isWidgetMode, todos, settings?.widgetMaxHeight]);

    const togglePin = async () => {
        const newState = !isPinned;
        setIsPinned(newState);
        setWidgetMode(newState);
        await (window as any).ipcRenderer.send('set-widget-mode', newState);
    }

    const [sessions, setSessions] = useState<Session[]>([]);
    const [screenshots, setScreenshots] = useState<string[]>([]);
    const [isConfirmingEnd, setIsConfirmingEnd] = useState(false);

    // --- IPC & Initial Load ---
    const [liveSession, setLiveSession] = useState<Session | null>(null);

    // Initial blocks from store (memoized to prevent re-init)
    const initialBlocks = useMemo(() => {
        if (todos.length > 0) {
            return todosToBlocks(todos);
        }
        return [{
            type: "checkListItem",
            content: ""
        }];
    }, []); // Only on mount/first load logic? 
    // We rely on `loadTodos` having run or store being hydrated.

    const editor = useCreateBlockNote({
        initialContent: initialBlocks as any,
        schema: customSchema,
    });

    // Native Event Listener for Key Handling (Fixes Enter/Backspace issues + Widget Locking)
    useEffect(() => {
        const container = editorContentRef.current;
        if (!container) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            // Priority 1: Widget Locking
            if (isWidgetMode && isWidgetLocked) {
                if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key)) return;
                if ((e.metaKey || e.ctrlKey) && e.key === 'c') return;

                e.preventDefault();
                e.stopPropagation();
                return;
            }

            // Priority 2: Force Checkbox Behavior
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
                        // editor.focus(); // Ensure focus remains
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

        // Also handle Paste/Cut for locking
        const handleCutPaste = (e: ClipboardEvent) => {
            if (isWidgetMode && isWidgetLocked) {
                e.preventDefault();
                e.stopPropagation();
            }
        }

        container.addEventListener("keydown", handleKeyDown, { capture: true });
        container.addEventListener("paste", handleCutPaste, { capture: true });
        container.addEventListener("cut", handleCutPaste, { capture: true });

        return () => {
            container.removeEventListener("keydown", handleKeyDown, { capture: true });
            container.removeEventListener("paste", handleCutPaste, { capture: true });
            container.removeEventListener("cut", handleCutPaste, { capture: true });
        };
    }, [editor, isWidgetMode, isWidgetLocked]);

    // Sync Editor when Project Changes
    useEffect(() => {
        // Basic check to see if we really need to update blocks?
        // Actually, preventing loop is key.
        // We only want to replace if the content is DIFFERENT from what editor has.
        // But converting blocks->todos->blocks is lossy/complex comparison.
        // Simplest: If activeProjectId changed, definitely replace.
        // But we need to track if this effect run is due to project change.

        const newBlocks = todos.length > 0 ? todosToBlocks(todos) : [{ type: "checkListItem", content: "" }];

        // We replace blocks. This might trigger onChange, but we can verify.
        // To be safe, we can clear and insert.
        editor.replaceBlocks(editor.document, newBlocks as any);

    }, [activeProjectId]); // Dependencies: Only when Project ID changes (and we access latest 'todos' via closure/render cycle) 
    // Wait, if 'todos' is computed from projectTodos, we might need to be careful.
    // Actually, we want to run this ONLY when activeProjectId changes. 
    // So 'todos' in the body is correct, but dependency array should handle the trigger.
    // React hooks warning might ask for 'todos', but that causes the loop.
    // We can use a ref to track 'lastProjectId'.

    const lastProjectId = useRef(activeProjectId);
    useEffect(() => {
        if (lastProjectId.current !== activeProjectId) {
            const newBlocks = todos.length > 0 ? todosToBlocks(todos) : [{ type: "checkListItem", content: "" }];
            editor.replaceBlocks(editor.document, newBlocks as any);
            lastProjectId.current = activeProjectId;
        }
    }, [activeProjectId, todos, editor]); // Including todos is risky if keys update. 
    // But with the Ref check, we only execute on ID change.

    // Use effect to handle initial load timing if store wasn't ready
    useEffect(() => {
        // HYDRATION FIX: If todos load later (async), populate the editor if it's currently empty.
        // This prevents the "Disappearing Todos" bug.
        const currentBlocks = editor.document;
        // @ts-ignore
        const isEditorEmpty = currentBlocks.length === 0 || (currentBlocks.length === 1 && (!currentBlocks[0].content || currentBlocks[0].content.length === 0));

        if (todos.length > 0 && isEditorEmpty) {
            const blocks = todosToBlocks(todos);
            // @ts-ignore
            editor.replaceBlocks(editor.document, blocks);
        }
    }, [todos, editor]);

    useEffect(() => {
        // Sync Editor changes to Store
        const unsubscribe = editor.onChange(() => {
            const blocks = editor.document as any; // Cast to any to avoid strict schema type mismatch with persistence helper
            const newTodos = blocksToTodos(blocks);
            // We avoid infinite loop by check? 
            // store.setTodos saves to persistence. 
            // We pass false to `shouldSave`? No, we want to save.
            setTodos(newTodos, true);
        });
        return unsubscribe;
    }, [editor, setTodos]);

    useEffect(() => {
        loadTodos();

        if ((window as any).ipcRenderer) {
            const loadSessionData = async () => {
                const now = new Date();
                const yearMonth = format(now, 'yyyy-MM');
                const dateStr = format(now, 'yyyy-MM-dd');
                const logs = await (window as any).ipcRenderer.getMonthlyLog(yearMonth);
                if (logs && logs[dateStr]) {
                    if (logs[dateStr].sessions) setSessions(logs[dateStr].sessions);
                    if (logs[dateStr].screenshots) setScreenshots(logs[dateStr].screenshots);

                    // Optional: If logs have todos, maybe we should sync them to editor if editor is empty?
                }
            };
            loadSessionData();

            const removeListener = (window as any).ipcRenderer.onTrackingUpdate((data: any) => {
                if (data.currentSession) {
                    setLiveSession(data.currentSession);
                } else {
                    setLiveSession(null);
                    const refreshSessions = async () => {
                        const now = new Date();
                        const yearMonth = format(now, 'yyyy-MM');
                        const dateStr = format(now, 'yyyy-MM-dd');
                        const logs = await (window as any).ipcRenderer.getMonthlyLog(yearMonth);
                        if (logs && logs[dateStr]) {
                            if (logs[dateStr].sessions) setSessions(logs[dateStr].sessions);
                            if (logs[dateStr].screenshots) setScreenshots(logs[dateStr].screenshots);
                        }
                    };
                    refreshSessions();
                }
            });

            return () => {
                removeListener();
            };
        }
    }, [loadTodos]);

    // Handle "Add Root Task" manually if needed, or just let user type.
    const handleAddRoot = () => {
        editor.insertBlocks(
            [{ type: "checkListItem", content: "" }],
            editor.document[editor.document.length - 1],
            "after"
        );
        editor.focus();
    };


    return (
        <div
            className="h-full w-full flex flex-row overflow-hidden text-foreground font-sans transition-colors duration-300"
            style={{
                backgroundColor: isWidgetMode
                    ? `hsl(var(--card) / ${settings?.widgetOpacity ?? 0.95})`
                    : `hsl(var(--card))`
            }}
        >
            {/* Split Content */}
            <div className="flex-1 flex px-6 pb-4 pt-4 overflow-hidden gap-6">
                {/* Left Panel: Focus List */}
                <div
                    className={cn("flex flex-col overflow-hidden relative transition-all duration-300 min-w-[300px]", isWidgetMode ? "w-full" : "flex-1")}
                >
                    {/* Header Wrapper for Measure */}
                    <div ref={headerRef} className="shrink-0">
                        {isWidgetMode && (
                            <>
                                <div className="h-9 bg-muted/80 border-b border-border flex items-center justify-between px-2 select-none mb-2 backdrop-blur-sm" style={{ WebkitAppRegion: 'drag' } as any}>
                                    <div className="flex items-center gap-2">
                                        <Sparkles className="w-3.5 h-3.5 text-primary/70" />
                                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Focus Widget</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 text-muted-foreground hover:text-foreground no-drag"
                                            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                                            title="Toggle Theme"
                                            style={{ WebkitAppRegion: 'no-drag' } as any}
                                        >
                                            {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                                        </Button>

                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 text-muted-foreground hover:text-foreground no-drag"
                                                    style={{ WebkitAppRegion: 'no-drag' } as any}
                                                    title="Transparency"
                                                >
                                                    <Ghost className="w-3.5 h-3.5" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-60 p-4" side="bottom" align="end">
                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <h4 className="font-medium leading-none text-sm">Transparency</h4>
                                                        <span className="text-xs text-muted-foreground">{Math.round((settings?.widgetOpacity || 1) * 100)}%</span>
                                                    </div>
                                                    <Slider
                                                        min={0.2}
                                                        max={1.0}
                                                        step={0.05}
                                                        value={[settings?.widgetOpacity ?? 0.95]}
                                                        onValueChange={(val) => {
                                                            const newOpacity = val[0];
                                                            if (settings) {
                                                                saveSettings({ ...settings, widgetOpacity: newOpacity });
                                                            }
                                                        }}
                                                    />
                                                </div>
                                            </PopoverContent>
                                        </Popover>

                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 text-muted-foreground hover:text-foreground no-drag"
                                            onClick={() => setIsWidgetLocked(!isWidgetLocked)}
                                            title={isWidgetLocked ? "Unlock Widget" : "Lock Widget (Checkboxes Only)"}
                                            style={{ WebkitAppRegion: 'no-drag' } as any}
                                        >
                                            {isWidgetLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                                        </Button>

                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 text-muted-foreground hover:text-foreground no-drag"
                                            onClick={togglePin}
                                            title="Unpin (Restore Full View)"
                                            style={{ WebkitAppRegion: 'no-drag' } as any}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-pin-off"><line x1="2" x2="22" y1="2" y2="22" /><line x1="12" x2="12" y1="17" y2="22" /><path d="M9 9v1.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16h14v-.76a2 2 0 0 0-.25-.95" /><path d="M15 9.34V6h1a2 2 0 0 0 0-4H7.89" /></svg>
                                        </Button>
                                    </div>
                                </div>

                                {/* Custom Widget Header Content */}
                                {settings?.widgetDisplayMode === 'quote' && (
                                    <div className="mb-4 px-1 animate-in fade-in slide-in-from-top-2">
                                        <div className="p-3 bg-muted/30 border border-border/50 rounded-lg text-center">
                                            <p className="text-sm font-medium font-serif italic text-muted-foreground whitespace-pre-line leading-relaxed">
                                                "{[
                                                    "창의성은 실수를 허용하는 것이다. 예술은 어떤 것을 지킬지 아는 것이다.",
                                                    "영감은 존재하지만, 일하는 중에 찾아온다.",
                                                    "완벽함을 두려워하지 마라. 당신은 절대 도달할 수 없을 테니까.",
                                                    "모든 아이는 예술가다. 문제는 어른이 되어서도 예술가로 남을 수 있느냐다.",
                                                    "예술은 보이는 것을 재현하는 것이 아니라, 보이게 만드는 것이다.",
                                                    "단순함은 궁극의 정교함이다.",
                                                    "그림은 일기를 쓰는 또 다른 방법일 뿐이다.",
                                                    "재능은 소금과 같다. 빵을 만들 때 소금만으로는 빵이 되지 않지만, 소금 없이는 맛이 나지 않는다.",
                                                    "어제보다 나은 그림을 그리는 것이 유일한 목표다.",
                                                    "선의 끝은 없다. 단지 멈출 뿐이다."
                                                ][new Date().getDate() % 10]}"
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {settings?.widgetDisplayMode === 'goals' && (
                                    <div className="mb-4 px-1 grid grid-cols-2 gap-2 animate-in fade-in slide-in-from-top-2">
                                        <div className="p-2 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                                            <div className="text-[10px] font-bold text-blue-600/70 uppercase tracking-wider mb-0.5">Monthly</div>
                                            <div className="text-xs font-medium truncate" title={settings.focusGoals?.monthly}>{settings.focusGoals?.monthly || "No Goal"}</div>
                                        </div>
                                        <div className="p-2 bg-green-500/5 border border-green-500/20 rounded-lg">
                                            <div className="text-[10px] font-bold text-green-600/70 uppercase tracking-wider mb-0.5">Weekly</div>
                                            <div className="text-xs font-medium truncate" title={settings.focusGoals?.weekly}>{settings.focusGoals?.weekly || "No Goal"}</div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {!isWidgetMode && (
                            <div className="flex items-end justify-between mb-6 px-1 shrink-0">
                                <div className="flex items-center gap-2">
                                    <div>
                                        <h2 className="text-2xl font-bold text-foreground font-serif tracking-tight cursor-pointer hover:text-muted-foreground transition-colors flex items-center gap-2">
                                            Today's Focus
                                        </h2>
                                        <p className="text-sm text-muted-foreground font-medium mt-1">{format(new Date(), 'MMM dd, yyyy')}</p>
                                    </div>
                                </div>

                                {/* Controls: Project Dropdown + Pin */}
                                <div className="flex items-center gap-3">
                                    {/* Project Dropdown */}
                                    <div className="relative" style={{ WebkitAppRegion: 'no-drag' } as any}>
                                        <Select value={activeProjectId} onValueChange={setActiveProjectId}>
                                            <SelectTrigger className="w-[180px]">
                                                <SelectValue placeholder="Select Project" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">No Project</SelectItem>
                                                {projects.length > 0 ? projects.map(p => (
                                                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                                )) : (
                                                    <div className="p-2 text-sm text-muted-foreground italic">No projects</div>
                                                )}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Pin Button (Only show if NOT in widget mode) */}
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className={cn("h-9 w-9 transition-all", isPinned ? "text-primary bg-primary/10 rotate-45" : "text-muted-foreground hover:text-foreground")}
                                        onClick={togglePin}
                                        title={isPinned ? "Unpin (Exit Widget Mode)" : "Pin to Top (Widget Mode)"}
                                    >
                                        <span className="sr-only">Pin</span>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-pin"><line x1="12" x2="12" y1="17" y2="22" /><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" /></svg>
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div> {/* End Header Wrapper */}

                    {/* Editor Area (Scrollable) */}
                    <div className={cn(
                        "relative pr-2 custom-scrollbar",
                        isWidgetMode ? "flex-1 overflow-y-auto pb-6" : "flex-1 overflow-y-auto pb-20"
                    )}>
                        {/* Content Wrapper for Measure & Lock Logic */}
                        <div
                            ref={editorContentRef}
                        // Native listener attached via ref below handles keys better than React events here
                        >
                            <BlockNoteView
                                editor={editor}
                                theme={theme === 'dark' ? 'dark' : 'light'}
                                className={cn("daily-focus-theme", isWidgetMode ? "min-h-[50px]" : "min-h-[200px]")}
                                slashMenu={false}
                                formattingToolbar={false}
                                onChange={() => {
                                    // FORCE CHECKBOX MODE:
                                    // Only convert paragraph to checkbox if it has content.
                                    // This allows "Backspace to delete" flow (which goes Checkbox -> Empty Paragraph -> Delete).
                                    const selection = editor.getTextCursorPosition();
                                    if (selection && selection.block.type === "paragraph") {
                                        const text = Array.isArray(selection.block.content)
                                            ? selection.block.content.map(c => c.type === 'text' ? c.text : '').join('')
                                            : '';

                                        if (text.length > 0) {
                                            editor.updateBlock(selection.block, {
                                                type: "checkListItem",
                                                props: { checked: false }
                                            });
                                        }
                                    }

                                    // Sync Editor changes to Store
                                    const blocks = editor.document as any;
                                    const newTodos = blocksToTodos(blocks);
                                    setTodos(newTodos, true);
                                }}
                            />

                            {/* Optional: Add button if empty */}
                            {editor.document.length === 0 && (
                                <Button
                                    variant="ghost"
                                    className="w-full mt-2 text-muted-foreground border-dashed border"
                                    onClick={handleAddRoot}
                                >
                                    <Plus className="w-4 h-4 mr-2" /> Add First Task
                                </Button>
                            )}
                        </div> {/* End Content Wrapper */}
                    </div>

                    {/* End Day Button */}
                    {!isWidgetMode && (
                        <div className="absolute bottom-6 right-6 z-10">
                            {isConfirmingEnd ? (
                                <div className="flex items-center gap-2 bg-popover p-2 rounded-lg shadow-lg border border-border animate-in fade-in slide-in-from-right-4">
                                    <span className="text-xs font-medium text-foreground whitespace-nowrap px-2">End Day?</span>
                                    <Button onClick={() => setIsConfirmingEnd(false)} variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground">No</Button>
                                    <Button onClick={async () => {
                                        if ((window as any).ipcRenderer) {
                                            const now = new Date();
                                            const yearMonth = format(now, 'yyyy-MM');
                                            const dateStr = format(now, 'yyyy-MM-dd');
                                            const logs = await (window as any).ipcRenderer.getMonthlyLog(yearMonth);
                                            if (logs && logs[dateStr]) {
                                                if (logs[dateStr].screenshots) setScreenshots(logs[dateStr].screenshots);
                                                onEndDay(logs[dateStr].todos || todos, logs[dateStr].screenshots || []);
                                            } else {
                                                onEndDay(todos, screenshots);
                                            }
                                        } else {
                                            onEndDay(todos, screenshots);
                                        }
                                    }} size="sm" className="bg-red-500 hover:bg-red-600 text-white h-7 text-xs">Yes</Button>
                                </div>
                            ) : (
                                <Button
                                    onClick={() => setIsConfirmingEnd(true)}
                                    className="rounded-full shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground px-6 h-12 font-bold transition-all hover:scale-105 active:scale-95"
                                >
                                    End Day <ChevronRight className="w-4 h-4 ml-1" />
                                </Button>
                            )}
                        </div>
                    )}
                </div>

                {/* Right Panel: TimeTable */}
                {
                    !isWidgetMode && (
                        <div className="hidden lg:flex w-[320px] flex-col shrink-0 h-full animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="flex items-end justify-between mb-6 px-1 shrink-0">
                                <div>
                                    <h2 className="text-2xl font-bold text-foreground font-serif tracking-tight">Time Table</h2>
                                    <p className="text-sm text-transparent font-medium mt-1 select-none">.</p>
                                </div>
                            </div>
                            <div className="flex-1 border border-border rounded-xl bg-muted/10 overflow-hidden shadow-sm">
                                <TimeTableGraph
                                    sessions={liveSession ? [...sessions, liveSession] : sessions}
                                    date={new Date()}
                                />
                            </div>

                            {liveSession && (
                                <div className="mt-4 p-4 border border-blue-500/30 bg-blue-500/5 rounded-xl shadow-sm animate-in fade-in slide-in-from-bottom-2">
                                    <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1 flex items-center gap-2">
                                        <span className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                                        </span>
                                        Working on...
                                    </div>
                                    <div className="text-lg font-bold text-foreground truncate" title={liveSession.process}>
                                        {liveSession.process}
                                    </div>
                                    <div className="text-2xl font-mono font-medium text-blue-600 dark:text-blue-400 mt-1">
                                        {(() => {
                                            const s = liveSession.duration;
                                            const h = Math.floor(s / 3600);
                                            const m = Math.floor((s % 3600) / 60);
                                            const sec = s % 60;
                                            return `${h > 0 ? `${h}h ` : ''}${m}m ${sec} s`;
                                        })()}
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                }

            </div>
        </div>
    );
}
