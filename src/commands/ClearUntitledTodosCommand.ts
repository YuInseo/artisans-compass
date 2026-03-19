import { BaseCommand, CommandResult } from '@/core/Command';
import { useTodoStore } from '@/hooks/useTodoStore';

export class ClearUntitledTodosCommand extends BaseCommand<void> {
    id = 'clear-untitled-todos';
    name = 'dashboard.clearUntitled';

    execute(): CommandResult {
        const store = useTodoStore.getState();
        const targetProjectId = store.activeProjectId;

        // We need the previous state to undo this correctly
        const prevTodos = store.projectTodos[targetProjectId] || [];

        store.clearUntitledTodos(targetProjectId);

        return {
            undo: () => {
                // To undo, we just restore the strictly previous state for this project
                const currentStore = useTodoStore.getState();
                currentStore.setTodos(prevTodos, true);
            },
            redo: () => {
                // To redo, we clear them again
                useTodoStore.getState().clearUntitledTodos(targetProjectId);
            }
        };
    }
}
