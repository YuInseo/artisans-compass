// @refresh reset
import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { CommandManager, ICommandManager } from './CommandManager';
import { useCommandStore } from './useCommandStore';
import { PluginManager } from './PluginManager';
import { UIRegistry, useUIRegistryStore } from './UIRegistry';
import { useDataStoreInternal } from '../hooks/useDataStore';
import * as ArtisansAPI from '../plugins/api';
import { initTypingRecorder } from '../lib/typing-recorder';
import { touchProfile } from '../lib/firestore-sync';
import { ensureSignedIn } from '../lib/firebase';
import * as LucideReact from 'lucide-react';
import { PluginSDKContext, IArtisansCompassPlugin } from '../plugins/api';

// Core Commands
import { SaveRoutineCommand, DeleteRoutineCommand } from './commands/routine-commands';
import { SavePlanCommand, DeletePlanCommand } from './commands/plan-commands';
import {
    AddTodoCommand,
    UpdateTodoCommand,
    DeleteTodoCommand,
    DeleteTodosCommand,
    ToggleTodoCommand,
    IndentTodoCommand,
    UnindentTodoCommand,
    MoveTodosCommand
} from './commands/editor-commands';

// We define the strict interface that the rest of the application is allowed to see.
export interface ArtisansCompassAPI {
    commandManager: ICommandManager;
    pluginManager: PluginManager;
    undo: () => Promise<void>;
    redo: () => Promise<void>;
    canUndo: boolean;
    canRedo: boolean;
    lastActionTime: number;
}

const ArtisansCompassContext = createContext<ArtisansCompassAPI | null>(null);

export type PluginWithComponent = (IArtisansCompassPlugin & { component?: React.FC<any> }) | React.FC<any>;

export type UseArtisansConfig = {
    plugins?: PluginWithComponent[];
} | PluginWithComponent;

/**
 * An opaque engine instance representing the core of Artisans Compass.
 * Implementation details are intentionally hidden from 3rd-party developers.
 */
export interface IArtisansEngine {
    readonly _isArtisansCompassEngine: true;
}

