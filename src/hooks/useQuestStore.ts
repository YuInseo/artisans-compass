import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Todo } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';

interface QuestStore {
    todos: Todo[];
    streak: number;
    lastCompletedDate: string | null;
    setTodos: (todos: Todo[]) => void;
    addTodo: (text: string) => void;
    toggleTodo: (id: string) => void;
    deleteTodo: (id: string) => void;
}

export const useQuestStore = create<QuestStore>()(
    persist(
        (set, get) => ({
            todos: [],
            streak: 0,
            lastCompletedDate: null,

            setTodos: (todos) => set({ todos }),

            addTodo: (text) => {
                const newId = uuidv4();
                const newNode: Todo = {
                    id: newId,
                    text,
                    completed: false,
                    createdAt: Date.now()
                };
                set({ todos: [...get().todos, newNode] });
            },

            toggleTodo: (id) => {
                const todos = get().todos.map(t =>
                    t.id === id ? { ...t, completed: !t.completed } : t
                );
                set({ todos });
            },

            deleteTodo: (id) => {
                const todos = get().todos.filter(t => t.id !== id);
                set({ todos });
            }
        }),
        {
            name: 'quest-storage', // Distinct persistence key
            storage: createJSONStorage(() => localStorage),
        }
    )
);
