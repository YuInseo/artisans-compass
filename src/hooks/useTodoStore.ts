import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Todo } from '@/types';
import { format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';

interface TodoStore {
    projectTodos: Record<string, Todo[]>;
    activeProjectId: string;

    // Derived selector helper (optional, but useful for components)
    // We can't really do "computed" in the interface, but we can assume consumers select it.

    // Actions
    setActiveProjectId: (id: string) => void;
    setTodos: (todos: Todo[], shouldSave?: boolean) => void;
    addTodo: (text: string, parentId?: string | null, afterId?: string | null) => string;
    updateTodo: (id: string, updates: Partial<Todo>) => void;
    deleteTodo: (id: string) => void;

    // Tree Actions
    indentTodo: (id: string) => void;
    unindentTodo: (id: string) => void;
    moveTodo: (activeId: string, overId: string) => void;

    // Persistence
    loadTodos: () => Promise<void>;
    saveTodos: () => Promise<void>;
}

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
            projectTodos // Save the whole map
        };
        await (window as any).ipcRenderer.saveMonthlyLog({ yearMonth, data: logs });
    }
};

// --- Helpers (Same as before) ---
const insertNode = (list: Todo[], parentId: string | null, afterId: string | null, newNode: Todo): Todo[] => {
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

const updateNode = (list: Todo[], id: string, updates: Partial<Todo>): Todo[] => {
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

const deleteNode = (list: Todo[], id: string): Todo[] => {
    return list.filter(item => {
        if (item.id === id) return false;
        if (item.children) item.children = deleteNode(item.children, id);
        return true;
    });
};

const indentNode = (list: Todo[], id: string): Todo[] => {
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

const unindentNode = (list: Todo[], id: string): Todo[] => {
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

// --- Store Creation ---

export const useTodoStore = create<TodoStore>()(
    persist(
        (set, get) => ({
            projectTodos: {},
            activeProjectId: 'none',

            setActiveProjectId: (id) => set({ activeProjectId: id }),

            setTodos: (todos, shouldSave = true) => {
                const { activeProjectId, projectTodos } = get();
                const newProjectTodos = { ...projectTodos, [activeProjectId]: todos };
                set({ projectTodos: newProjectTodos });
                if (shouldSave) saveToIPC(newProjectTodos);
            },

            addTodo: (text, parentId = null, afterId = null) => {
                const newId = uuidv4();
                const newNode: Todo = { id: newId, text, completed: false, children: [] };

                const { activeProjectId, projectTodos } = get();
                const currentTodos = projectTodos[activeProjectId] || [];

                let nextTodos: Todo[];

                if (currentTodos.length === 0) {
                    nextTodos = [newNode];
                } else if (parentId) {
                    nextTodos = insertNode(currentTodos, parentId, null, newNode);
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

            updateTodo: (id, updates) => {
                const { activeProjectId, projectTodos } = get();
                const currentTodos = projectTodos[activeProjectId] || [];

                const nextTodos = updateNode(currentTodos, id, updates);
                const newProjectTodos = { ...projectTodos, [activeProjectId]: nextTodos };

                set({ projectTodos: newProjectTodos });
                saveToIPC(newProjectTodos);
            },

            deleteTodo: (id) => {
                const { activeProjectId, projectTodos } = get();
                const currentTodos = projectTodos[activeProjectId] || [];

                const nextTodos = deleteNode(currentTodos, id);
                const newProjectTodos = { ...projectTodos, [activeProjectId]: nextTodos };

                set({ projectTodos: newProjectTodos });
                saveToIPC(newProjectTodos);
            },

            indentTodo: (id) => {
                const { activeProjectId, projectTodos } = get();
                const currentTodos = projectTodos[activeProjectId] || [];

                const nextTodos = indentNode(currentTodos, id);
                const newProjectTodos = { ...projectTodos, [activeProjectId]: nextTodos };

                set({ projectTodos: newProjectTodos });
                saveToIPC(newProjectTodos);
            },

            unindentTodo: (id) => {
                const { activeProjectId, projectTodos } = get();
                const currentTodos = projectTodos[activeProjectId] || [];

                const nextTodos = unindentNode(currentTodos, id);
                const newProjectTodos = { ...projectTodos, [activeProjectId]: nextTodos };

                set({ projectTodos: newProjectTodos });
                saveToIPC(newProjectTodos);
            },

            moveTodo: (activeId, overId) => {
                // Keep implementation minimal for now
            },

            loadTodos: async () => {
                if ((window as any).ipcRenderer) {
                    const now = new Date();
                    const yearMonth = format(now, 'yyyy-MM');
                    const dateStr = format(now, 'yyyy-MM-dd');
                    const logs = await (window as any).ipcRenderer.getMonthlyLog(yearMonth);

                    if (logs && logs[dateStr]) {
                        // Migration Logic: Check if it has 'projectTodos', otherwise use 'todos' as default 'none'
                        if (logs[dateStr].projectTodos) {
                            set({ projectTodos: logs[dateStr].projectTodos });
                        } else if (logs[dateStr].todos) {
                            // Legacy format migration
                            set({
                                projectTodos: { 'none': logs[dateStr].todos },
                                activeProjectId: 'none'
                            });
                        }
                    }
                }
            },

            saveTodos: async () => {
                await saveToIPC(get().projectTodos);
            }
        }),
        {
            name: 'todo-storage',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({
                projectTodos: state.projectTodos,
                activeProjectId: state.activeProjectId
            }),
        }
    )
);
