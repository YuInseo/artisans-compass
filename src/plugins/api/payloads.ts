/**
 * Command API Payloads
 * These payloads are explicitly typed for discoverability across the plugin system.
 */

export interface RoutineSavePayload {
    session: any; // Record<string, any>
    originalStart?: number;
}
export interface RoutineDeletePayload {
    id: string;
}

export interface PlanSavePayload {
    session: any; // Record<string, any>
    originalStart?: number;
}
export interface PlanDeletePayload {
    id: string;
    dateKey: string;
}

export interface TodoAddPayload {
    text: string;
    parentId?: string | null;
    afterId?: string | null;
    projectId?: string;
}
export interface TodoUpdatePayload {
    id: string;
    updates: any; // Record<string, any>
    projectId?: string;
}
export interface TodoDeletePayload {
    id: string;
    projectId?: string;
}
export interface TodoTogglePayload {
    id: string;
    projectId?: string;
}
export interface TodoIndentPayload {
    id: string;
    projectId?: string;
}
export interface TodoMovePayload {
    activeIds: string[];
    parentId: string | null;
    index: number;
    projectId?: string;
}
