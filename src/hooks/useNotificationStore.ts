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
    count?: number; // Added for grouping
}

interface NotificationStore {
    notifications: Notification[];
    unreadCount: number;

    addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read' | 'count'>) => void;
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
                    // Check for recent duplicate (within 1 minute)
                    const now = Date.now();
                    const duplicateIndex = state.notifications.findIndex(n =>
                        n.title === data.title &&
                        n.description === data.description &&
                        n.type === data.type &&
                        !n.read && // Only group with unread
                        (now - n.timestamp < 60000) // Within 60 seconds
                    );

                    if (duplicateIndex !== -1) {
                        const updatedNotifications = [...state.notifications];
                        const existing = updatedNotifications[duplicateIndex];

                        // Move to top and increment count
                        updatedNotifications.splice(duplicateIndex, 1);
                        updatedNotifications.unshift({
                            ...existing,
                            timestamp: now,
                            count: (existing.count || 1) + 1,
                            read: false // Ensure it stays unread if it was somehow read? Logic says we only group unread, so it's fine.
                        });

                        return {
                            notifications: updatedNotifications,
                            // unreadCount doesn't increase for grouped notifications as it's the "same" issue re-occurring?
                            // Or should it? Usually grouping implies "1 item with count x".
                            // If I have 1 unread item (x1), unreadCount is 1.
                            // If it becomes (x2), unreadCount should still be 1 (representing distinct threads).
                            // Let's keep unreadCount as is.
                            unreadCount: state.unreadCount,
                        };
                    }

                    const newNotification: Notification = {
                        id: uuidv4(),
                        timestamp: now,
                        read: false,
                        count: 1,
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
