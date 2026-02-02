import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Todo } from '@/types';
import { format, subDays } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';

interface TodoStore {
    projectTodos: Record<string, Todo[]>;
    activeProjectId: string;
    previousDayTodos: Record<string, Todo[]>; // For carryover
    hasLoaded: boolean;

    // Actions
    setActiveProjectId: (id: string) => void;
    setTodos: (todos: Todo[], shouldSave?: boolean) => void;
    addTodo: (text: string, parentId?: string | null, afterId?: string | null) => string;
    updateTodo: (id: string, updates: Partial<Todo>, skipHistory?: boolean) => void;
    deleteTodo: (id: string) => void;
    deleteTodos: (ids: string[]) => void;
    updateTodoText: (id: string, text: string, skipHistory?: boolean) => void;
    toggleTodo: (id: string) => void;
    toggleCollapse: (id: string) => void;

    // Tree Actions
    indentTodo: (id: string) => void;
    unindentTodo: (id: string) => void;
    moveTodo: (activeId: string, parentId: string | null, index: number) => void;
    moveTodos: (activeIds: string[], parentId: string | null, index: number) => void;
    clearUntitledTodos: () => void;

    // Persistence
    loadTodos: () => Promise<void>;
    saveTodos: () => Promise<void>;
    loadTodosForDate: (dateStr: string) => Promise<Record<string, Todo[]> | null>;
    carryOverTodos: (todos: Todo[], projectId: string) => Promise<void>;
    saveFutureTodos: (date: Date, todosByProject: Record<string, Todo[]>) => Promise<void>;

    // Undo/Redo
    history: Record<string, Todo[]>[];
    future: Record<string, Todo[]>[];
    lastActionTime: number;
    undo: () => void;
    redo: () => void;
    addToHistory: () => void;
}

// ... imports ...

// Helper to save to IPC
const saveToIPC = async (projectTodos: Record<string, Todo[]>) => {
    if ((window as any).ipcRenderer) {
        const now = new Date();
        const yearMonth = format(now, 'yyyy-MM');
        const dateStr = format(now, 'yyyy-MM-dd');
        const logs = await (window as any).ipcRenderer.getMonthlyLog(yearMonth);
        const todayLog = logs[dateStr] || {};

        logs[dateStr] = {
            ...todayLog,
            projectTodos
        };
        await (window as any).ipcRenderer.saveMonthlyLog({ yearMonth, data: logs });
    }
};

// --- Helpers ---
export const insertNode = (list: Todo[], parentId: string | null, afterId: string | null, newNode: Todo): Todo[] => {
    if (parentId === null && afterId === null) return [...list, newNode];
    if (parentId === null) {
        const idx = list.findIndex(item => item.id === afterId);
        if (idx !== -1) {
            const copy = [...list];
            copy.splice(idx + 1, 0, newNode);
            return copy;
        }
        return list.map(item => item.children ? { ...item, children: insertNode(item.children, null, afterId, newNode) } : item);
    }
    return list.map(item => {
        if (item.id === parentId) {
            let newChildren = item.children || [];
            if (afterId === parentId) newChildren = [newNode, ...newChildren];
            else if (afterId) {
                const idx = newChildren.findIndex(c => c.id === afterId);
                if (idx !== -1) {
                    const copy = [...newChildren];
                    copy.splice(idx + 1, 0, newNode);
                    newChildren = copy;
                } else newChildren = [...newChildren, newNode];
            } else newChildren = [...newChildren, newNode];
            return { ...item, children: newChildren, isCollapsed: false };
        }
        if (item.children) return { ...item, children: insertNode(item.children, parentId, afterId, newNode) };
        return item;
    });
};

export const updateNode = (list: Todo[], id: string, updates: Partial<Todo>): Todo[] => {
    return list.map(item => {
        if (item.id === id) {
            return { ...item, ...updates };
        }
        if (item.children) {
            return { ...item, children: updateNode(item.children, id, updates) };
        }
        return item;
    });
};

export const deleteNode = (list: Todo[], id: string): Todo[] => {
    return list.filter(item => {
        if (item.id === id) return false;
        if (item.children) item.children = deleteNode(item.children, id);
        return true;
    });
};

