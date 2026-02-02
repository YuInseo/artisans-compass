import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Play, Clock, CheckCircle2, Check, CornerDownRight, Import } from "lucide-react";
import { Todo, Session, Project } from "@/types";
import { TimeTableGraph } from "./TimeTableGraph";
import { format } from "date-fns";
import { ScreenshotSlider } from "./ScreenshotSlider";
import { useTodoStore } from "@/hooks/useTodoStore";
import { toast } from "sonner";
// import { ArchiveBlockNote } from "./ArchiveBlockNote";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuCheckboxItem,
    ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Button } from "@/components/ui/button";

interface DailyArchiveViewProps {
    date: Date;
    todos: Todo[];
    projectTodos?: Record<string, Todo[]>;
    projects?: Project[];
    screenshots: string[];
    sessions: Session[];
    stats: {
        totalSeconds: number;
        questAchieved: boolean;
    };
    onUpdateTodos?: (todos: Todo[]) => void;
    className?: string;
    timelapseDurationSeconds?: number;
    showIndentationGuides?: boolean;
    onClose?: () => void;
    hideCloseButton?: boolean;
    readOnly?: boolean;
}

import { useTranslation } from "react-i18next";

export function DailyArchiveView({ date, todos: initialTodos, projectTodos = {}, projects = [], screenshots: initialScreenshots, sessions, stats, onUpdateTodos, className, timelapseDurationSeconds = 5, showIndentationGuides = true, onClose, hideCloseButton = false, readOnly = false }: DailyArchiveViewProps) {
    const { t } = useTranslation();
    const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
    const { carryOverTodos } = useTodoStore();

    // Filter todos based on selected project
    const filteredTodos = useMemo(() => {
        if (selectedProjectId === "all" || !projectTodos || Object.keys(projectTodos).length === 0) {
            // Apply clean filter to initialTodos as well if it's the fallback
            const cleanFilter = (list: Todo[]): Todo[] => {
                return list.filter(item => {
                    const hasText = item.text && item.text.trim().length > 0;
                    const hasChildren = item.children && item.children.length > 0;

                    if (hasChildren) {
                        item.children = cleanFilter(item.children || []);
                        const childrenHaveContent = item.children.length > 0;
                        return hasText || childrenHaveContent;
                    }
                    return hasText;
                }).map(item => ({
                    ...item,
                    children: item.children ? cleanFilter(item.children) : []
                }));
            };
            return cleanFilter(initialTodos);
        }
        const currentList = projectTodos[selectedProjectId] || [];

        // Filter out empty todos (and no children) for cleaner Archive view
        const cleanFilter = (list: Todo[]): Todo[] => {
            return list.map(item => ({
                ...item,
                children: item.children ? cleanFilter(item.children) : []
            })).filter(item => {
                const hasText = item.text && item.text.trim().length > 0;
                const hasChildren = item.children && item.children.length > 0;
                return hasText || hasChildren;
            });
        };

        return cleanFilter(currentList);
    }, [selectedProjectId, projectTodos, initialTodos]);

    const [todos, setTodos] = useState<Todo[]>(filteredTodos);
    const [dynamicScreenshots, setDynamicScreenshots] = useState<string[]>(initialScreenshots);

    // Dynamic Screenshot & Settings Loading
    const [enableSpellCheck, setEnableSpellCheck] = useState(false);
    const [showHint, setShowHint] = useState(() => {
        return localStorage.getItem('hasSeenFetchUncheckedHint') !== 'true';
    });
    const [autoCloseOnFetch, setAutoCloseOnFetch] = useState(() => {
        // Default to true as requested, but respect user preference if set
        const stored = localStorage.getItem('autoCloseArchiveOnFetch');
        return stored === null ? true : stored === 'true';
    });
    const [nightTimeStart, setNightTimeStart] = useState<number>(22);

    useEffect(() => {
        if (showHint) {
            const timer = setTimeout(() => {
                setShowHint(false);
                localStorage.setItem('hasSeenFetchUncheckedHint', 'true');
            }, 5000); // Auto hide after 5s
            return () => clearTimeout(timer);
        }
    }, [showHint]);

    const toggleAutoClose = (checked: boolean) => {
        setAutoCloseOnFetch(checked);
        localStorage.setItem('autoCloseArchiveOnFetch', String(checked));
    };

    useEffect(() => {
        const loadData = async () => {
            if ((window as any).ipcRenderer) {
                // Screenshots
                const dateStr = format(date, 'yyyy-MM-dd');
                const images = await (window as any).ipcRenderer.invoke('get-daily-screenshots', dateStr);
                setDynamicScreenshots(images);

                // Settings
                const settings = await (window as any).ipcRenderer.invoke('get-settings');
                if (settings && typeof settings.enableSpellCheck === 'boolean') {
                    setEnableSpellCheck(settings.enableSpellCheck);
                }
                if (settings && typeof settings.nightTimeStart === 'number') {
                    setNightTimeStart(settings.nightTimeStart);
                }
            }
        };
        loadData();
    }, [date]);

    // Sync filteredTodos to state when project selection or data changes
    useEffect(() => {
        setTodos(filteredTodos);
    }, [filteredTodos]);

    // Recalculate stats from sessions to ensure consistency with TimeTableGraph


    // Todo Logic
    const updateTodoText = (id: string, text: string) => {
        const newTodos = JSON.parse(JSON.stringify(todos));
        const updateRecursive = (list: Todo[]) => {
            for (const item of list) {
                if (item.id === id) {
                    item.text = text;
                    return true;
                }
                if (item.children && updateRecursive(item.children)) return true;
            }
            return false;
        };
        updateRecursive(newTodos);
        setTodos(newTodos);
        onUpdateTodos?.(newTodos);
    };

    const toggleTodo = (id: string) => {
        const newTodos = JSON.parse(JSON.stringify(todos));
        const toggleRecursive = (list: Todo[]) => {
            for (const item of list) {
                if (item.id === id) {
                    item.completed = !item.completed;
                    return true;
                }
                if (item.children && toggleRecursive(item.children)) return true;
            }
            return false;
        };
        toggleRecursive(newTodos);
        setTodos(newTodos);
        onUpdateTodos?.(newTodos);
    };

    // Full traversal with parent pointers is easier
    const traverseAndModify = (
        items: Todo[],
        id: string,
        action: 'indent' | 'unindent' | 'delete' | 'enter'
    ): Todo[] => {
        // This is tricky to do immutably deep down without a path.
        // Let's use mutable draft copy.
        const root = JSON.parse(JSON.stringify(items));

        // Helper to find parent array and index
        const find = (list: Todo[], targetId: string, parents: { list: Todo[], item: Todo | null }[] = []): { list: Todo[], index: number, parents: { list: Todo[], item: Todo | null }[] } | null => {
            for (let i = 0; i < list.length; i++) {
                if (list[i].id === targetId) return { list, index: i, parents };
                if (list[i].children) {
                    const res = find(list[i].children!, targetId, [...parents, { list, item: list[i] }]);
                    if (res) return res;
                }
            }
            return null;
        };

        const found = find(root, id);
        if (!found) return root;

        const { list, index, parents } = found;

        if (action === 'indent') {
            if (index > 0) {
                const prevSibling = list[index - 1];
                const item = list[index];
                list.splice(index, 1);
                prevSibling.children = prevSibling.children || [];
                prevSibling.children.push(item);
                // Expand checked?
            }
        } else if (action === 'unindent') {
            const parentContext = parents[parents.length - 1];
            if (parentContext && parentContext.item) {
                // We are in children of parentContext.item
                // parentContext.list is the list containing the parent.
                const item = list[index];
                list.splice(index, 1); // Remove from current parent

                // Find parent's index in grandparent list
                const parentIndex = parentContext.list.findIndex(p => p.id === parentContext.item!.id);
                parentContext.list.splice(parentIndex + 1, 0, item);
            }
        }

        return root;
    };


    const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            const action = e.shiftKey ? 'unindent' : 'indent';
            const newTodos = traverseAndModify(todos, id, action);
            setTodos(newTodos);
            onUpdateTodos?.(newTodos);
            // Need to maintain focus? React re-render might lose focus if keys change or DOM thrashes.
            // Using `key={todo.id}` helps.
            // But we need to insure `autoFocus` logic or ref.
            // For now, let's rely on manual focus recovery or hope React keeps it (it usually does if key persists).
            setTimeout(() => {
                const el = document.getElementById(`todo-input-${id}`);
                el?.focus();
            }, 0);
        }
    };

    const handleFetchUnchecked = async () => {
        if (!projectTodos || Object.keys(projectTodos).length === 0) {
            // Fallback for flat todo list
            const filterIncomplete = (list: Todo[]): Todo[] => {
                return list.filter(t => !t.completed && t.text.trim() !== "").map(t => ({
                    ...t,
                    carriedOver: true,
                    children: t.children ? filterIncomplete(t.children) : []
                }));
            };
            const incomplete = filterIncomplete(initialTodos);
            if (incomplete.length > 0) {
                await carryOverTodos(incomplete, "none");
                toast.success(t('calendar.fetchedUnchecked'));
            } else {
                toast.info(t('calendar.noUnchecked'));
            }
            return;
        }

        let hasFetched = false;
        for (const projectId of Object.keys(projectTodos)) {
            const todos = projectTodos[projectId];
            const filterIncomplete = (list: Todo[]): Todo[] => {
                return list.filter(t => !t.completed && t.text.trim() !== "").map(t => ({
                    ...t,
                    carriedOver: true,
                    children: t.children ? filterIncomplete(t.children) : []
                }));
            };
            const incomplete = filterIncomplete(todos);
            if (incomplete.length > 0) {
                await carryOverTodos(incomplete, projectId);
                hasFetched = true;
            }
        }

        if (hasFetched) {
            toast.success(t('calendar.fetchedUnchecked'));
        } else {
            toast.info(t('calendar.noUnchecked'));
        }
    };

    const handleFetchClick = async () => {
        setShowHint(false);
        localStorage.setItem('hasSeenFetchUncheckedHint', 'true');
        await handleFetchUnchecked();

        if (autoCloseOnFetch && onClose) {
            onClose();
        }
    };

    const renderTodo = (todo: Todo, level = 0) => (
        <div key={todo.id} className="mb-px relative">
            <div className={`flex items-start gap-2 py-1 group ${level > 0 ? 'ml-6' : ''}`}>
                {/* Checkbox */}
                <div
                    onClick={() => !readOnly && toggleTodo(todo.id)}
                    className={cn(
                        "mt-1.5 w-4 h-4 rounded-[4px] border flex items-center justify-center shrink-0 transition-all duration-300 select-none",
                        readOnly ? "cursor-default" : "cursor-pointer",
                        todo.completed
                            ? "bg-primary border-primary"
                            : cn(
                                "border-muted-foreground/30 bg-transparent",
                                !readOnly && "hover:border-primary/50 hover:bg-primary/5"
                            ),
                        "opacity-100" // Always visible now
                    )}
                >
                    {todo.completed && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                </div>

                {/* Incomplete / Carried Over Indicator (Visualize as carried over to next day) */}
                {!todo.completed && (
                    <div className="absolute -left-3 top-2 text-muted-foreground/40" title={t('calendar.carriedOver')}>
                        <CornerDownRight size={12} />
                    </div>
                )}

                {/* Input Text */}
                {readOnly ? (
                    <span className={cn(
                        "w-full p-0 text-sm leading-relaxed rounded px-1 transition-colors cursor-default",
                        todo.completed ? "text-muted-foreground line-through" : "text-foreground"
                    )}>
                        {todo.text}
                    </span>
                ) : (
                    <input
                        id={`todo-input-${todo.id}`}
                        value={todo.text}
                        onChange={(e) => updateTodoText(todo.id, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, todo.id)}
                        className={cn(
                            "bg-transparent border-none outline-none w-full p-0 text-sm leading-relaxed rounded px-1 transition-colors focus:bg-accent/50 focus:text-foreground",
                            todo.completed ? "text-muted-foreground line-through" : "text-foreground placeholder:text-muted-foreground/50"
                        )}
                        placeholder="Type a focus..."
                        autoComplete="off"
                        spellCheck={enableSpellCheck}
                    />
                )}
            </div>
            {/* Children with Indentation Guide */}
            {todo.children && todo.children.length > 0 && (
                <div className="relative">
                    {showIndentationGuides && (
                        <div
                            className="absolute bg-border/40 w-px h-[calc(100%-12px)] top-0"
                            style={{ left: `${(level + 1) * 24 + 7}px` }} // Calculated to align with checkbox center of children
                        />
                    )}
                    {todo.children.map(child => renderTodo(child, level + 1))}
                </div>
            )}
        </div>
    );

    const hasScreenshots = dynamicScreenshots.length > 0;

    return (
        <div className={`h-full flex divide-x divide-border select-none ${className}`}>
            {/* Column 1: Visual (Timelapse) - Flex 5 (Left) - Conditional */}
            {hasScreenshots && (
                <div className="flex-[5] min-w-0 p-6 flex flex-col bg-muted/30 relative group/visual justify-center">
                    <div className="absolute top-6 left-6 flex items-center gap-2 z-10">
                        <h3 className="text-sm font-bold text-white/50 flex items-center gap-2 uppercase tracking-wider backdrop-blur-md bg-white/5 px-3 py-1 rounded-full border border-white/10">
                            <Play className="w-3.5 h-3.5 text-primary" />
                            {t('calendar.visualRecap')}
                        </h3>
                    </div>

                    <div className="w-full aspect-video max-h-[80%] relative rounded-xl overflow-hidden border border-white/10 bg-zinc-900/50 shadow-2xl">
                        <ScreenshotSlider
                            images={dynamicScreenshots}
                            durationSeconds={timelapseDurationSeconds}
                            className="w-full h-full object-contain"
                        />
                    </div>
                </div>
            )}

            {/* Column 2: Today's Focus/Journey Archive - Flex 4 or grow */}
            <div className={cn(
                "min-w-0 p-8 flex flex-col bg-muted/30 text-foreground border-l border-border/50",
                hasScreenshots ? "flex-[4]" : "flex-[6]" // Take more space if no visual
            )}>
                <div className="flex items-center justify-between mb-1">
                    <h3 className="text-xs font-bold text-zinc-500 flex items-center gap-2 uppercase tracking-widest">
                        {t('calendar.journeyLog')}
                    </h3>

                    <div className="flex items-center gap-2">
                        {/* Fetch Unchecked Button - Icon Only with Hint */}
                        <div className="relative">
                            <ContextMenu>
                                <ContextMenuTrigger>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary border border-primary/20 rounded-full transition-all hover:scale-105 active:scale-95"
                                        onClick={handleFetchClick}
                                    >
                                        <Import size={14} strokeWidth={2.5} />
                                    </Button>
                                </ContextMenuTrigger>
                                <ContextMenuContent>
                                    <ContextMenuCheckboxItem
                                        checked={autoCloseOnFetch}
                                        onCheckedChange={toggleAutoClose}
                                    >
                                        {t('calendar.autoCloseOnFetch') || "Auto-close"}
                                    </ContextMenuCheckboxItem>
                                </ContextMenuContent>
                            </ContextMenu>

                            {/* Speech Bubble Hint */}
                            {showHint && (
                                <div className="absolute right-full top-1/2 -translate-y-1/2 mr-3 z-50 animate-in fade-in slide-in-from-right-2 duration-500 pointer-events-none">
                                    <div className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap relative">
                                        {t('calendar.fetchUncheckedDesc')}
                                        {/* Triangle Arrow */}
                                        <div className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-0 h-0 border-y-[6px] border-y-transparent border-l-[8px] border-l-primary" />
                                    </div>
                                </div>
                            )}
                        </div>
                        {/* Actually, let's just use ContextMenu properly if available, or just a small gear? 
                           Left Click: Fetch
                           Right Click: Options
                        */}

                        {/* Project Selector */}
                        {projects.length > 0 && (
                            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                                <SelectTrigger className="w-[160px] h-7 text-xs bg-zinc-800 border-zinc-700 text-zinc-300">
                                    <SelectValue placeholder={t('sidebar.allProjects')} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">{t('sidebar.allProjects')}</SelectItem>
                                    {projects.map(p => (
                                        <SelectItem key={p.id} value={p.id}>
                                            <span className="flex items-center gap-2">
                                                <span className={`w-2 h-2 rounded-full`} style={{ backgroundColor: p.color || '#3b82f6' }} />
                                                {p.name}
                                            </span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>
                </div>
                <div className="text-3xl font-bold text-foreground mb-8 tracking-tight">
                    {format(date, 'MMM dd, yyyy')}
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-1 relative">
                    {todos.length > 0 ? (
                        <div className="bn-container">
                            <div className="flex flex-col gap-1">
                                {todos.map(t => renderTodo(t))}
                            </div>
                        </div>
                    ) : (
                        <div className="text-zinc-600 text-sm italic mt-10 text-center">
                            {t('calendar.noActivity')}
                        </div>
                    )}
                </div>
            </div>

            {/* Column 3: Time Table (Vertical) - Flex 3 or 4 */}
            <div className={cn(
                "min-w-0 p-0 flex flex-col bg-card overflow-hidden border-l border-border",
                hasScreenshots ? "flex-[3]" : "flex-[4]"
            )}>
                {/* Header */}
                <div className="p-4 bg-card border-b border-border flex justify-between items-center shrink-0">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2 uppercase tracking-wider">
                        <Clock className="w-4 h-4 text-blue-500" />
                        {t('dashboard.timeTable')}
                    </h3>
                </div>

                <div className="flex-1 overflow-hidden relative">
                    <TimeTableGraph sessions={sessions} date={date} projects={projects} nightTimeStart={nightTimeStart} />
                </div>

                {/* Footer Stack: Stats */}
                <div className="p-4 pt-2 flex flex-col gap-3 bg-card shrink-0 pb-6 border-t border-border mt-auto">



                    {/* Close Button Attached Below */}
                    {!hideCloseButton && onClose && (
                        <button
                            onClick={onClose}
                            className="w-full py-3 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary font-bold text-sm transition-colors uppercase tracking-wider border border-primary/20"
                        >
                            {t('calendar.closeArchive')}
                        </button>
                    )}

                    {/* Quest Clear */}
                    {stats.questAchieved && (
                        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 flex items-center justify-start gap-2 shadow-sm">
                            <CheckCircle2 className="w-5 h-5 text-green-600 fill-green-100 dark:text-green-400 dark:fill-green-900" />
                            <span className="text-sm font-extrabold text-green-700 dark:text-green-400 tracking-wide">{t('calendar.questClear')}</span>
                        </div>
                    )}
                </div>
            </div>
        </div >
    );
}
