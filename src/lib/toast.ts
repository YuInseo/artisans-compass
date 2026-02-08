import { toast as sonnerToast, ExternalToast } from "sonner";
import { useNotificationStore } from "@/hooks/useNotificationStore";
import { NotificationType } from "@/hooks/useNotificationStore";

// Helper to add to store
const addToStore = (message: string | React.ReactNode, data?: ExternalToast, type: NotificationType = 'default') => {
    // Only store string messages for history to avoid serializing React nodes
    const title = typeof message === 'string' ? message : 'Notification';
    const description = typeof data?.description === 'string' ? data.description : undefined;

    useNotificationStore.getState().addNotification({
        title,
        description,
        type,
    });
};

export const toast = (message: string | React.ReactNode, data?: ExternalToast) => {
    addToStore(message, data, 'default');
    return sonnerToast(message, data);
};

toast.success = (message: string | React.ReactNode, data?: ExternalToast) => {
    addToStore(message, data, 'success');
    return sonnerToast.success(message, data);
};

toast.error = (message: string | React.ReactNode, data?: ExternalToast) => {
    addToStore(message, data, 'error');
    return sonnerToast.error(message, data);
};

toast.info = (message: string | React.ReactNode, data?: ExternalToast) => {
    addToStore(message, data, 'info');
    return sonnerToast.info(message, data);
};

toast.warning = (message: string | React.ReactNode, data?: ExternalToast) => {
    addToStore(message, data, 'warning');
    return sonnerToast.warning(message, data);
};

toast.message = (message: string | React.ReactNode, data?: ExternalToast) => {
    addToStore(message, data, 'default');
    return sonnerToast.message(message, data);
};

toast.loading = (message: string | React.ReactNode, data?: ExternalToast) => {
    // We optionally log loading states, or skip them if they are transient.
    // Let's log them as 'info' for now, or just pass through.
    // Users usually want history of "completed" actions, but "starting" might be noise.
    // Let's NOT log loading by default to keep history clean, or log as 'info'.
    // User requested "history of toasts", usually meaning alerts.
    // I'll skip logging loading state to store to avoid spamming "Creating..." "Downloading..."
    return sonnerToast.loading(message, data);
};

toast.promise = sonnerToast.promise;
toast.dismiss = sonnerToast.dismiss;
toast.custom = sonnerToast.custom;
