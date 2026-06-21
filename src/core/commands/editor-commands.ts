import { BaseCommand } from '../Command';
import { useTodoStore } from '@/hooks/useTodoStore';
import { Todo } from '@/types';
import { TodoAddPayload, TodoUpdatePayload, TodoDeletePayload, TodoDeleteBatchPayload, TodoTogglePayload, TodoIndentPayload, TodoMovePayload } from '../../plugins/api';

/**
 * Helper to generate a standardized undo/redo result using state snapshots.
 * We store the exact state of the project's Todo tree before and after the action.
 */
function createSnapshotResult(targetId: string, oldState: Todo[], newState: Todo[]) {
    return {
        undo: async () => {
            useTodoStore.getState().setTodos(oldState, true, targetId, true);
        },
        redo: async () => {
            useTodoStore.getState().setTodos(newState, true, targetId, true);
        }
    };
}

export class AddTodoCommand extends BaseCommand<TodoAddPayload> {
    id = 'cmd.addTodo';
    name = 'Add Todo';

    async execute(payload: TodoAddPayload) {
        const { id, text, parentId = null, afterId = null, projectId } = payload;
        const store = useTodoStore.getState();
        const targetId = projectId || store.activeProjectId;

        const oldState = store.projectTodos[targetId] || [];
        store.addTodo(text, parentId, afterId, targetId, true, id);
        const newState = useTodoStore.getState().projectTodos[targetId] || [];

        return createSnapshotResult(targetId, oldState, newState);
    }
}

export class UpdateTodoCommand extends BaseCommand<TodoUpdatePayload> {
    id = 'cmd.updateTodo';
    name = 'Update Todo';

    async execute(payload: TodoUpdatePayload) {
        const { id, updates, projectId } = payload;
        const store = useTodoStore.getState();
        const targetId = projectId || store.activeProjectId;

        const oldState = store.projectTodos[targetId] || [];
        store.updateTodo(id, updates, true, targetId);
        const newState = useTodoStore.getState().projectTodos[targetId] || [];

        return createSnapshotResult(targetId, oldState, newState);
    }
}

export class DeleteTodoCommand extends BaseCommand<TodoDeletePayload> {
    id = 'cmd.deleteTodo';
    name = 'Delete Todo';

    async execute(payload: TodoDeletePayload) {
        const store = useTodoStore.getState();
        const targetId = payload.projectId || store.activeProjectId;

        const oldState = store.projectTodos[targetId] || [];
        store.deleteTodo(payload.id, targetId, true);
        const newState = useTodoStore.getState().projectTodos[targetId] || [];

        return createSnapshotResult(targetId, oldState, newState);
    }
}

export class DeleteTodosCommand extends BaseCommand<TodoDeleteBatchPayload> {
    id = 'cmd.deleteTodos';
    name = 'Delete Todos (Batch)';

    async execute(payload: TodoDeleteBatchPayload) {
        const store = useTodoStore.getState();
        const targetId = payload.projectId || store.activeProjectId;

        const oldState = store.projectTodos[targetId] || [];
        store.deleteTodos(payload.ids, targetId, true);
        const newState = useTodoStore.getState().projectTodos[targetId] || [];

        return createSnapshotResult(targetId, oldState, newState);
    }
}

export class ToggleTodoCommand extends BaseCommand<TodoTogglePayload> {
    id = 'cmd.toggleTodo';
    name = 'Toggle Todo';

    async execute(payload: TodoTogglePayload) {
        const store = useTodoStore.getState();
        const targetId = payload.projectId || store.activeProjectId;

        const oldState = store.projectTodos[targetId] || [];
        store.toggleTodo(payload.id, targetId, true);
        const newState = useTodoStore.getState().projectTodos[targetId] || [];

        return createSnapshotResult(targetId, oldState, newState);
    }
}

export class IndentTodoCommand extends BaseCommand<TodoIndentPayload> {
    id = 'cmd.indentTodo';
    name = 'Indent Todo';

    async execute(payload: TodoIndentPayload) {
        const store = useTodoStore.getState();
        const targetId = payload.projectId || store.activeProjectId;

        const oldState = store.projectTodos[targetId] || [];
        store.indentTodo(payload.id, targetId, true);
        const newState = useTodoStore.getState().projectTodos[targetId] || [];

        return createSnapshotResult(targetId, oldState, newState);
    }
}

export class UnindentTodoCommand extends BaseCommand<TodoIndentPayload> {
    id = 'cmd.unindentTodo';
    name = 'Unindent Todo';

    async execute(payload: TodoIndentPayload) {
        const store = useTodoStore.getState();
        const targetId = payload.projectId || store.activeProjectId;

        const oldState = store.projectTodos[targetId] || [];
        store.unindentTodo(payload.id, targetId, true);
        const newState = useTodoStore.getState().projectTodos[targetId] || [];

        return createSnapshotResult(targetId, oldState, newState);
    }
}

export class MoveTodosCommand extends BaseCommand<TodoMovePayload> {
    id = 'cmd.moveTodos';
    name = 'Move Todos';

    async execute(payload: TodoMovePayload) {
        const store = useTodoStore.getState();
        const targetId = payload.projectId || store.activeProjectId;

        const oldState = store.projectTodos[targetId] || [];
        store.moveTodos(payload.activeIds, payload.parentId, payload.index, targetId, true);
        const newState = useTodoStore.getState().projectTodos[targetId] || [];

        return createSnapshotResult(targetId, oldState, newState);
    }
}
