import { BaseCommand } from './Command';
import { useCommandStoreInternal } from './useCommandStore';

export interface ICommandManager {
    register<TPayload>(command: BaseCommand<TPayload>): void;
    unregister(commandId: string): void;
    getCommand(commandId: string): BaseCommand<any> | undefined;
    getAllCommands(): BaseCommand<any>[];
    execute<TPayload>(commandId: string, payload?: TPayload): Promise<void>;
}

export class CommandManager implements ICommandManager {
    private commands: Map<string, BaseCommand<any>> = new Map();
    // In SDK mode, the manager directly accesses the internal Zustand store logic
    // through the exposed internal hook, allowing execution to push actions into the history stack.

    register<TPayload>(command: BaseCommand<TPayload>) {
        if (this.commands.has(command.id)) {
            console.warn(`[CommandManager] Command with ID ${command.id} is already registered.`);
        }
        this.commands.set(command.id, command);
    }

    unregister(commandId: string) {
        this.commands.delete(commandId);
    }

    getCommand(commandId: string): BaseCommand<any> | undefined {
        return this.commands.get(commandId);
    }

    getAllCommands(): BaseCommand<any>[] {
        return Array.from(this.commands.values());
    }

    async execute<TPayload>(commandId: string, payload?: TPayload): Promise<void> {
        const command = this.commands.get(commandId);
        if (!command) {
            console.error(`[CommandManager] Command ${commandId} not found.`);
            return;
        }

        try {
            const result = await command.execute(payload);
            // If the command returned a CommandResult (meaning it's undoable), push it
            if (result && typeof result === 'object' && 'undo' in result && 'redo' in result) {
                useCommandStoreInternal.getState().pushAction({
                    ...result,
                    description: command.name
                });
            }
        } catch (error) {
            console.error(`[CommandManager] Error executing command ${commandId}:`, error);
            throw error; // Let caller handle UI feedback (e.g. toasts)
        }
    }
}
