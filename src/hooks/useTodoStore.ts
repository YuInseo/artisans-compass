import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Todo } from '@/types';
import { format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';

interface TodoStore {
    projectTodos: Record<string, Todo[]>;
    activeProjectId: string;
    previousDayTodos: Record<string, Todo[]>; // For carryover
    hasLoaded: boolean;

    // Actions
    setActiveProjectId: (id: string) => void;
    setTodos: (todos: Todo[], shouldSave?: boolean) => void;
    addTodo: (text: string, parentId?: string | null, afterId?: string | null, targetProjectId?: string) => string;
    updateTodo: (id: string, updates: Partial<Todo>, skipHistory?: boolean, targetProjectId?: string) => void;
    deleteTodo: (id: string, targetProjectId?: string) => void;
    deleteTodos: (ids: string[], targetProjectId?: string) => void;
    updateTodoText: (id: string, text: string, skipHistory?: boolean, targetProjectId?: string) => void;
    toggleTodo: (id: string, targetProjectId?: string) => void;
    toggleCollapse: (id: string, targetProjectId?: string) => void;

    // Tree Actions
    indentTodo: (id: string, targetProjectId?: string) => void;
    unindentTodo: (id: string, targetProjectId?: string) => void;
    moveTodo: (activeId: string, parentId: string | null, index: number, targetProjectId?: string) => void;
    moveTodos: (activeIds: string[], parentId: string | null, index: number, targetProjectId?: string) => void;
    clearUntitledTodos: (targetProjectId?: string) => void;

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

// Debounce helper
function debounce<T extends (...args: any[]) => void>(func: T, wait: number): T {
    let timeout: NodeJS.Timeout;
    return function (this: any, ...args: Parameters<T>) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    } as T;
}

// Helper to save to IPC
const existingSaveToIPC = async (projectTodos: Record<string, Todo[]>) => {
    if ((window as any).ipcRenderer) {
        const now = new Date();
        const yearMonth = format(now, 'yyyy-MM');
        const dateStr = format(now, 'yyyy-MM-dd');

        try {
            const logs = await (window as any).ipcRenderer.getMonthlyLog(yearMonth);
            const todayLog = logs[dateStr] || {};

            logs[dateStr] = {
                ...todayLog,
                projectTodos
            };
            await (window as any).ipcRenderer.saveMonthlyLog({ yearMonth, data: logs });
        } catch (e) {
            console.error("Failed to save todos to IPC", e);
        }
    }
};

const saveToIPC = debounce(existingSaveToIPC, 2000);

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
        // If not found, append? Or fallback to children check? 
        // Original logic: "return list.map..." implying recursive check if not found at top level?
        // Wait, "parentId === null" means insert at top level. 
        // If "afterId" is not found in top level, should we look deeper?
        // The original logic did: "return list.map..." 
        // This implies "parentId === null" really means "Parent is ROOT, but afterId might be anywhere?"
        // No, typically parentId=null means Root.
        // Let's keep original logic structure but optimize.

        let hasChanges = false;
        const mapped = list.map(item => {
            if (item.children) {
                const newChildren = insertNode(item.children, null, afterId, newNode);
                if (newChildren !== item.children) {
                    hasChanges = true;
                    return { ...item, children: newChildren };
                }
            }
            return item;
        });
        return hasChanges ? mapped : list;
    }

    // parentId is set
    let hasChanges = false;
    const mapped = list.map(item => {
        if (item.id === parentId) {
            hasChanges = true;
            let newChildren = item.children || [];
            if (afterId === parentId) {
                newChildren = [newNode, ...newChildren];
            } else if (afterId) {
                const idx = newChildren.findIndex(c => c.id === afterId);
                if (idx !== -1) {
                    const copy = [...newChildren];
                    copy.splice(idx + 1, 0, newNode);
                    newChildren = copy;
                } else {
                    newChildren = [...newChildren, newNode];
                }
            } else {
                newChildren = [...newChildren, newNode];
            }
            return { ...item, children: newChildren, isCollapsed: false };
        }

        if (item.children) {
            const newChildren = insertNode(item.children, parentId, afterId, newNode);
            if (newChildren !== item.children) {
                hasChanges = true;
                return { ...item, children: newChildren };
            }
        }
        return item;
    });
    return hasChanges ? mapped : list;
};

