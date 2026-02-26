import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type PomodoroMode = 'focus' | 'shortBreak' | 'longBreak';
export type PomodoroStatus = 'idle' | 'running' | 'paused' | 'completed';

export interface PomodoroTask {
    id: string;
    title: string;
    completed: boolean;
    focusCount: number;
    timerMode?: 'pomodoro' | 'stopwatch';
    targetMinutes?: number;
    icon?: string;
}

interface PomodoroState {
    status: PomodoroStatus;
    mode: PomodoroMode;
    tasks: PomodoroTask[];
    activeTaskId: string | null;
    timeLeft: number;
    focusDuration: number;
    shortBreakDuration: number;
    longBreakDuration: number;
    completedPomodoros: number;
    todayTotalFocusTime: number;
    notes: string;

    start: (taskId: string) => void;
    pause: () => void;
    resume: () => void;
    stop: () => void;
    tick: () => void;
    completeSession: () => void;
    setNotes: (notes: string) => void;

    // Task Management
    addTask: (task: Omit<PomodoroTask, 'id' | 'completed' | 'focusCount'>) => void;
    updateTask: (id: string, task: Partial<PomodoroTask>) => void;
    toggleTaskCompletion: (id: string) => void;
    deleteTask: (id: string) => void;
}

const DEFAULT_FOCUS = 25 * 60;
const DEFAULT_SHORT_BREAK = 5 * 60;
const DEFAULT_LONG_BREAK = 15 * 60;

export const usePomodoroStore = create<PomodoroState>()(
    persist(
        (set, get) => ({
            status: 'idle',
            mode: 'focus',
            tasks: [],
            activeTaskId: null,
            timeLeft: DEFAULT_FOCUS,
            focusDuration: DEFAULT_FOCUS,
            shortBreakDuration: DEFAULT_SHORT_BREAK,
            longBreakDuration: DEFAULT_LONG_BREAK,
            completedPomodoros: 0,
            todayTotalFocusTime: 0,
            notes: '',

            start: (taskId) => {
                const task = get().tasks.find(t => t.id === taskId);
                const initialTime = (task?.timerMode === 'pomodoro' && task?.targetMinutes)
                    ? task.targetMinutes * 60
                    : get().focusDuration;

                set({
                    status: 'running',
                    mode: 'focus',
                    activeTaskId: taskId,
                    timeLeft: initialTime,
                    notes: '' // clear notes on new start
                });
            },

            pause: () => set({ status: 'paused' }),

            resume: () => set({ status: 'running' }),

            stop: () => set({
                status: 'idle',
                activeTaskId: null,
                mode: 'focus',
                timeLeft: get().focusDuration
            }),

            tick: () => {
                const { status, timeLeft, mode, completeSession } = get();
                if (status === 'running') {
                    if (timeLeft > 0) {
                        set({ timeLeft: timeLeft - 1 });
                        // Also accumulate focus time if in focus mode
                        if (mode === 'focus') {
                            set(state => ({ todayTotalFocusTime: state.todayTotalFocusTime + 1 }));
                        }
                    } else {
                        completeSession();
                    }
                }
            },

            completeSession: () => {
                const { mode, completedPomodoros } = get();
                if (mode === 'focus') {
                    const newCompleted = completedPomodoros + 1;
                    const nextMode = newCompleted % 4 === 0 ? 'longBreak' : 'shortBreak';

                    // Increment focus count for active task
                    const { activeTaskId, tasks } = get();
                    let newTasks = tasks;
                    if (activeTaskId) {
                        newTasks = tasks.map(t => t.id === activeTaskId ? { ...t, focusCount: t.focusCount + 1 } : t);
                    }

                    set({
                        status: 'idle', // Switch to idle before auto-starting break? Or just wait for user to start break?
                        mode: nextMode,
                        completedPomodoros: newCompleted,
                        timeLeft: nextMode === 'longBreak' ? get().longBreakDuration : get().shortBreakDuration,
                        tasks: newTasks
                    });

                    // Optional: Here we could save the log to the database
                    // Wait, log should be saved to monthly logs ideally, but we can handle that in the component side by listening to completeSession.
                } else {
                    // Finished break, back to focus
                    set({
                        status: 'idle',
                        mode: 'focus',
                        timeLeft: get().focusDuration
                    });
                }
            },

            setNotes: (notes) => set({ notes }),

            addTask: (taskData) => set(state => ({
                tasks: [...state.tasks, {
                    id: crypto.randomUUID(),
                    completed: false,
                    focusCount: 0,
                    ...taskData
                }]
            })),

            updateTask: (id, updates) => set(state => ({
                tasks: state.tasks.map(t => t.id === id ? { ...t, ...updates } : t)
            })),

            toggleTaskCompletion: (id) => set(state => ({
                tasks: state.tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t)
            })),

            deleteTask: (id) => set(state => ({
                tasks: state.tasks.filter(t => t.id !== id),
                activeTaskId: state.activeTaskId === id ? null : state.activeTaskId
            }))
        }),
        {
            name: 'pomodoro-storage',
            partialize: (state) => ({
                completedPomodoros: state.completedPomodoros,
                todayTotalFocusTime: state.todayTotalFocusTime,
                focusDuration: state.focusDuration,
                shortBreakDuration: state.shortBreakDuration,
                longBreakDuration: state.longBreakDuration,
                tasks: state.tasks
            })
        }
    )
);
