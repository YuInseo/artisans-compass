import { ICommandManager } from '../../core/CommandManager';
import { IUIExtensionRegistry } from './ui';
import { IArtisansDataAPI } from './data';

export interface IPluginContext {
    /**
     * The command registry where actions can be registered and executed.
     */
    commandManager: ICommandManager;
    /**
     * The interface for registering UI extensions (settings tabs, sidebar buttons).
     */
    ui: IUIExtensionRegistry;
    /**
     * Provides read-only access to application data and state subscriptions.
     */
    data: IArtisansDataAPI;
}

export interface IArtisansCompassPlugin {
    /**
     * Unique identifier for the plugin (e.g. `com.example.myplugin`)
     */
    id: string;
    /**
     * Human-readable plugin name
     */
    name: string;
    /**
     * Optional version string
     */
    version?: string;

    /**
     * Called when the plugin is loaded by the core engine.
     * @param context Provides access to the SDK APIs.
     */
    onLoad(context: IPluginContext): void | Promise<void>;

    /**
     * Called when the plugin is being disabled or the app is shutting down.
     */
    onUnload?(): void | Promise<void>;
}

export interface IPluginManifest {
    id: string;
    name: string;
    version: string;
    description: string;
    author?: string;
    main?: string;
    dirName?: string;
    code?: string; // Loaded from the main file
}
