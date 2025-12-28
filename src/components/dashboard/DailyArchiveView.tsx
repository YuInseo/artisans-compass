import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Play, Clock, CheckCircle2, Check } from "lucide-react";
import { Todo, Session, Project } from "@/types";
import { TimeTableGraph } from "./TimeTableGraph";
import { format } from "date-fns";
import { ScreenshotSlider } from "./ScreenshotSlider";
import { ArchiveBlockNote } from "./ArchiveBlockNote";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

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
    checkboxVisibility?: 'high' | 'low';
    onClose?: () => void;
    hideCloseButton?: boolean;
}

import { useTranslation } from "react-i18next";

export function DailyArchiveView({ date, todos: initialTodos, projectTodos = {}, projects = [], screenshots: initialScreenshots, sessions, stats, onUpdateTodos, className, timelapseDurationSeconds = 5, checkboxVisibility = 'high', onClose, hideCloseButton = false }: DailyArchiveViewProps) {
    const { t } = useTranslation();
    const [selectedProjectId, setSelectedProjectId] = useState<string>("all");

    // Filter todos based on selected project
    const filteredTodos = useMemo(() => {
        if (selectedProjectId === "all" || !projectTodos || Object.keys(projectTodos).length === 0) {
            return initialTodos;
        }
        return projectTodos[selectedProjectId] || [];
    }, [selectedProjectId, projectTodos, initialTodos]);

    const [todos, setTodos] = useState<Todo[]>(filteredTodos);
    const [dynamicScreenshots, setDynamicScreenshots] = useState<string[]>(initialScreenshots);

    // Sync filteredTodos to state when project selection or data changes
    useEffect(() => {
        setTodos(filteredTodos);
    }, [filteredTodos]);

    // Dynamic Screenshot Loading
    useEffect(() => {
        const fetchScreenshots = async () => {
            if ((window as any).ipcRenderer) {
                const dateStr = format(date, 'yyyy-MM-dd');
                const images = await (window as any).ipcRenderer.invoke('get-daily-screenshots', dateStr);
                setDynamicScreenshots(images);
            }
        };
        fetchScreenshots();
    }, [date]);

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        return `${h}h ${m}m`;
    };

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

    const renderTodo = (todo: Todo, level = 0) => (
        <div key={todo.id} className="mb-px"> {/* Reduced margin */}
            <div className={`flex items-start gap-2 py-1 group ${level > 0 ? 'ml-6' : ''}`}>
                {/* Checkbox */}
                <div
                    onClick={() => toggleTodo(todo.id)}
                    className={cn(
                        "mt-1.5 w-4 h-4 rounded-[4px] border flex items-center justify-center shrink-0 transition-all duration-300 cursor-pointer select-none",
                        todo.completed
                            ? "bg-blue-600 border-blue-600"
                            : cn(
                                checkboxVisibility === 'high'
                                    ? "border-zinc-500 bg-zinc-800 hover:border-zinc-400 hover:bg-zinc-700"
                                    : "border-zinc-700 bg-zinc-800 hover:border-zinc-500"
                            ),
                        checkboxVisibility === 'low' && !todo.completed ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'
                    )}
                >
                    {todo.completed && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                </div>

                {/* Input Text */}
                <input
                    id={`todo-input-${todo.id}`}
                    value={todo.text}
                    onChange={(e) => updateTodoText(todo.id, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, todo.id)}
                    className={`bg-transparent border-none outline-none w-full p-0 text-sm leading-relaxed focus:bg-white/5 rounded px-1 transition-colors
                        ${todo.completed ? 'text-zinc-500 line-through' : 'text-zinc-200 focus:text-white'}`}
                    placeholder="Type a focus..."
                    autoComplete="off"
                />
            </div>
            {/* Children */}
            {todo.children?.map(child => renderTodo(child, level + 1))}
        </div>
    );

    const hasScreenshots = dynamicScreenshots.length > 0;

    return (
        <div className={`h-full flex divide-x divide-border ${className}`}>
            {/* Column 1: Visual (Timelapse) - Flex 5 (Left) - Conditional */}
            {hasScreenshots && (
                <div className="flex-[5] min-w-0 p-6 flex flex-col bg-[#09090b] relative group/visual justify-center">
                    <div className="absolute top-6 left-6 flex items-center gap-2 z-10">
                        <h3 className="text-sm font-bold text-white/50 flex items-center gap-2 uppercase tracking-wider backdrop-blur-md bg-black/30 px-3 py-1 rounded-full border border-white/10">
                            <Play className="w-3.5 h-3.5 text-primary" />
                            {t('calendar.visualRecap')}
                        </h3>
                    </div>

                    <div className="w-full aspect-video max-h-[80%] relative rounded-xl overflow-hidden border border-white/10 bg-black shadow-2xl">
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
                "min-w-0 p-8 flex flex-col bg-[#121212] text-white border-l border-white/5",
                hasScreenshots ? "flex-[4]" : "flex-[6]" // Take more space if no visual
            )}>
                <div className="flex items-center justify-between mb-1">
                    <h3 className="text-xs font-bold text-zinc-500 flex items-center gap-2 uppercase tracking-widest">
                        {t('calendar.journeyLog')}
                    </h3>
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
                <div className="text-3xl font-bold text-white mb-8 tracking-tight">
                    {format(date, 'MMM dd, yyyy')}
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-1 relative"
                    style={{
                        // Ensure variables align with the dark container
                        "--foreground": "0 0% 95%",
                        "--muted-foreground": "0 0% 65%",
                    } as React.CSSProperties}
                >
                    {todos.length > 0 ? (
                        <div className="bn-container">
                            {/* Read-Only Editor for Journey Log */}
                            <ArchiveBlockNote todos={todos} />
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
                    <TimeTableGraph sessions={sessions} date={date} />
                </div>

                {/* Footer Stack: Stats */}
                <div className="p-4 pt-2 flex flex-col gap-3 bg-card shrink-0 pb-6 border-t border-border mt-auto">
                    {/* Total Work */}
                    <div className="bg-muted border border-border rounded-2xl p-4 flex flex-col items-center justify-center shadow-sm">
                        <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mb-1">{t('calendar.totalWork')}</div>
                        <div className="text-2xl text-foreground font-black font-mono tracking-tight">{formatTime(stats.totalSeconds)}</div>
                    </div>

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
                        <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4 flex items-center justify-center gap-2 shadow-sm">
                            <CheckCircle2 className="w-5 h-5 text-green-600 fill-green-100 dark:text-green-400 dark:fill-green-900" />
                            <span className="text-sm font-extrabold text-green-700 dark:text-green-400 tracking-wide">{t('calendar.questClear')}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
