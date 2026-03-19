import { Project, AppSettings } from '../../types';

export interface IArtisansDataAPI {
    /**
     * Get the current application settings.
     */
    getSettings(): AppSettings | null;

    /**
     * Get all projects (todos/tasks).
     */
    getProjects(): Project[];

    /**
     * Get the daily log for a specific date string (YYYY-MM-DD).
     */
    getDailyLog(dateStr: string): Promise<any | null>;

    /**
     * Start listening to store changes. Useful for reacting to data updates.
     * @param listener A callback that fires when the state changes.
     * @returns An unsubscribe function.
     */
    subscribe(listener: (state: any, prevState: any) => void): () => void;
}