export const updateNode = (list: Todo[], id: string, updates: Partial<Todo>): Todo[] => {
    let hasChanges = false;
    const newList = list.map(item => {
        if (item.id === id) {
            hasChanges = true;
            return { ...item, ...updates };
        }
        if (item.children) {
            const newChildren = updateNode(item.children, id, updates);
            if (newChildren !== item.children) {
                hasChanges = true;
                return { ...item, children: newChildren };
            }
        }
        return item;
    });
    return hasChanges ? newList : list;
};

// Helper for deleteNode
const deleteNodeRecursive = (list: Todo[], id: string): { nodes: Todo[], changed: boolean } => {
    let changed = false;
    const newNodes = list.reduce((acc: Todo[], item) => {
        if (item.id === id) {
            changed = true;
            return acc;
        }
        if (item.children) {
            const result = deleteNodeRecursive(item.children, id);
            if (result.changed) {
                changed = true;
                acc.push({ ...item, children: result.nodes });
                return acc;
            }
        }
        acc.push(item);
        return acc;
    }, [] as Todo[]);
    return { nodes: newNodes, changed };
};

export const deleteNode = (list: Todo[], id: string): Todo[] => {
    const { nodes, changed } = deleteNodeRecursive(list, id);
    return changed ? nodes : list;
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

    let hasChanges = false;
    const mapped = list.map(item => {
        if (item.children) {
            const newChildren = indentNode(item.children, id);
            if (newChildren !== item.children) {
                hasChanges = true;
                return { ...item, children: newChildren };
            }
        }
        return item;
    });
    return hasChanges ? mapped : list;
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
                // Optimization: Store reference instead of Deep Clone.
                // Since all updates (insertNode, updateNode, etc.) are immutable, the old 'projectTodos' ref represents the snapshot.
                const newHistory = [...history, projectTodos];
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

            addTodo: (text, parentId = null, afterId = null, targetProjectId) => {
                get().addToHistory();
                const newId = uuidv4();
                const newNode: Todo = { id: newId, text, completed: false, children: [] };

                const { activeProjectId, projectTodos } = get();
                const projectIdToUse = targetProjectId || activeProjectId;
                const currentTodos = projectTodos[projectIdToUse] || [];

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

                const newProjectTodos = { ...projectTodos, [projectIdToUse]: nextTodos };
                set({ projectTodos: newProjectTodos });
                saveToIPC(newProjectTodos);
                return newId;
            },

            updateTodo: (id, updates, skipHistory = false, targetProjectId) => {
                if (!skipHistory) get().addToHistory();
                const { activeProjectId, projectTodos } = get();
                const projectIdToUse = targetProjectId || activeProjectId;
                const currentTodos = projectTodos[projectIdToUse] || [];

                const nextTodos = updateNode(currentTodos, id, updates);
                const newProjectTodos = { ...projectTodos, [projectIdToUse]: nextTodos };

                set({ projectTodos: newProjectTodos });
                saveToIPC(newProjectTodos);
            },

            deleteTodo: (id, targetProjectId) => {
                get().deleteTodos([id], targetProjectId);
            },

            deleteTodos: (ids, targetProjectId) => {
                get().addToHistory();
                const { activeProjectId, projectTodos } = get();
                const projectIdToUse = targetProjectId || activeProjectId;
                const currentTodos = projectTodos[projectIdToUse] || [];

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
                const newProjectTodos = { ...projectTodos, [projectIdToUse]: nextTodos };

                set({ projectTodos: newProjectTodos });
                saveToIPC(newProjectTodos);
            },

            updateTodoText: (id, text, skipHistory = false, targetProjectId) => {
                get().updateTodo(id, { text }, skipHistory, targetProjectId);
            },

            toggleTodo: (id, targetProjectId) => {
                get().addToHistory();
                const { activeProjectId, projectTodos } = get();
                const projectIdToUse = targetProjectId || activeProjectId;
                const currentTodos = projectTodos[projectIdToUse] || [];

                const toggleNode = (list: Todo[]): Todo[] => {
                    return list.map(item => {
                        if (item.id === id) return { ...item, completed: !item.completed };
                        if (item.children) return { ...item, children: toggleNode(item.children) };
                        return item;
                    });
                };

                const newTodos = toggleNode(currentTodos);
                const newProjectTodos = { ...projectTodos, [projectIdToUse]: newTodos };
                set({ projectTodos: newProjectTodos });
                saveToIPC(newProjectTodos);
            },

            toggleCollapse: (id, targetProjectId) => {
                get().addToHistory();
                const { activeProjectId, projectTodos } = get();
                const projectIdToUse = targetProjectId || activeProjectId;
                const currentTodos = projectTodos[projectIdToUse] || [];

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
                const newProjectTodos = { ...projectTodos, [projectIdToUse]: newTodos };
                set({ projectTodos: newProjectTodos });
                saveToIPC(newProjectTodos);
            },

            indentTodo: (id, targetProjectId) => {
                get().addToHistory();
                const { activeProjectId, projectTodos } = get();
                const projectIdToUse = targetProjectId || activeProjectId;
                const currentTodos = projectTodos[projectIdToUse] || [];
                const nextTodos = indentNode(currentTodos, id);
                set({ projectTodos: { ...projectTodos, [projectIdToUse]: nextTodos } });
                saveToIPC({ ...projectTodos, [projectIdToUse]: nextTodos });
            },

            unindentTodo: (id, targetProjectId) => {
                get().addToHistory();
                const { activeProjectId, projectTodos } = get();
                const projectIdToUse = targetProjectId || activeProjectId;
                const currentTodos = projectTodos[projectIdToUse] || [];
                const nextTodos = unindentNode(currentTodos, id);
                set({ projectTodos: { ...projectTodos, [projectIdToUse]: nextTodos } });
                saveToIPC({ ...projectTodos, [projectIdToUse]: nextTodos });
            },

            clearUntitledTodos: (targetProjectId) => {
                get().addToHistory();
                const { activeProjectId, projectTodos } = get();
                const projectIdToUse = targetProjectId || activeProjectId;
                const currentTodos = projectTodos[projectIdToUse] || [];

                const filterEmpty = (list: Todo[]): Todo[] => {
                    return list.filter(t => {
                        if (t.text.trim() === '') return false;
                        if (t.children) t.children = filterEmpty(t.children);
                        return true;
                    });
                };

                const newTodos = filterEmpty(currentTodos);
                set({ projectTodos: { ...projectTodos, [projectIdToUse]: newTodos } });
                saveToIPC({ ...projectTodos, [projectIdToUse]: newTodos });
            },

            moveTodo: (activeId: string, parentId: string | null, index: number, targetProjectId?: string) => {
                get().moveTodos([activeId], parentId, index, targetProjectId);
            },

            moveTodos: (activeIds: string[], parentId: string | null, index: number, targetProjectId?: string) => {
                get().addToHistory();
                const { activeProjectId, projectTodos } = get();
                const projectIdToUse = targetProjectId || activeProjectId;
                const currentTodos = projectTodos[projectIdToUse] || [];

                const nextTodos = moveNodes(currentTodos, activeIds, parentId, index);

                set({ projectTodos: { ...projectTodos, [projectIdToUse]: nextTodos } });
                saveToIPC({ ...projectTodos, [projectIdToUse]: nextTodos });
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
                        // User Request: "Only todos added in the 2nd modal (Closing Ritual) should be carried over."
                        // We do NOT merge yesterday's leftovers anymore. We strictly use what's in the log (planned) or start empty.
                        console.log("[useTodoStore] Auto carry-over DISABLED by user request.");
                    }

                    // 3. Update Store State
                    set({ projectTodos: currentProjectTodos, hasLoaded: true });

                    // 4. Ensure day log entry exists (even if empty) to prevent re-checks or issues
                    if (needsCarryOver || !logs[dateStr]) {
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

                let currentTodos = projectTodos[projectId] || [];

                // Filter out empty placeholder tasks (text is empty and no children)
                // This prevents the "New task" created by TodoEditor auto-init from staying at the top
                currentTodos = currentTodos.filter(t => t.text.trim() !== '' || (t.children && t.children.length > 0));

                const existingIds = new Set(currentTodos.map(t => t.id));
                const toAdd = todos.filter(t => !existingIds.has(t.id));

                if (toAdd.length === 0 && currentTodos.length === (projectTodos[projectId] || []).length) return;

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