export const indentNode = (list: Todo[], id: string): Todo[] => {
    const idx = list.findIndex(item => item.id === id);
    if (idx > 0) {
        const itemToMove = list[idx];
        const prevSibling = list[idx - 1];
        const newList = [...list];
        newList.splice(idx, 1);
        const updatedPrev = {
            ...prevSibling,
            children: [...(prevSibling.children || []), itemToMove],
            isCollapsed: false
        };
        newList[idx - 1] = updatedPrev;
        return newList;
    }
    return list.map(item => item.children ? { ...item, children: indentNode(item.children, id) } : item);
};

export const unindentNode = (list: Todo[], id: string): Todo[] => {
    const findParentAndMove = (nodes: Todo[]): { nodes: Todo[], success: boolean } => {
        for (let i = 0; i < nodes.length; i++) {
            const parent = nodes[i];
            if (parent.children) {
                const childIdx = parent.children.findIndex(c => c.id === id);
                if (childIdx !== -1) {
                    const child = parent.children[childIdx];
                    const newChildren = [...parent.children];
                    newChildren.splice(childIdx, 1);
                    const newParent = { ...parent, children: newChildren };
                    const newNodes = [...nodes];
                    newNodes[i] = newParent;
                    newNodes.splice(i + 1, 0, child);
                    return { nodes: newNodes, success: true };
                }
                const res = findParentAndMove(parent.children);
                if (res.success) {
                    const newNodes = [...nodes];
                    newNodes[i] = { ...parent, children: res.nodes };
                    return { nodes: newNodes, success: true };
                }
            }
        }
        return { nodes, success: false };
    };
    const res = findParentAndMove(list);
    return res.success ? res.nodes : list;
};

// --- Move Helper ---
export const moveNodes = (list: Todo[], activeIds: string[], parentId: string | null, index: number): Todo[] => {
    const movedNodes: Todo[] = [];
    // 1. Collect and Remove (Preserving tree order)
    const removeNodes = (currentList: Todo[]): Todo[] => {
        const result: Todo[] = [];
        for (const item of currentList) {
            if (activeIds.includes(item.id)) {
                movedNodes.push(item);
                continue;
            }
            if (item.children) {
                const newChildren = removeNodes(item.children);
                if (newChildren !== item.children) {
                    result.push({ ...item, children: newChildren });
                } else {
                    result.push(item);
                }
            } else {
                result.push(item);
            }
        }
        return result;
    };

    const todosWithoutActive = removeNodes(list);
    if (movedNodes.length === 0) return list; // No change

    // 2. Validate Parent (prevent circular)
    if (parentId !== null) {
        const findId = (currentList: Todo[]): boolean => {
            for (const t of currentList) {
                if (t.id === parentId) return true;
                if (t.children && findId(t.children)) return true;
            }
            return false;
        };
        // If parent is not found in the tree (e.g. it was one of the moved nodes or deleted), abort.
        if (!findId(todosWithoutActive)) {
            return list;
        }
    }

    // 3. Insert
    const recursiveInsert = (currentList: Todo[]): Todo[] => {
        if (parentId === null) {
            const newList = [...currentList];
            const safeIndex = Math.min(Math.max(0, index), newList.length);
            newList.splice(safeIndex, 0, ...movedNodes);
            return newList;
        }

        return currentList.map(item => {
            if (item.id === parentId) {
                const startChildren = item.children || [];
                const newChildren = [...startChildren];
                const safeIndex = Math.min(Math.max(0, index), newChildren.length);
                newChildren.splice(safeIndex, 0, ...movedNodes);
                return { ...item, children: newChildren, isCollapsed: false };
            }
            if (item.children) {
                return { ...item, children: recursiveInsert(item.children) };
            }
            return item;
        });
    };

    return recursiveInsert(todosWithoutActive);
};

