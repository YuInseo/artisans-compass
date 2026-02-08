import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
// import {
//     Select,
//     SelectContent,
//     SelectItem,
//     SelectTrigger,
//     SelectValue,
// } from "@/components/ui/select";

import { ArrowRight, Moon, ListTodo, Sparkles, LogOut, ChevronLeft, ChevronRight } from "lucide-react";
import { Todo, Project } from "@/types";
import { DailyArchiveView } from "./DailyArchiveView";


import { useTodoStore, insertNode, updateNode, deleteNode, indentNode, unindentNode, moveNodes } from "@/hooks/useTodoStore";
import { TodoEditor } from "./TodoEditor";
import { v4 as uuidv4 } from 'uuid';

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



// --- Leftover Render Helper ---
const LeftoverList = React.memo(({ todos, depth = 0, movedIds, selectedIds, onMove }: { todos: Todo[], depth?: number, movedIds: Set<string>, selectedIds: Set<string>, onMove: (t: Todo) => void }) => {
    return (
        <div className="flex flex-col gap-1">
            {todos.map(t => {
                if (movedIds.has(t.id)) return null;
                const isSelected = selectedIds.has(t.id);
                return (
                    <div key={t.id} className="flex flex-col">
                        <div
                            data-todo-id={t.id}
                            onClick={(e) => {
                                e.stopPropagation();
                                onMove(t);
                            }}
                            className={`
                                group flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer 
                                transition-colors select-none
                                border border-transparent 
                                ${isSelected
                                    ? 'bg-primary/20 hover:bg-primary/30'
                                    : 'hover:bg-accent/50 hover:border-border/50'}
                            `}
                            style={{ marginLeft: depth * 16 }}
                        >
                            <div className={`w-1.5 h-1.5 rounded-full transition-colors ${isSelected ? 'bg-primary' : 'bg-muted-foreground/40 group-hover:bg-primary'}`} />
                            <span className={`text-sm truncate flex-1 ${isSelected ? 'text-primary font-medium' : 'text-foreground/80 group-hover:text-foreground'}`}>
                                {t.text || "Untitled"}
                            </span>
                            <ArrowRight className={`w-3 h-3 text-muted-foreground transition-opacity -ml-2 group-hover:ml-0 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
                        </div>
                        {t.children && t.children.length > 0 && (
                            <LeftoverList todos={t.children} depth={depth + 1} movedIds={movedIds} selectedIds={selectedIds} onMove={onMove} />
                        )}
                    </div>
                );
            })}
        </div>
    );
});


import { useTranslation } from "react-i18next";

export function ClosingRitualModal({ isOpen, onClose, currentStats, onSaveLog, screenshots = [], sessions = [], projects = [] }: ClosingRitualModalProps) {
    const { t } = useTranslation();
    const { projectTodos, activeProjectId, saveFutureTodos } = useTodoStore();
    const [step, setStep] = useState<1 | 2>(1);

    const [tomorrowPlans, setTomorrowPlans] = useState<Record<string, Todo[]>>({});

    const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
    const [isSaving, setIsSaving] = useState(false);
    const [materialChecked, setMaterialChecked] = useState(true);


    const [movedIds, setMovedIds] = useState<Set<string>>(new Set());

    // Filter projects to only those with activity today (valid tasks)
    const activeProjects = useMemo(() => {
        return projects.filter(p => {
            const todos = projectTodos[p.id];
            if (!todos || todos.length === 0) return false;
            // Check if it has at least one valid task (not Untitled)
            return todos.some(t => t.text && t.text.trim().length > 0 && t.text !== "Untitled");
        });
    }, [projects, projectTodos]);

    // Scroll Logic for Tabs
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [showLeftArrow, setShowLeftArrow] = useState(false);
    const [showRightArrow, setShowRightArrow] = useState(false);

    const checkScroll = () => {
        if (!scrollContainerRef.current) return;
        const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
        setShowLeftArrow(scrollLeft > 0);
        setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 1); // -1 for sub-pixel safety
    };

    useEffect(() => {
        checkScroll();
        window.addEventListener('resize', checkScroll);
        return () => window.removeEventListener('resize', checkScroll);
    }, [activeProjects, isOpen]); // Re-check when projects change or modal opens

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

            // Default to active project if valid, otherwise first active project
            if (activeProjectId && activeProjectId !== 'none' && activeProjects.find(p => p.id === activeProjectId)) {
                setSelectedProjectId(activeProjectId);
            } else {
                // If no active projects, fall back to first project (though list might be empty)
                setSelectedProjectId(activeProjects.length > 0 ? activeProjects[0].id : (projects.length > 0 ? projects[0].id : "all"));
            }

            setIsSaving(false);
            setMaterialChecked(true);
            setMovedIds(new Set());

            // Load Tomorrow's Plans (to avoid overwriting)
            const loadTomorrow = async () => {
                const now = new Date();
                const tomorrow = new Date(now);
                tomorrow.setDate(tomorrow.getDate() + 1);
                const localTomorrow = format(tomorrow, 'yyyy-MM-dd');

                // We need to access the store's loadTodosForDate function. 
                // Since it's not destructured above, we need to add it or use the store directly if possible.
                // Assuming it's available in the hook return.
                const plans = await useTodoStore.getState().loadTodosForDate(localTomorrow);
                if (plans) {
                    console.log("Loaded existing plans for tomorrow:", plans);
                    setTomorrowPlans(plans);
                }
            };
            loadTomorrow();

            // Fetch latest data to ensure timeline is up-to-date
            const fetchLatestLog = async () => {
                if ((window as any).ipcRenderer) {
                    try {
                        // Use local date for today
                        const today = new Date();
                        const dateStr = format(today, 'yyyy-MM-dd');

                        const latestLog = await (window as any).ipcRenderer.invoke('get-daily-log', dateStr);
                        if (latestLog) {
                            console.log("ClosingRitual: Fetched fresh log", latestLog);
                            if (latestLog.sessions) setFreshSessions(latestLog.sessions);
                            // We can also update stats if they are stored in log, or let DailyArchiveView calc them from sessions.
                        }
                    } catch (e) {
                        console.error("Failed to fetch fresh daily log", e);
                    }
                }
            };
            fetchLatestLog();
        }
    }, [isOpen, activeProjectId, activeProjects, projects]);

    const [freshSessions, setFreshSessions] = useState<any[]>(sessions);

    // Sync prop sessions to freshSessions when modal opens or props change (initially)
    useEffect(() => {
        if (!isOpen) setFreshSessions(sessions);
    }, [sessions, isOpen]);

    // Ensure selectedProjectId is valid
    useEffect(() => {
        if (selectedProjectId === 'none') return; // General/None is always valid
        if (activeProjects.length > 0 && !activeProjects.find(p => p.id === selectedProjectId)) {
            setSelectedProjectId(activeProjects[0].id);
        }
    }, [activeProjects, selectedProjectId]);

    const handleNext = () => {
        console.log("Advancing to Plan step");
        setStep(2);
    };


    // Serialization for Save
    const handleFinish = async () => {
        setIsSaving(true);
        await new Promise(r => setTimeout(r, 800)); // Visual delay

        let finalLog = "";

        // Helper to clean todos (remove empty/placeholders)
        const cleanTodos = (list: Todo[]): Todo[] => {
            return list.filter(t => {
                return t.text && t.text.trim().length > 0 && t.text !== "Untitled" && t.text !== "New task...";
            }).map(t => ({
                ...t,
                carriedOver: true,
                children: t.children ? cleanTodos(t.children) : []
            }));
        };

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
            finalLog += `## ${t('ritual.focusPoints')}\n${serializeTodos(completedTasks)}\n\n`;
        } else {
            finalLog += `## ${t('ritual.focusPoints')}\n${t('ritual.noTasksCompleted')}\n\n`;
        }

        // Prepare Tomorrow's Blueprint (Cleaned)
        const cleanedTomorrowPlans: Record<string, Todo[]> = {};
        Object.keys(tomorrowPlans).forEach(key => {
            const cleaned = cleanTodos(tomorrowPlans[key] || []);
            if (cleaned.length > 0) {
                cleanedTomorrowPlans[key] = cleaned;
            }
        });

        // 2. Tomorrow's Blueprint
        finalLog += `## ${t('ritual.tomorrowsBlueprint')}\n`;
        projects.forEach(p => {
            const planList = cleanedTomorrowPlans[p.id];
            if (planList && planList.length > 0) {
                finalLog += `### ${p.name}\n${serializeTodos(planList)}\n\n`;
            }
        });
        const miscPlan = cleanedTomorrowPlans['all'];
        if (miscPlan && miscPlan.length > 0) {
            finalLog += `### ${t('ritual.miscellaneous')}\n${serializeTodos(miscPlan)}\n`;
        }

        // PERSIST tomorrow's plans to store for next day
        // Calculate tomorrow's date
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);

        if (Object.keys(cleanedTomorrowPlans).length > 0) {
            await saveFutureTodos(tomorrow, cleanedTomorrowPlans);
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


    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // --- Actions for Right Panel ---
    const actions = useMemo(() => ({
        addTodo: (text: string, parentId?: string | null, afterId?: string | null) => {
            const newTodo: Todo = {
                id: uuidv4(),
                text,
                completed: false,
                children: [],
                isCollapsed: false
            };
            setTomorrowPlans(prev => {
                const list = prev[selectedProjectId] || [];
                return { ...prev, [selectedProjectId]: insertNode(list, parentId || null, afterId || null, newTodo) };
            });
            return newTodo.id;
        },
        updateTodo: (id: string, updates: Partial<Todo>) => {
            setTomorrowPlans(prev => {
                const list = prev[selectedProjectId] || [];
                return { ...prev, [selectedProjectId]: updateNode(list, id, updates) };
            });
        },
        deleteTodo: (id: string) => {
            setTomorrowPlans(prev => {
                const list = prev[selectedProjectId] || [];
                return { ...prev, [selectedProjectId]: deleteNode(list, id) };
            });
        },
        deleteTodos: (ids: string[]) => {
            setTomorrowPlans(prev => {
                const list = prev[selectedProjectId] || [];
                let newList = list;
                ids.forEach(id => {
                    newList = deleteNode(newList, id);
                });
                return { ...prev, [selectedProjectId]: newList };
            });
        },
        indentTodo: (id: string) => {
            setTomorrowPlans(prev => {
                const list = prev[selectedProjectId] || [];
                return { ...prev, [selectedProjectId]: indentNode(list, id) };
            });
        },
        unindentTodo: (id: string) => {
            setTomorrowPlans(prev => {
                const list = prev[selectedProjectId] || [];
                return { ...prev, [selectedProjectId]: unindentNode(list, id) };
            });
        },
        moveTodo: (activeId: string, parentId: string | null, index: number) => {
            setTomorrowPlans(prev => {
                const list = prev[selectedProjectId] || [];
                return { ...prev, [selectedProjectId]: moveNodes(list, [activeId], parentId, index) };
            });
        },
        moveTodos: (activeIds: string[], parentId: string | null, index: number) => {
            setTomorrowPlans(prev => {
                const list = prev[selectedProjectId] || [];
                return { ...prev, [selectedProjectId]: moveNodes(list, activeIds, parentId, index) };
            });
        }
    }), [selectedProjectId]);


    const [selectionBox, setSelectionBox] = useState<{ startX: number, startY: number, currentX: number, currentY: number } | null>(null);
    const leftoverContainerRef = useRef<HTMLDivElement>(null);

    // --- Selection Handlers ---
    useEffect(() => {
        if (!selectionBox) return;

        const handleSelectionMove = (e: PointerEvent) => {
            if (!leftoverContainerRef.current) return;

            const containerRect = leftoverContainerRef.current.getBoundingClientRect();
            // Calculate coordinates relative to the container
            const currentX = e.clientX - containerRect.left;
            const currentY = e.clientY - containerRect.top + leftoverContainerRef.current.scrollTop;

            setSelectionBox(prev => prev ? { ...prev, currentX, currentY } : null);

            const rect = {
                left: Math.min(selectionBox.startX, currentX),
                top: Math.min(selectionBox.startY, currentY),
                width: Math.abs(currentX - selectionBox.startX),
                height: Math.abs(currentY - selectionBox.startY)
            };

            const elements = leftoverContainerRef.current.querySelectorAll('[data-todo-id]');
            const newSelected = new Set<string>();

            elements.forEach((el) => {
                const htmlEl = el as HTMLElement;
                // Get element position relative to container, accounting for scroll
                const elTop = htmlEl.offsetTop;
                const elHeight = htmlEl.offsetHeight;

                // Vertical-only intersection check
                // We check if the element's vertical range overlaps with the selection box's vertical range
                const isIntersecting = !(
                    rect.top >= elTop + elHeight ||
                    rect.top + rect.height <= elTop
                );

                if (isIntersecting) {
                    const id = el.getAttribute('data-todo-id');
                    if (id) newSelected.add(id);
                }
            });

            setSelectedIds(newSelected);
        };

        const handleSelectionEnd = () => {
            setSelectionBox(null);
        };

        window.addEventListener('pointermove', handleSelectionMove);
        window.addEventListener('pointerup', handleSelectionEnd);

        return () => {
            window.removeEventListener('pointermove', handleSelectionMove);
            window.removeEventListener('pointerup', handleSelectionEnd);
        };
    }, [selectionBox]);

    const handleSelectionStart = (e: React.PointerEvent) => {
        const target = e.target as HTMLElement;
        // If clicking directly on a todo item (or its children), ignore drag start 
        // (unless it's the margin/padding, but our click handler is on the main div)
        // Actually, we want to allow drag start from empty space.
        if (target.closest('[data-todo-id]')) return;

        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);

        if (!leftoverContainerRef.current) return;
        const containerRect = leftoverContainerRef.current.getBoundingClientRect();

        const startX = e.clientX - containerRect.left;
        const startY = e.clientY - containerRect.top + leftoverContainerRef.current.scrollTop;

        setSelectionBox({
            startX,
            startY,
            currentX: startX,
            currentY: startY
        });
        setSelectedIds(new Set());
    };

    // Derived Logic
    const currentProjectName = projects.find(p => p.id === selectedProjectId)?.name || "All Projects";

    const filteredLeftovers = useMemo(() => {
        const clean = (list: Todo[]): Todo[] => {
            return list.filter(t => {
                const hasText = t.text && t.text.trim().length > 0 && t.text !== "Untitled" && t.text !== "New task...";
                const isCompleted = t.completed;
                return hasText && !isCompleted;
            }).map(t => ({
                ...t,
                children: t.children ? clean(t.children) : []
            }));
        };
        return clean(todayTodos);
    }, [todayTodos]);

    // --- Move Handler ---
    const handleMoveLeftover = useCallback((todo: Todo) => {
        // Determine items to move: if the clicked todo is selected, move ALL selected.
        // Otherwise, move just this todo.
        const itemsToMove: Todo[] = [];

        if (selectedIds.has(todo.id)) {
            // Find all selected todos from the filteredLeftovers list (recursive search)
            const findSelected = (list: Todo[]) => {
                list.forEach(t => {
                    if (selectedIds.has(t.id) && !movedIds.has(t.id)) {
                        itemsToMove.push(t);
                    }
                    if (t.children) findSelected(t.children);
                });
            };
            findSelected(filteredLeftovers);
        } else {
            itemsToMove.push(todo);
        }

        if (itemsToMove.length === 0) return;

        // Add to Right Panel (Tomorrow Plans)
        setTomorrowPlans(prev => {
            const currentList = prev[selectedProjectId] || [];
            // Clone todos
            const clones = itemsToMove.map(t => JSON.parse(JSON.stringify(t)));
            return {
                ...prev,
                [selectedProjectId]: [...currentList, ...clones]
            };
        });

        // Mark as moved (Hide from Left)
        setMovedIds(prev => {
            const next = new Set(prev);
            itemsToMove.forEach(t => next.add(t.id));
            // Also add children of moved items to hidden? 
            // Logic in LeftoverList hides children if parent is rendered, but 
            // if we move a parent, we probably want to consider its children handled.
            // But strictly, we just hide the ID we moved.
            return next;
        });

        // Clear selection after move
        setSelectedIds(new Set());
    }, [selectedProjectId, selectedIds, movedIds, filteredLeftovers]);



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
                        <DialogTitle className="text-lg font-medium tracking-tight text-foreground select-none">
                            {t('ritual.title')}
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
                                projectTodos={projectTodos}
                                projects={projects}
                                screenshots={screenshots}
                                sessions={freshSessions}
                                stats={currentStats}
                                hideCloseButton={true}
                                onDeleteTodo={(id) => {
                                    // Find which project this todo belongs to
                                    // We need to search in projectTodos
                                    let foundPid = 'none';
                                    for (const [pid, list] of Object.entries(projectTodos)) {
                                        const find = (tList: Todo[]): boolean => {
                                            for (const t of tList) {
                                                if (t.id === id) return true;
                                                if (t.children && find(t.children)) return true;
                                            }
                                            return false;
                                        };
                                        if (find(list)) {
                                            foundPid = pid;
                                            break;
                                        }
                                    }
                                    useTodoStore.getState().deleteTodo(id, foundPid);
                                }}
                                onToggleTodo={(id) => {
                                    let foundPid = 'none';
                                    for (const [pid, list] of Object.entries(projectTodos)) {
                                        const find = (tList: Todo[]): boolean => {
                                            for (const t of tList) {
                                                if (t.id === id) return true;
                                                if (t.children && find(t.children)) return true;
                                            }
                                            return false;
                                        };
                                        if (find(list)) {
                                            foundPid = pid;
                                            break;
                                        }
                                    }
                                    useTodoStore.getState().toggleTodo(id, foundPid);
                                }}
                                onUpdateTodoText={(id, text) => {
                                    let foundPid = 'none';
                                    for (const [pid, list] of Object.entries(projectTodos)) {
                                        const find = (tList: Todo[]): boolean => {
                                            for (const t of tList) {
                                                if (t.id === id) return true;
                                                if (t.children && find(t.children)) return true;
                                            }
                                            return false;
                                        };
                                        if (find(list)) {
                                            foundPid = pid;
                                            break;
                                        }
                                    }
                                    useTodoStore.getState().updateTodoText(id, text, false, foundPid);
                                }}
                            />
                        </div>
                    )}

                    {/* Step 2: Plan & Prepare (2-Column Layout) */}
                    {step === 2 && (
                        <div className="h-full flex flex-col animate-in fade-in slide-in-from-right-8 duration-500 bg-background">
                            {/* Toolbar / Project Selector (Pill Tabs) */}
                            <div className="px-6 py-3 bg-card border-b border-border flex items-center justify-between gap-4 shrink-0 relative group/tabs">

                                {/* Scroll Indicators */}
                                {showLeftArrow && (
                                    <button
                                        onClick={() => scrollContainerRef.current?.scrollBy({ left: -200, behavior: 'smooth' })}
                                        className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-card to-transparent z-10 flex items-center justify-start pl-2"
                                    >
                                        <div className="w-6 h-6 rounded-full bg-background border shadow-sm flex items-center justify-center hover:bg-accent transition-colors">
                                            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                                        </div>
                                    </button>
                                )}
                                <div
                                    ref={scrollContainerRef}
                                    onScroll={checkScroll}
                                    className="flex items-center gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden flex-1 pb-1 -mb-1 mask-linear-fade scroll-smooth"
                                >
                                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mr-2 shrink-0 select-none">
                                        {t('ritual.planningContext')}:
                                    </span>

                                    {/* General Work Pill */}
                                    <button
                                        onClick={() => setSelectedProjectId('none')}
                                        className={`
                                            flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all shrink-0
                                            border select-none
                                            ${selectedProjectId === 'none'
                                                ? 'bg-indigo-500/15 text-indigo-600 border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/30 shadow-sm'
                                                : 'bg-muted/50 text-muted-foreground border-transparent hover:bg-muted hover:text-foreground'}
                                        `}
                                    >
                                        <div className={`w-2 h-2 rounded-full ${selectedProjectId === 'none' ? 'bg-indigo-500' : 'bg-slate-400'}`} />
                                        {t('dashboard.generalWork') || "General"}

                                        {/* Count Badge */}
                                        {(projectTodos['none'] || []).filter(t => !t.completed).length > 0 && (
                                            <span className={`
                                                ml-1 px-1.5 py-0.5 rounded-md text-[10px] leading-none font-bold
                                                ${selectedProjectId === 'none'
                                                    ? 'bg-indigo-500 text-white'
                                                    : 'bg-muted-foreground/30 text-muted-foreground'}
                                            `}>
                                                {(projectTodos['none'] || []).filter(t => !t.completed).length}
                                            </span>
                                        )}
                                    </button>

                                    <div className="w-px h-4 bg-border mx-1 shrink-0" />

                                    {/* Active Projects Pills */}
                                    {activeProjects.map(p => {
                                        const count = (projectTodos[p.id] || []).filter(t => !t.completed).length;
                                        const isActive = selectedProjectId === p.id;
                                        const colorClass = p.type === 'Main' ? 'bg-blue-500' : 'bg-green-500';

                                        return (
                                            <button
                                                key={p.id}
                                                onClick={() => setSelectedProjectId(p.id)}
                                                className={`
                                                    flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all shrink-0
                                                    border select-none
                                                    ${isActive
                                                        ? 'bg-background text-foreground border-border shadow-sm ring-1 ring-border/50'
                                                        : 'bg-muted/50 text-muted-foreground border-transparent hover:bg-muted hover:text-foreground'}
                                                `}
                                            >
                                                <div className={`w-2 h-2 rounded-full ${colorClass}`} />
                                                {p.name}

                                                {count > 0 && (
                                                    <span className={`
                                                        ml-1 px-1.5 py-0.5 rounded-md text-[10px] leading-none font-bold
                                                        ${isActive
                                                            ? 'bg-foreground text-background'
                                                            : 'bg-muted-foreground/30 text-muted-foreground'}
                                                    `}>
                                                        {count}
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>

                                {showRightArrow && (
                                    <button
                                        onClick={() => scrollContainerRef.current?.scrollBy({ left: 200, behavior: 'smooth' })}
                                        className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-card to-transparent z-10 flex items-center justify-end pr-2"
                                    >
                                        <div className="w-6 h-6 rounded-full bg-background border shadow-sm flex items-center justify-center hover:bg-accent transition-colors">
                                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                        </div>
                                    </button>
                                )}

                                <span className="text-xs text-muted-foreground whitespace-nowrap hidden sm:block select-none">
                                    {t('ritual.organizeTasksFor', { project: selectedProjectId === 'none' ? (t('dashboard.generalWork') || "General") : currentProjectName })}
                                </span>
                            </div>

                            <div className="flex-1 flex overflow-hidden">


                                {/* Middle Column: Leftovers (Interactive List) */}
                                <div className="w-1/3 border-r border-border bg-muted/10 flex flex-col min-w-[300px]">
                                    <div className="px-6 py-4 border-b border-border/50">
                                        <h3 className="text-xs font-bold text-muted-foreground flex items-center gap-2 uppercase tracking-wider select-none">
                                            <ListTodo className="w-3 h-3" />
                                            {t('ritual.todaysLeftovers')}
                                        </h3>
                                    </div>
                                    <div
                                        ref={leftoverContainerRef}
                                        onPointerDown={handleSelectionStart}
                                        className="flex-1 overflow-y-auto p-4 custom-scrollbar relative"
                                    >
                                        {filteredLeftovers.length === 0 ? (
                                            <div className="text-center py-10 text-muted-foreground text-sm">
                                                <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                                {t('ritual.allDone')}
                                            </div>
                                        ) : (
                                            <div className="opacity-100">
                                                <LeftoverList todos={filteredLeftovers} movedIds={movedIds} selectedIds={selectedIds} onMove={handleMoveLeftover} />
                                            </div>
                                        )}

                                        {/* Selection Box Overlay */}
                                        {selectionBox && (
                                            <div
                                                className="absolute bg-blue-500/20 border border-blue-500/50 z-50 pointer-events-none"
                                                style={{
                                                    left: Math.min(selectionBox.startX, selectionBox.currentX),
                                                    top: Math.min(selectionBox.startY, selectionBox.currentY),
                                                    width: Math.abs(selectionBox.currentX - selectionBox.startX),
                                                    height: Math.abs(selectionBox.currentY - selectionBox.startY)
                                                }}
                                            />
                                        )}
                                    </div>
                                </div>

                                {/* Right Column: Blueprint (Active BlockNote) */}
                                <div className="flex-1 flex flex-col bg-card">
                                    <div className="px-6 py-4 border-b border-border/50">
                                        <h3 className="text-xs font-bold text-muted-foreground flex items-center gap-2 uppercase tracking-wider select-none">
                                            <Sparkles className="w-3 h-3" />
                                            {t('ritual.tomorrowsBlueprint')}
                                        </h3>
                                    </div>

                                    <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar overflow-x-hidden relative flex flex-col">
                                        <TodoEditor
                                            todos={tomorrowPlans[selectedProjectId] || []}
                                            isWidgetMode={false}
                                            actions={actions}
                                        />
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
                                {t('ritual.reviewPlans')} <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                        </>
                    ) : (
                        <>

                            <Button
                                onClick={handleFinish}
                                disabled={isSaving || !materialChecked}
                                className={`rounded-xl px-10 h-12 text-base font-semibold shadow-lg hover:shadow-xl transition-all ${!materialChecked ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 text-white shadow-green-200'}`}
                            >
                                {isSaving ? t('ritual.closing') : t('ritual.commit')} <LogOut className="w-4 h-4 ml-2" />
                            </Button>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
