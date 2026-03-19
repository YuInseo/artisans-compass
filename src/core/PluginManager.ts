import { IArtisansCompassPlugin, IPluginContext } from '../plugins/api';
import { ICommandManager } from './CommandManager';
import { IUIExtensionRegistry } from '../plugins/api';
import { useDataStoreInternal } from '../hooks/useDataStore';

/**
 * Manages the lifecycle of user plugins.
 */
export class PluginManager {
    private plugins: Map<string, IArtisansCompassPlugin> = new Map();
    private context: IPluginContext;

    constructor(
        commandManager: ICommandManager,
        uiRegistry: IUIExtensionRegistry
    ) {
        // Prepare the sandbox/API that plugins will receive upon onLoad
        this.context = {
            commandManager,
            ui: uiRegistry,
            data: {
                getSettings: () => useDataStoreInternal.getState().settings,
                getProjects: () => useDataStoreInternal.getState().projects,
                getDailyLog: (dateStr: string) => useDataStoreInternal.getState().getDailyLog(dateStr),
                subscribe: (listener) => useDataStoreInternal.subscribe(listener)
            }
        };
    }

    /**
     * Loads and initializes a plugin.
     * @param plugin The Plugin object conforming to IArtisansCompassPlugin
     */
    async loadPlugin(plugin: IArtisansCompassPlugin): Promise<void> {
        if (this.plugins.has(plugin.id)) {
            console.warn(`[PluginManager] Plugin ${plugin.id} is already loaded.`);
            return;
        }

        try {
            await plugin.onLoad(this.context);
            this.plugins.set(plugin.id, plugin);
            console.info(`[PluginManager] Successfully loaded plugin: ${plugin.name} (${plugin.id})`);
        } catch (error) {
            console.error(`[PluginManager] Failed to load plugin ${plugin.id}:`, error);
        }
    }

    /**
     * Unloads a plugin.
     */
    async unloadPlugin(pluginId: string): Promise<void> {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) return;

        try {
            if (plugin.onUnload) {
                await plugin.onUnload();
            }
            this.plugins.delete(pluginId);
            console.info(`[PluginManager] Unloaded plugin: ${plugin.name} (${plugin.id})`);
        } catch (error) {
            console.error(`[PluginManager] Error while unloading plugin ${pluginId}:`, error);
        }
    }
}
