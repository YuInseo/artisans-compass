import { BaseCommand, CommandResult } from '@/core/Command';
import { useTodoStore } from '@/hooks/useTodoStore';

export class ToggleImageCollapseCommand extends BaseCommand<boolean> {
    id = 'toggle-image-collapse';
    name = 'dashboard.toggleImageCollapse'; // Replace with whatever you like

    execute(isCollapsed: boolean): CommandResult {
        const store = useTodoStore.getState();
        const targetProjectId = store.activeProjectId;

        // Execute the action
        store.toggleAllImagesCollapse(isCollapsed, targetProjectId);

        return {
            undo: () => {
                // Revert
                useTodoStore.getState().toggleAllImagesCollapse(!isCollapsed, targetProjectId);
            },
            redo: () => {
                // Re-apply
                useTodoStore.getState().toggleAllImagesCollapse(isCollapsed, targetProjectId);
            }
        };
    }
}
