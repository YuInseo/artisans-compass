import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Play, Clock, CheckCircle2, Check, CornerDownRight, Import, ChevronDown, Briefcase } from "lucide-react";
import { Todo, Session, Project, AppSettings } from "@/types";
import { TimeTableGraph } from "./TimeTableGraph";
import { format } from "date-fns";
import { ScreenshotSlider } from "./ScreenshotSlider";
import { useTodoStore } from "@/hooks/useTodoStore";
import { toast } from "@/lib/toast";
import { TodoEditor } from "./TodoEditor";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
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
    nightTimeStart?: number;
    onDeleteTodo?: (id: string) => void;
    onToggleTodo?: (id: string) => void;
    onUpdateTodoText?: (id: string, text: string) => void;
}

export function DailyArchiveView({ date, todos: initialTodos, projectTodos = {}, projects = [], screenshots: initialScreenshots, sessions, stats, onUpdateTodos, className, timelapseDurationSeconds = 5, showIndentationGuides = true, onClose, hideCloseButton = false, readOnly = false, nightTimeStart: savedNightTimeStart, onDeleteTodo, onToggleTodo, onUpdateTodoText }: DailyArchiveViewProps) {
    const { t } = useTranslation();
    const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
    const { carryOverTodos } = useTodoStore();
    const [isGeneralOpen, setIsGeneralOpen] = useState(false);

    // General Work Logic
    const generalTodos = useMemo(() => {
        return projectTodos['general'] || [];
    }, [projectTodos]);

    const uniqueGeneralTodos = useMemo(() => {
        const seen = new Set();
        return generalTodos.filter(t => {
            if (seen.has(t.id)) return false;
            seen.add(t.id);
            return true;
        });
    }, [generalTodos]);

    const uniqueGeneralCompletion = useMemo(() => {
        if (uniqueGeneralTodos.length === 0) return 0;
        const completed = uniqueGeneralTodos.filter(t => t.completed).length;
        return (completed / uniqueGeneralTodos.length) * 100;
    }, [uniqueGeneralTodos]);

    // Filter todos based on selected project
    const filteredTodos = useMemo(() => {
        if (selectedProjectId === "all" || !projectTodos || Object.keys(projectTodos).length === 0) {
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

            let sourceTodos = initialTodos;
            if (projectTodos && Object.keys(projectTodos).length > 0) {
                const allExceptGeneral = Object.entries(projectTodos)
                    .filter(([pid]) => pid !== 'general')
                    .flatMap(([_, todos]) => todos);
                sourceTodos = allExceptGeneral;
            }

            return cleanFilter(sourceTodos);
        }
        const currentList = projectTodos[selectedProjectId] || [];

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

    const [settings, setSettings] = useState<AppSettings | null>(null);

    // Dynamic Screenshot & Settings Loading
    const [enableSpellCheck, setEnableSpellCheck] = useState(false);
    const [showHint, setShowHint] = useState(() => {
        return localStorage.getItem('hasSeenFetchUncheckedHint') !== 'true';
    });
    const [autoCloseOnFetch, setAutoCloseOnFetch] = useState(() => {
        const stored = localStorage.getItem('autoCloseArchiveOnFetch');
        return stored === null ? true : stored === 'true';
    });
    const [nightTimeStart, setNightTimeStart] = useState<number>(22);

    useEffect(() => {
        if (showHint) {
            const timer = setTimeout(() => {
                setShowHint(false);
                localStorage.setItem('hasSeenFetchUncheckedHint', 'true');
            }, 5000);
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
                const dateStr = format(date, 'yyyy-MM-dd');
                const images = await (window as any).ipcRenderer.invoke('get-daily-screenshots', dateStr);
                setDynamicScreenshots(images);

                const loadedSettings = await (window as any).ipcRenderer.invoke('get-settings');
                if (loadedSettings) {
                    setSettings(loadedSettings);
                    if (typeof loadedSettings.enableSpellCheck === 'boolean') {
                        setEnableSpellCheck(loadedSettings.enableSpellCheck);
                    }
                    // Prioritize saved daily setting, fallback to global setting
                    if (savedNightTimeStart !== undefined) {
                        setNightTimeStart(savedNightTimeStart);
                    } else if (typeof loadedSettings.nightTimeStart === 'number') {
                        setNightTimeStart(loadedSettings.nightTimeStart);
                    }
                }
            }
        };
        loadData();
    }, [date]);

    const handleUpdateSettings = async (newSettings: AppSettings) => {
        if ((window as any).ipcRenderer) {
            await (window as any).ipcRenderer.invoke('save-settings', newSettings);
            setSettings(newSettings);
            // Update local state derived from settings if needed
            if (typeof newSettings.nightTimeStart === 'number') {
                // Only update if not overridden by prop, but here we might want to reflect global change?
                // Actually nightTimeStart prop takes precedence if provided.
                if (savedNightTimeStart === undefined) {
                    setNightTimeStart(newSettings.nightTimeStart);
                }
            }
        }
    };

    useEffect(() => {
        setTodos(filteredTodos);
    }, [filteredTodos]);

    const updateTodoText = (id: string, text: string) => {
        if (onUpdateTodoText) {
            onUpdateTodoText(id, text);
            return;
        }
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
        if (onToggleTodo) {
            onToggleTodo(id);
            return;
        }
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

    const traverseAndModify = (
        items: Todo[],
        id: string,
        action: 'indent' | 'unindent' | 'delete' | 'enter'
    ): Todo[] => {
        const root = JSON.parse(JSON.stringify(items));
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
            }
        } else if (action === 'unindent') {
            const parentContext = parents[parents.length - 1];
            if (parentContext && parentContext.item) {
                const item = list[index];
                list.splice(index, 1);
                const parentIndex = parentContext.list.findIndex(p => p.id === parentContext.item!.id);
                parentContext.list.splice(parentIndex + 1, 0, item);
            }
        }
        return root;
    };

    const handleKeyDown = (e: React.KeyboardEvent, id: string, text: string) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            const action = e.shiftKey ? 'unindent' : 'indent';
            const newTodos = traverseAndModify(todos, id, action);
            setTodos(newTodos);
            onUpdateTodos?.(newTodos);
            setTimeout(() => {
                const el = document.getElementById(`todo-input-${id}`);
                el?.focus();
            }, 0);
        } else if (e.key === 'Backspace' && text === '') {
            e.preventDefault();
            if (onDeleteTodo) {
                onDeleteTodo(id);
            }
        } else if (e.key === 'Delete') {
            // Only delete if explicitly pressed Delete, content doesn't matter or could strictly be if empty?
            // Standard behavior: Delete key anywhere deletes line if empty? Or just deletes char?
            // Let's stick to: if Shift+Delete or just Delete on empty?
            // For safety, let's strictly follow "Backspace on empty" for now as it is standard.
            // But user asked for "Delete". Let's allow Delete key to delete the item if it is empty OR maybe Ctrl+Delete?
            // Let's stick to simple: Delete key deletes item if text is selected or simply if focused?
            // Safest: Delete key behaves like Backspace if empty.
            if (text === '') {
                e.preventDefault();
                if (onDeleteTodo) onDeleteTodo(id);
            }
        }
    };

    const handleFetchUnchecked = async () => {
        // Case 1: Fetch for a specific selected project
        if (selectedProjectId !== "all") {
            const todos = projectTodos[selectedProjectId] || [];
            const filterIncomplete = (list: Todo[]): Todo[] => {
                return list.filter(t => !t.completed && t.text.trim() !== "").map(t => ({
                    ...t,
                    carriedOver: true,
                    children: t.children ? filterIncomplete(t.children) : []
                }));
            };
            const incomplete = filterIncomplete(todos);

            if (incomplete.length > 0) {
                await carryOverTodos(incomplete, selectedProjectId);
                toast.success(t('calendar.fetchedUnchecked'));
            } else {
                toast.info(t('calendar.noUnchecked'));
            }
            return;
        }

        // Case 2: Fetch for ALL projects (Smart Match)
        if (!projectTodos || Object.keys(projectTodos).length === 0) {
            // Fallback for legacy data structure where todos might be flat
            const filterIncomplete = (list: Todo[]): Todo[] => {
                return list.filter(t => !t.completed && t.text.trim() !== "").map(t => ({
                    ...t,
                    carriedOver: true,
                    children: t.children ? filterIncomplete(t.children) : []
                }));
            };
            const incomplete = filterIncomplete(initialTodos);
            if (incomplete.length > 0) {
                // If it's legacy data without project ID, we might put it in general or 'none'
                await carryOverTodos(incomplete, "none");
                toast.success(t('calendar.fetchedUnchecked'));
            } else {
                toast.info(t('calendar.noUnchecked'));
            }
            return;
        }

        let fetchedCount = 0;
        let orphanedCount = 0;
        const currentProjectIds = new Set(projects.map(p => p.id));

        for (const projectId of Object.keys(projectTodos)) {
            // Skip 'general' for now if we want to treat it separately, 
            // but usually we want to fetch general too.
            // However, 'general' is a valid key if we support it.
            // If projectId is 'general', we treat it as valid.

            const isGeneral = projectId === 'general';
            const isValidProject = isGeneral || currentProjectIds.has(projectId);

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
                if (isValidProject) {
                    await carryOverTodos(incomplete, projectId);
                    fetchedCount += incomplete.length;
                } else {
                    orphanedCount += incomplete.length;
                }
            }
        }

        if (fetchedCount > 0) {
            toast.success(t('calendar.fetchedUnchecked'));
        }

        if (orphanedCount > 0) {
            toast.warning(t('notifications.skippedTodos', { count: orphanedCount }), {
                description: t('notifications.deletedProjectsDesc')
            });
        }

        if (fetchedCount === 0 && orphanedCount === 0) {
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
                        "opacity-100"
                    )}
                >
                    {todo.completed && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                </div>

                {!todo.completed && (
                    <div className="absolute -left-3 top-2 text-muted-foreground/40" title={t('calendar.carriedOver')}>
                        <CornerDownRight size={12} />
                    </div>
                )}

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
                        onKeyDown={(e) => handleKeyDown(e, todo.id, todo.text)}
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
            {todo.children && todo.children.length > 0 && (
                <div className="relative">
                    {showIndentationGuides && (
                        <div
                            className="absolute bg-border/40 w-px h-[calc(100%-12px)] top-0"
                            style={{ left: `${(level + 1) * 24 + 7}px` }}
                        />
                    )}
                    {todo.children.map(child => renderTodo(child, level + 1))}
                </div>
            )}
        </div>
    );

    const hasScreenshots = dynamicScreenshots.length > 0;

    return (
        <div className={`h-full select-none ${className}`}>
            <div className="h-full w-full rounded-lg border flex overflow-hidden">
                {hasScreenshots && (
                    <div className="flex-[4] h-full relative min-w-[200px] border-r border-border/20">
                        <div className="h-full min-w-0 p-6 flex flex-col bg-muted/30 relative group/visual justify-center">
                            <div className="absolute top-6 left-6 flex items-center gap-2 z-10">
                                <h3 className="text-sm font-bold text-white/50 flex items-center gap-2 uppercase tracking-wider backdrop-blur-md bg-white/5 px-3 py-1 rounded-full border border-white/10">
                                    <Play className="w-3.5 h-3.5 text-primary" />
                                    {t('calendar.visualRecap')}
                                </h3>
                            </div>

                            <div className="w-full max-w-2xl relative rounded-xl bg-card/50 shadow-2xl p-4 border border-border">
                                <ScreenshotSlider
                                    images={dynamicScreenshots}
                                    durationSeconds={timelapseDurationSeconds}
                                    className="w-full"
                                />
                            </div>
                        </div>
                    </div>
                )}

                <div className={`${hasScreenshots ? 'flex-[4]' : 'flex-[6]'} h-full relative min-w-[300px]`}>
                    <div className={cn(
                        "h-full min-w-0 p-8 flex flex-col bg-muted/30 text-foreground"
                    )}>
                        <div className="flex items-center justify-between mb-1">
                            <h3 className="text-xs font-bold text-zinc-500 flex items-center gap-2 uppercase tracking-widest">
                                {t('calendar.journeyLog')}
                            </h3>

                            <div className="flex items-center gap-2">
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

                                    {showHint && (
                                        <div className="absolute right-full top-1/2 -translate-y-1/2 mr-3 z-50 animate-in fade-in slide-in-from-right-2 duration-500 pointer-events-none">
                                            <div className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap relative">
                                                {t('calendar.fetchUncheckedDesc')}
                                                <div className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-0 h-0 border-y-[6px] border-y-transparent border-l-[8px] border-l-primary" />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {projects.length > 0 && (
                                    <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                                        <SelectTrigger className="w-[160px] h-7 text-xs bg-muted border-border text-foreground">
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

                        {/* General Work Floating Panel */}
                        <div className={cn(
                            "absolute bottom-6 z-30 pointer-events-auto transition-all duration-300 ease-in-out",
                            isGeneralOpen ? "left-6 right-6" : "left-6"
                        )}>
                            {/* Collapsed State: FAB Button */}
                            {!isGeneralOpen && (
                                <div className="animate-in fade-in zoom-in duration-300">
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-14 w-14 rounded-full shadow-xl bg-card/80 backdrop-blur-md border border-border/50 hover:scale-105 transition-all group"
                                        onClick={() => {
                                            if (uniqueGeneralTodos.length > 0) {
                                                setIsGeneralOpen(true);
                                            } else {
                                                toast.info(t('dashboard.noGeneralWork') || "진행된 일반 작업이 없습니다.");
                                            }
                                        }}
                                    >
                                        <div className="relative">
                                            <Briefcase className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
                                            {uniqueGeneralTodos.filter(t => !t.completed).length > 0 && (
                                                <span className="sr-only">
                                                    {uniqueGeneralTodos.filter(t => !t.completed).length} uncompleted items
                                                </span>
                                            )}
                                        </div>
                                    </Button>
                                </div>
                            )}

                            {/* Expanded State: Full Panel */}
                            {isGeneralOpen && (
                                <div className="bg-card/95 backdrop-blur-md shadow-2xl border border-border/50 rounded-xl overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-300 flex flex-col max-h-[500px]">
                                    {/* Header */}
                                    <div
                                        className="flex items-center gap-2 p-3 cursor-pointer select-none transition-colors hover:bg-muted/30 border-b border-border/40"
                                        onClick={() => setIsGeneralOpen(false)}
                                    >
                                        <div className={cn(
                                            "p-1.5 rounded-full transition-colors flex items-center justify-center text-primary bg-primary/10"
                                        )}>
                                            <ChevronDown className="w-4 h-4" />
                                        </div>

                                        <div className="flex items-center gap-2 flex-1">
                                            <Briefcase className="w-4 h-4 text-primary" />
                                            <span className="text-sm font-semibold text-foreground">
                                                {t('dashboard.generalWork') || "일반 작업"}
                                            </span>
                                            {uniqueGeneralTodos.filter(t => !t.completed).length > 0 && (
                                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-medium text-primary">
                                                    {uniqueGeneralTodos.filter(t => !t.completed).length}
                                                </span>
                                            )}
                                        </div>

                                        {/* Mini Progress Bar */}
                                        <div className="w-24 h-1.5 bg-muted/50 rounded-full overflow-hidden mr-1">
                                            <div className="h-full bg-primary/60 transition-all duration-500" style={{ width: `${uniqueGeneralCompletion}%` }} />
                                        </div>
                                    </div>

                                    {/* Content */}
                                    <div className="overflow-y-auto custom-scrollbar bg-background/50 flex-1 min-h-0">
                                        <div className="p-2 pl-1">
                                            <TodoEditor
                                                key="general-archive-section"
                                                todos={uniqueGeneralTodos}
                                                isWidgetMode={false}
                                                isWidgetLocked={readOnly}
                                                actions={{
                                                    addTodo: (text, parentId, afterId) => {
                                                        if (!readOnly && (window as any).ipcRenderer) return useTodoStore.getState().addTodo(text, parentId, afterId, 'general');
                                                        return "";
                                                    },
                                                    updateTodo: (id, updates) => { if (!readOnly) useTodoStore.getState().updateTodo(id, updates, false, 'general'); },
                                                    deleteTodo: (id) => { if (!readOnly) useTodoStore.getState().deleteTodo(id, 'general'); },
                                                    deleteTodos: (ids) => { if (!readOnly) useTodoStore.getState().deleteTodos(ids, 'general'); },

                                                    indentTodo: (id) => { if (!readOnly) useTodoStore.getState().indentTodo(id, 'general'); },
                                                    unindentTodo: (id) => { if (!readOnly) useTodoStore.getState().unindentTodo(id, 'general'); },
                                                    moveTodo: (id, pid, idx) => { if (!readOnly) useTodoStore.getState().moveTodo(id, pid, idx, 'general'); },
                                                    moveTodos: (ids, pid, idx) => { if (!readOnly) useTodoStore.getState().moveTodos(ids, pid, idx, 'general'); },
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                    </div>
                </div>

                <div className={`${hasScreenshots ? 'flex-[3]' : 'flex-[4]'} h-full relative min-w-[200px]`}>
                    <div className={cn(
                        "h-full min-w-0 p-0 flex flex-col bg-card overflow-hidden"
                    )}>
                        <div className="p-4 bg-card border-b border-border flex justify-between items-center shrink-0">
                            <h3 className="text-sm font-bold text-foreground flex items-center gap-2 uppercase tracking-wider">
                                <Clock className="w-4 h-4 text-blue-500" />
                                {t('dashboard.timeTable')}
                            </h3>
                        </div>

                        <div className="flex-1 overflow-hidden relative">
                            <TimeTableGraph
                                sessions={sessions}
                                date={date}
                                projects={projects}
                                nightTimeStart={nightTimeStart}
                                settings={settings}
                                onUpdateSettings={handleUpdateSettings}
                            />
                        </div>

                        <div className="p-4 pt-2 flex flex-col gap-3 bg-card shrink-0 pb-6 border-t border-border mt-auto">
                            {!hideCloseButton && onClose && (
                                <button
                                    onClick={onClose}
                                    className="w-full py-3 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary font-bold text-sm transition-colors uppercase tracking-wider border border-primary/20"
                                >
                                    {t('calendar.closeArchive')}
                                </button>
                            )}

                            {stats.questAchieved && (
                                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 flex items-center justify-start gap-2 shadow-sm">
                                    <CheckCircle2 className="w-5 h-5 text-green-600 fill-green-100 dark:text-green-400 dark:fill-green-900" />
                                    <span className="text-sm font-extrabold text-green-700 dark:text-green-400 tracking-wide">{t('calendar.questClear')}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