export const useTodoStore = create<TodoStore>()(
    persist(
        (set, get) => ({
            projectTodos: {},
            activeProjectId: 'default',
            previousDayTodos: {},
            history: [],
            future: [],
            lastActionTime: 0,
            hasLoaded: false,

            setActiveProjectId: (id) => set({ activeProjectId: id }),

            addToHistory: () => {
                const { projectTodos, history } = get();
                const newHistory = [...history, JSON.parse(JSON.stringify(projectTodos))];
                if (newHistory.length > 50) newHistory.shift(); // Limit history
                set({ history: newHistory, future: [] });
            },

            undo: () => {
                const { history, future, projectTodos } = get();
                if (history.length === 0) return;

                const previous = history[history.length - 1];
                const newHistory = history.slice(0, -1);

                set({
                    projectTodos: previous,
                    history: newHistory,
                    future: [projectTodos, ...future],
                    lastActionTime: Date.now()
                });

                saveToIPC(previous);
            },

            redo: () => {
                const { history, future, projectTodos } = get();
                if (future.length === 0) return;

                const next = future[0];
                const newFuture = future.slice(1);

                set({
                    projectTodos: next,
                    history: [...history, projectTodos],
                    future: newFuture,
                    lastActionTime: Date.now()
                });

                saveToIPC(next);
            },

            setTodos: (todos, shouldSave = true) => {
                const { activeProjectId, projectTodos, addToHistory } = get();
                if (shouldSave) addToHistory();
                const newProjectTodos = { ...projectTodos, [activeProjectId]: todos };
                set({ projectTodos: newProjectTodos });
                if (shouldSave) saveToIPC(newProjectTodos);
            },

            addTodo: (text, parentId = null, afterId = null) => {
                get().addToHistory();
                const newId = uuidv4();
                const newNode: Todo = { id: newId, text, completed: false, children: [] };

                const { activeProjectId, projectTodos } = get();
                const currentTodos = projectTodos[activeProjectId] || [];

                let nextTodos: Todo[];

                if (currentTodos.length === 0) {
                    nextTodos = [newNode];
                } else if (parentId) {
                    // Pass afterId (which might be parentId itself for prepend)
                    nextTodos = insertNode(currentTodos, parentId, afterId, newNode);
                } else if (afterId) {
                    const addSiblingRecursive = (list: Todo[]): Todo[] => {
                        const idx = list.findIndex(i => i.id === afterId);
                        if (idx !== -1) {
                            const c = [...list];
                            c.splice(idx + 1, 0, newNode);
                            return c;
                        }
                        return list.map(item => item.children ? { ...item, children: addSiblingRecursive(item.children) } : item);
                    };
                    nextTodos = addSiblingRecursive(currentTodos);
                } else {
                    nextTodos = [...currentTodos, newNode];
                }

                const newProjectTodos = { ...projectTodos, [activeProjectId]: nextTodos };
                set({ projectTodos: newProjectTodos });
                saveToIPC(newProjectTodos);
                return newId;
            },

            updateTodo: (id, updates, skipHistory = false) => {
                if (!skipHistory) get().addToHistory();
                const { activeProjectId, projectTodos } = get();
                const currentTodos = projectTodos[activeProjectId] || [];

                const nextTodos = updateNode(currentTodos, id, updates);
                const newProjectTodos = { ...projectTodos, [activeProjectId]: nextTodos };

                set({ projectTodos: newProjectTodos });
                saveToIPC(newProjectTodos);
            },

            deleteTodo: (id) => {
                get().deleteTodos([id]);
            },

            deleteTodos: (ids) => {
                get().addToHistory();
                const { activeProjectId, projectTodos } = get();
                const currentTodos = projectTodos[activeProjectId] || [];

                const idsSet = new Set(ids);
                const deleteNodesRecursive = (list: Todo[]): Todo[] => {
                    return list.flatMap(item => {
                        if (idsSet.has(item.id)) {
                            // If deleted, promote children? Using deleteNodeAndPromote logic
                            return item.children ? deleteNodesRecursive(item.children) : [];
                            // Actually, original deleteTodo promoted children. Let's keep that behavior.
                            // But wait, if we delete a parent AND its child is also in idsSet?
                            // Recurse first.
                        }
                        if (item.children) {
                            return [{ ...item, children: deleteNodesRecursive(item.children) }];
                        }
                        return [item];
                    });
                };

                // Optimized promotion logic for multiple deletes
                // If we simply use the previous recursive approach, it handles promotion naturally 
                // IF we only return children.

                // Let's refine:
                const processList = (list: Todo[]): Todo[] => {
                    return list.flatMap(item => {
                        if (idsSet.has(item.id)) {
                            // Item is deleted. Should we keep children?
                            // In single deleteTodo: "return item.children || []" (Promote)
                            // So yes, promote children.
                            // But we must also process those active children in case they are ALSO deleted.
                            return item.children ? processList(item.children) : [];
                        }
                        // Item not deleted, process children
                        if (item.children) {
                            return [{ ...item, children: processList(item.children) }];
                        }
                        return [item];
                    });
                };

                const nextTodos = processList(currentTodos);
                const newProjectTodos = { ...projectTodos, [activeProjectId]: nextTodos };

                set({ projectTodos: newProjectTodos });
                saveToIPC(newProjectTodos);
            },

            updateTodoText: (id, text, skipHistory = false) => {
                get().updateTodo(id, { text }, skipHistory);
            },

            toggleTodo: (id) => {
                get().addToHistory();
                const { activeProjectId, projectTodos } = get();
                const currentTodos = projectTodos[activeProjectId] || [];

                const toggleNode = (list: Todo[]): Todo[] => {
                    return list.map(item => {
                        if (item.id === id) return { ...item, completed: !item.completed };
                        if (item.children) return { ...item, children: toggleNode(item.children) };
                        return item;
                    });
                };

                const newTodos = toggleNode(currentTodos);
                const newProjectTodos = { ...projectTodos, [activeProjectId]: newTodos };
                set({ projectTodos: newProjectTodos });
                saveToIPC(newProjectTodos);
            },

            toggleCollapse: (id) => {
                get().addToHistory();
                const { activeProjectId, projectTodos } = get();
                const currentTodos = projectTodos[activeProjectId] || [];

                const toggleNode = (list: Todo[]): Todo[] => {
                    return list.map(item => {
                        if (item.id === id) {
                            return { ...item, isCollapsed: !item.isCollapsed };
                        }
                        if (item.children) {
                            return { ...item, children: toggleNode(item.children) };
                        }
                        return item;
                    });
                };

                const newTodos = toggleNode(currentTodos);
                const newProjectTodos = { ...projectTodos, [activeProjectId]: newTodos };
                set({ projectTodos: newProjectTodos });
                saveToIPC(newProjectTodos);
            },

            indentTodo: (id) => {
                get().addToHistory();
                const { activeProjectId, projectTodos } = get();
                const currentTodos = projectTodos[activeProjectId] || [];
                const nextTodos = indentNode(currentTodos, id);
                set({ projectTodos: { ...projectTodos, [activeProjectId]: nextTodos } });
                saveToIPC({ ...projectTodos, [activeProjectId]: nextTodos });
            },

            unindentTodo: (id) => {
                get().addToHistory();
                const { activeProjectId, projectTodos } = get();
                const currentTodos = projectTodos[activeProjectId] || [];
                const nextTodos = unindentNode(currentTodos, id);
                set({ projectTodos: { ...projectTodos, [activeProjectId]: nextTodos } });
                saveToIPC({ ...projectTodos, [activeProjectId]: nextTodos });
            },

            clearUntitledTodos: () => {
                get().addToHistory();
                const { activeProjectId, projectTodos } = get();
                const currentTodos = projectTodos[activeProjectId] || [];

                const filterEmpty = (list: Todo[]): Todo[] => {
                    return list.filter(t => {
                        if (t.text.trim() === '') return false;
                        if (t.children) t.children = filterEmpty(t.children);
                        return true;
                    });
                };

                const newTodos = filterEmpty(currentTodos);
                set({ projectTodos: { ...projectTodos, [activeProjectId]: newTodos } });
                saveToIPC({ ...projectTodos, [activeProjectId]: newTodos });
            },

            moveTodo: (activeId: string, parentId: string | null, index: number) => {
                get().moveTodos([activeId], parentId, index);
            },

            moveTodos: (activeIds: string[], parentId: string | null, index: number) => {
                get().addToHistory();
                const { activeProjectId, projectTodos } = get();
                const currentTodos = projectTodos[activeProjectId] || [];

                const nextTodos = moveNodes(currentTodos, activeIds, parentId, index);

                set({ projectTodos: { ...projectTodos, [activeProjectId]: nextTodos } });
                saveToIPC({ ...projectTodos, [activeProjectId]: nextTodos });
            },

            loadTodos: async () => {
                if ((window as any).ipcRenderer) {
                    const now = new Date();
                    const yearMonth = format(now, 'yyyy-MM');
                    const dateStr = format(now, 'yyyy-MM-dd');
                    const logs = await (window as any).ipcRenderer.getMonthlyLog(yearMonth);

                    console.log(`[useTodoStore] Loading todos for ${dateStr}`, logs[dateStr]);

                    let currentProjectTodos: Record<string, Todo[]> = {};
                    let needsCarryOver = true;

                    // 1. Load existing data for today if available
                    if (logs && logs[dateStr]) {
                        const data = logs[dateStr];
                        if (data.projectTodos) {
                            currentProjectTodos = data.projectTodos;
                        } else if (data.todos) {
                            // Backend migration fallback
                            currentProjectTodos = { 'none': data.todos };
                        }

                        // Check if we already did carry-over
                        if (data.carriedOver) {
                            needsCarryOver = false;
                        }
                    } else {
                        // No log at all for today
                        needsCarryOver = true;
                    }

                    // 2. Perform Carry Over if needed
                    if (needsCarryOver) {
                        console.log("[useTodoStore] Checking yesterday for carry-over...");

                        const yesterday = subDays(now, 1);
                        const yDateStr = format(yesterday, 'yyyy-MM-dd');
                        const yYearMonth = format(yesterday, 'yyyy-MM');

                        let yData = null;

                        if (yYearMonth === yearMonth) {
                            yData = logs[yDateStr];
                        } else {
                            const yLogs = await (window as any).ipcRenderer.getMonthlyLog(yYearMonth);
                            yData = yLogs ? yLogs[yDateStr] : null;
                        }

                        if (yData && (yData.projectTodos || yData.todos)) {
                            console.log(`[useTodoStore] Found data for yesterday (${yDateStr}), processing unfinished tasks...`);

                            const sourceTodos = yData.projectTodos || { 'none': yData.todos || [] };

                            // Recursive filter to keep only incomplete tasks
                            const filterIncomplete = (list: Todo[]): Todo[] => {
                                return list.filter(t => !t.completed).map(t => ({
                                    ...t,
                                    carriedOver: true,
                                    children: t.children ? filterIncomplete(t.children) : []
                                }));
                            };

                            let hasCarryOver = false;
                            const carriedOverProjectTodos: Record<string, Todo[]> = {};

                            Object.keys(sourceTodos).forEach(projectId => {
                                const incomplete = filterIncomplete(sourceTodos[projectId]);
                                if (incomplete.length > 0) {
                                    carriedOverProjectTodos[projectId] = incomplete;
                                    hasCarryOver = true;
                                }
                            });

                            if (hasCarryOver) {
                                console.log("[useTodoStore] Carrying over tasks:", carriedOverProjectTodos);

                                // MERGE STRATEGY: Combine current (planned) + carried over
                                // Avoid ID collisions? Usually UUIDs are unique, but let's be safe.
                                // Actually better to just append. 
                                // If 'currentProjectTodos' has tasks (from planning), we add carried over tasks to them.

                                const newProjectTodos = { ...currentProjectTodos };

                                Object.keys(carriedOverProjectTodos).forEach(projectId => {
                                    const existing = newProjectTodos[projectId] || [];
                                    const incoming = carriedOverProjectTodos[projectId];

                                    // Make sure we don't duplicate if they somehow exist (though unlikely with UUIDs)
                                    const existingIds = new Set(existing.map(t => t.id));
                                    const toAdd = incoming.filter(t => !existingIds.has(t.id));

                                    newProjectTodos[projectId] = [...existing, ...toAdd];
                                });

                                currentProjectTodos = newProjectTodos;

                                // Mark as carried over so we don't do it again
                                // We need to update the log immediately
                                if (logs) {
                                    if (!logs[dateStr]) logs[dateStr] = {};
                                    logs[dateStr].carriedOver = true;
                                    logs[dateStr].projectTodos = currentProjectTodos;

                                    // Note: We should assume saveToIPC logic or similar
                                    // Since saveTodos updates the store state then saves, let's just set state and save.
                                }
                            }
                        }
                    }

                    // 3. Update Store State
                    set({ projectTodos: currentProjectTodos, hasLoaded: true });

                    // 4. Persist if we did carry-over (or if we just created a blank day but want to mark checked?)
                    // If we modified the log (by merging), we should save.
                    // If needsCarryOver was true, we likely want to save the 'carriedOver: true' flag even if nothing was carried over,
                    // to prevent re-checking every reload? 
                    // Let's safe-guard: if we found yesterday data but it was empty, we can still mark carriedOver=true to avoid repeated lookups.

                    if (needsCarryOver) {
                        // We need to force a save with the flag.
                        // But `saveToIPC` typically takes projectTodos from state or argument.
                        // It doesn't natively support setting extra flags like 'carriedOver' in the existing implementation helper.
                        // We need to modify `saveToIPC` or manually do it here.
                        // Let's look at `saveToIPC` usage.
                        // It does: logs[dateStr] = { ...todayLog, projectTodos };
                        // We want to add carriedOver.

                        // Modification: Manually invoking IPC save here for precision
                        const finalLogs = await (window as any).ipcRenderer.getMonthlyLog(yearMonth);
                        const todayLog = finalLogs[dateStr] || {};
                        finalLogs[dateStr] = {
                            ...todayLog,
                            projectTodos: currentProjectTodos,
                            carriedOver: true
                        };
                        await (window as any).ipcRenderer.saveMonthlyLog({ yearMonth, data: finalLogs });
                    }
                }
            },

            saveTodos: async () => {
                // No-op, we save incrementally
            },

            loadTodosForDate: async (dateStr) => {
                if ((window as any).ipcRenderer) {
                    const yearMonth = dateStr.slice(0, 7);
                    const logs = await (window as any).ipcRenderer.getMonthlyLog(yearMonth);
                    if (logs && logs[dateStr]) {
                        const data = logs[dateStr];
                        if (data.projectTodos) return data.projectTodos;
                        if (data.todos) return { 'none': data.todos };
                    }
                }
                return null;
            },

            carryOverTodos: async (todos, projectId) => {
                const { projectTodos, addToHistory, saveTodos } = get();
                addToHistory();

                const currentTodos = projectTodos[projectId] || [];
                const existingIds = new Set(currentTodos.map(t => t.id));
                const toAdd = todos.filter(t => !existingIds.has(t.id));

                if (toAdd.length === 0) return;

                const newTodos = [...currentTodos, ...toAdd];

                set({
                    projectTodos: { ...projectTodos, [projectId]: newTodos }
                });
                await saveTodos();
            },

            saveFutureTodos: async (date: Date, todosByProject: Record<string, Todo[]>) => {
                if ((window as any).ipcRenderer) {
                    const yearMonth = format(date, 'yyyy-MM');
                    const dateStr = format(date, 'yyyy-MM-dd');
                    const logs = await (window as any).ipcRenderer.getMonthlyLog(yearMonth);
                    const todayLog = logs[dateStr] || {};

                    logs[dateStr] = {
                        ...todayLog,
                        projectTodos: todosByProject
                    };

                    console.log(`[useTodoStore] Saving Future Todos for ${dateStr}`, todosByProject);
                    await (window as any).ipcRenderer.saveMonthlyLog({ yearMonth, data: logs });
                }
            }
        }),
        {
            name: 'todo-storage',
            storage: createJSONStorage(() => sessionStorage),
            partialize: (state) => ({
                projectTodos: state.projectTodos,
                activeProjectId: state.activeProjectId
            }),
        }
    )
);
