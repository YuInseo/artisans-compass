import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

export type NotificationType = 'success' | 'error' | 'info' | 'warning' | 'default';

export interface Notification {
    id: string;
    title: string;
    description?: string;
    timestamp: number;
    type: NotificationType;
    read: boolean;
}

interface NotificationStore {
    notifications: Notification[];
    unreadCount: number;

    addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
    markAsRead: (id: string) => void;
    markAllAsRead: () => void;
    clearAll: () => void;
    removeNotification: (id: string) => void;
}

export const useNotificationStore = create<NotificationStore>()(
    persist(
        (set) => ({
            notifications: [],
            unreadCount: 0,

            addNotification: (data) =>
                set((state) => {
                    const newNotification: Notification = {
                        id: uuidv4(),
                        timestamp: Date.now(),
                        read: false,
                        ...data,
                    };
                    return {
                        notifications: [newNotification, ...state.notifications].slice(0, 50), // Keep last 50
                        unreadCount: state.unreadCount + 1,
                    };
                }),

            markAsRead: (id) =>
                set((state) => {
                    const notification = state.notifications.find((n) => n.id === id);
                    if (!notification || notification.read) return state;

                    return {
                        notifications: state.notifications.map((n) =>
                            n.id === id ? { ...n, read: true } : n
                        ),
                        unreadCount: Math.max(0, state.unreadCount - 1),
                    };
                }),

            markAllAsRead: () =>
                set((state) => ({
                    notifications: state.notifications.map((n) => ({ ...n, read: true })),
                    unreadCount: 0,
                })),

            clearAll: () => set({ notifications: [], unreadCount: 0 }),

            removeNotification: (id) =>
                set((state) => {
                    const notification = state.notifications.find((n) => n.id === id);
                    // If we remove an unread one, decrement count
                    const decrement = notification && !notification.read ? 1 : 0;
                    return {
                        notifications: state.notifications.filter((n) => n.id !== id),
                        unreadCount: Math.max(0, state.unreadCount - decrement),
                    };
                }),
        }),
        {
            name: 'notification-storage',
        }
    )
);