export const useArtisans = (config?: UseArtisansConfig): IArtisansEngine => {
    // 1. Initialize Singletons once for the lifecycle of the Provider
    const commandManager = useMemo(() => new CommandManager(), []);
    const uiRegistry = useMemo(() => new UIRegistry(), []);
    const pluginManager = useMemo(() => new PluginManager(commandManager, uiRegistry), [commandManager, uiRegistry]);

    // Track the initial config to prevent infinite re-renders if an inline object is passed
    const initialConfigRef = React.useRef(config);

    // 2. Safely bridge necessary reactive state from the internal store
    const undo = useCommandStore((state) => state.undo);
    const redo = useCommandStore((state) => state.redo);
    const historyLength = useCommandStore((state) => state.history.length);
    const futureLength = useCommandStore((state) => state.future.length);
    const lastActionTime = useCommandStore((state) => state.lastActionTime);

    // 2.5 Keep track of dynamically loaded JSX plugin components
    const [jsxPlugins, setJsxPlugins] = React.useState<React.FC[]>([]);

    // 3. Optional: Core Initialization Logic
    // Here we register default core commands and load the TestPlugin when the provider mounts
    useEffect(() => {
        // Cloud sync bootstrap: anonymous sign-in + start typing recorder.
        ensureSignedIn()
            .then(() => {
                initTypingRecorder();
                touchProfile().catch((e) => console.warn('[cloud] touchProfile failed', e));
            })
            .catch((e) => console.warn('[cloud] sign-in failed', e));

        // Register core commands
        const coreCommands: any[] = [
            new SaveRoutineCommand(),
            new DeleteRoutineCommand(),
            new SavePlanCommand(),
            new DeletePlanCommand(),
            new AddTodoCommand(),
            new UpdateTodoCommand(),
            new DeleteTodoCommand(),
            new DeleteTodosCommand(),
            new ToggleTodoCommand(),
            new IndentTodoCommand(),
            new UnindentTodoCommand(),
            new MoveTodosCommand()
        ];
        coreCommands.forEach(cmd => commandManager.register(cmd));

        // Load explicitly provided plugins via initial config
        const initialConfig = initialConfigRef.current;
        if (initialConfig) {
            const pluginsToLoad: PluginWithComponent[] = [];

            if ('plugins' in initialConfig && Array.isArray(initialConfig.plugins)) {
                pluginsToLoad.push(...initialConfig.plugins);
            } else if ('id' in initialConfig) {
                pluginsToLoad.push(initialConfig as PluginWithComponent);
            }

            pluginsToLoad.forEach(plugin => {
                if (typeof plugin === 'function') {
                    // It's a top-level React Component plugin
                    setJsxPlugins(prev => {
                        if (prev.includes(plugin as any)) return prev;
                        return [...prev, plugin as any];
                    });
                } else {
                    pluginManager.loadPlugin(plugin);
                    // If it has an embedded component, mount it
                    if ((plugin as any).component) {
                        setJsxPlugins(prev => {
                            if (prev.includes((plugin as any).component)) return prev;
                            return [...prev, (plugin as any).component];
                        });
                    }
                }
            });
        }

        // Dynamically load plugins from ProgramData
        const loadPlugins = async () => {
            if ((window as any).ipcRenderer) {
                try {
                    const settings = await (window as any).ipcRenderer.invoke('get-settings');
                    const enabledPlugins = settings.enabledPlugins || [];

                    if (enabledPlugins.length > 0) {
                        const allPlugins = await (window as any).ipcRenderer.invoke('get-plugins');
                        const pluginsToLoad = allPlugins.filter((p: any) => enabledPlugins.includes(p.id));

                        for (const manifest of pluginsToLoad) {
                            if (manifest.code) {
                                try {
                                    const exports = {};
                                    const module = { exports };

                                    // Execute the plugin code in a simple CommonJS-like sandbox
                                    const customRequire = (moduleName: string) => {
                                        if (moduleName === 'react') return React;
                                        if (moduleName === 'lucide-react') return LucideReact;
                                        if (moduleName === 'artisans-compass/api' || moduleName === './api') return ArtisansAPI;
                                        throw new Error(`Cannot require module: ${moduleName}`);
                                    };

                                    const fn = new Function('module', 'exports', 'require', 'React', manifest.code);
                                    fn(module, exports, customRequire, React);

                                    const exported = module.exports as any;
                                    const PluginClass = exported.default || exported;

                                    if (PluginClass) {
                                        let pluginInstance: any;
                                        let jsxComponent = null;

                                        if (PluginClass.component) {
                                            // Object export
                                            pluginInstance = PluginClass;
                                            jsxComponent = PluginClass.component;
                                        } else if (typeof PluginClass === 'function') {
                                            // Check if it's a legacy class (has prototype with onLoad)
                                            if (PluginClass.prototype && PluginClass.prototype.onLoad) {
                                                pluginInstance = new PluginClass();
                                                jsxComponent = pluginInstance.component;
                                            } else {
                                                // Pure React Component export
                                                pluginInstance = {
                                                    id: manifest.id,
                                                    name: manifest.name,
                                                    version: manifest.version,
                                                    onLoad: () => { /* Lifecycle handled internally by useArtisansCompass hook */ }
                                                };
                                                jsxComponent = PluginClass;
                                            }
                                        } else {
                                            pluginInstance = PluginClass;
                                        }

                                        // Ensure basic metadata is fallback-attached from manifest if missing
                                        pluginInstance.id = pluginInstance.id || manifest.id;
                                        pluginInstance.name = pluginInstance.name || manifest.name;
                                        pluginInstance.version = pluginInstance.version || manifest.version;

                                        pluginManager.loadPlugin(pluginInstance);

                                        if (jsxComponent) {
                                            setJsxPlugins(prev => [...prev, jsxComponent]);
                                        }
                                    }
                                } catch (err) {
                                    console.error(`[PluginLoader] Failed to execute plugin code for ${manifest.name}:`, err);
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.error("[PluginLoader] Failed to load dynamic plugins:", e);
                }
            }
        };

        loadPlugins();

        return () => {
            // Cleanup if needed
        };
    }, [pluginManager, commandManager]);

    // 4. Construct the public API
    const api: ArtisansCompassAPI = useMemo(() => ({
        commandManager,
        pluginManager,
        undo,
        redo,
        canUndo: historyLength > 0,
        canRedo: futureLength > 0,
        lastActionTime
    }), [commandManager, pluginManager, undo, redo, historyLength, futureLength, lastActionTime]);

    // Construct the context needed for Plugins bridging via JSX
    const pluginSdkContextValue = useMemo(() => ({
        commandManager,
        ui: uiRegistry,
        data: {
            getSettings: () => useDataStoreInternal.getState().settings,
            getProjects: () => useDataStoreInternal.getState().projects,
            getDailyLog: (dateStr: string) => useDataStoreInternal.getState().getDailyLog(dateStr),
            subscribe: (listener: any) => useDataStoreInternal.subscribe(listener)
        }
    }), [commandManager, uiRegistry]);

    const engineInternal = useMemo(() => ({
        api,
        pluginSdkContextValue,
        jsxPlugins,
        _isArtisansCompassEngine: true as const
    }), [api, pluginSdkContextValue, jsxPlugins]);

    return engineInternal as unknown as IArtisansEngine;
};

export interface ArtisansCompassProviderProps {
    plugins?: PluginWithComponent[];
    children: React.ReactNode;
}

export const ArtisansCompassProvider: React.FC<ArtisansCompassProviderProps> = ({ plugins, children }) => {
    const engineInternal = useArtisans({ plugins }) as unknown as {
        api: ArtisansCompassAPI;
        pluginSdkContextValue: any;
        jsxPlugins: React.FC[];
    };

    return (
        <ArtisansCompassContext.Provider value={engineInternal.api}>
            <PluginSDKContext.Provider value={engineInternal.pluginSdkContextValue}>
                {children}

                {/* Render active JSX plugins invisibly within the Providers */}
                {engineInternal.jsxPlugins.map((PluginComponent, idx) => (
                    <PluginComponent key={idx} />
                ))}
            </PluginSDKContext.Provider>
        </ArtisansCompassContext.Provider>
    );
};

/**
 * Public SDK hook to interact with Artisans Compass core functionalities.
 */
export const useArtisansCompass = (): ArtisansCompassAPI => {
    const context = useContext(ArtisansCompassContext);
    if (!context) {
        throw new Error("useArtisansCompass must be used within an ArtisansCompassProvider");
    }
    return context;
};

/**
 * Public hook to read UI extensions dynamically registered by plugins.
 */
export const useUIExtensions = () => {
    const sidebarItems = useUIRegistryStore((state) => state.sidebarItems);
    const settingsTabs = useUIRegistryStore((state) => state.settingsTabs);
    const mainViews = useUIRegistryStore((state) => state.mainViews);
    const titleBarItems = useUIRegistryStore((state) => state.titleBarItems);
    return { sidebarItems, settingsTabs, mainViews, titleBarItems };
};
