

/**
 * A CommandResult represents an action that has been executed and can be undone/redone.
 * This is what gets pushed to the history stack.
 */
export interface CommandResult {
    undo: () => void | Promise<void>;
    redo: () => void | Promise<void>;
}

/**
 * BaseCommand is the blueprint for any action/plugin in the app.
 * Commands should ideally be stateless singletons.
 */
export abstract class BaseCommand<TPayload = void> {
    abstract readonly id: string;
    abstract readonly name: string; // e.g. "Toggle Image Collapse" or an i18n key

    /**
     * Optional icon for the command
     */
    readonly icon?: React.ReactNode;

    /**
     * Executes the command.
     * @param payload Optional data required for execution
     * @returns A CommandResult if the action supports undo/redo, otherwise void.
     */
    abstract execute(payload: TPayload): CommandResult | void | Promise<CommandResult | void>;
}
