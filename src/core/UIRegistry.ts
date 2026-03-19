import { create } from 'zustand';
import { BaseSettingsTab, BaseSidebarItem, BaseMainView, BaseTitleBarItem, BaseDashboardWidget, IUIExtensionRegistry } from '../plugins/api/ui';

interface UIRegistryState {
    sidebarItems: BaseSidebarItem[];
    settingsTabs: BaseSettingsTab[];
    mainViews: BaseMainView[];
    titleBarItems: BaseTitleBarItem[];
    dashboardWidgets: BaseDashboardWidget[];
    portals: Record<string, React.ReactNode>;

    registerSidebarItem: (item: BaseSidebarItem) => void;
    registerSettingsTab: (tab: BaseSettingsTab) => void;
    registerMainView: (view: BaseMainView) => void;
    registerTitleBarItem: (item: BaseTitleBarItem) => void;
    registerDashboardWidget: (widget: BaseDashboardWidget) => void;
    unregisterSidebarItem: (id: string) => void;
    unregisterSettingsTab: (id: string) => void;
    unregisterMainView: (id: string) => void;
    unregisterTitleBarItem: (id: string) => void;
    unregisterDashboardWidget: (id: string) => void;
    setPortal: (id: string, node: React.ReactNode) => void;
}

/**
 * UIRegistry Internal Store.
 * This holds the actual registered UI components. We use Zustand so that
 * any React component can subscribe specifically to the portions they need 
 * to render (menus or tabs) instantly after a plugin registers them.
 */
export const useUIRegistryStore = create<UIRegistryState>((set) => ({
    sidebarItems: [],
    settingsTabs: [],
    mainViews: [],
    titleBarItems: [],
    dashboardWidgets: [],
    portals: {},

    registerSidebarItem: (item) => {
        set((state) => {
            if (state.sidebarItems.find(x => x.id === item.id)) {
                console.warn(`[UIRegistry] Sidebar item ${item.id} already exists.`);
                return state;
            }
            return { sidebarItems: [...state.sidebarItems, item] };
        });
    },

    registerSettingsTab: (tab) => {
        set((state) => {
            if (state.settingsTabs.find(x => x.id === tab.id)) {
                console.warn(`[UIRegistry] Settings tab ${tab.id} already exists.`);
                return state;
            }
            return { settingsTabs: [...state.settingsTabs, tab] };
        });
    },

    registerMainView: (view) => {
        set((state) => {
            if (state.mainViews.find(x => x.id === view.id)) {
                console.warn(`[UIRegistry] Main view ${view.id} already exists.`);
                return state;
            }
            return { mainViews: [...state.mainViews, view] };
        });
    },

    registerTitleBarItem: (item) => {
        set((state) => {
            if (state.titleBarItems.find(x => x.id === item.id)) {
                console.warn(`[UIRegistry] Title bar item ${item.id} already exists.`);
                return state;
            }
            return { titleBarItems: [...state.titleBarItems, item] };
        });
    },

    registerDashboardWidget: (widget) => {
        set((state) => {
            if (state.dashboardWidgets.find(x => x.id === widget.id)) {
                console.warn(`[UIRegistry] Dashboard widget ${widget.id} already exists.`);
                return state;
            }
            return { dashboardWidgets: [...state.dashboardWidgets, widget] };
        });
    },

    unregisterSidebarItem: (id) => {
        set((state) => ({
            sidebarItems: state.sidebarItems.filter(x => x.id !== id)
        }));
    },

    unregisterSettingsTab: (id) => {
        set((state) => ({
            settingsTabs: state.settingsTabs.filter(x => x.id !== id)
        }));
    },

    unregisterMainView: (id) => {
        set((state) => ({
            mainViews: state.mainViews.filter(x => x.id !== id)
        }));
    },

    unregisterTitleBarItem: (id) => {
        set((state) => ({
            titleBarItems: state.titleBarItems.filter(x => x.id !== id)
        }));
    },

    unregisterDashboardWidget: (id) => {
        set((state) => ({
            dashboardWidgets: state.dashboardWidgets.filter(x => x.id !== id)
        }));
    },

    setPortal: (id, node) => {
        set((state) => ({
            portals: { ...state.portals, [id]: node }
        }));
    }
}));

/**
 * The runtime implementation of IUIExtensionRegistry passed to plugins.
 * Plugins don't know it's a Zustand store underneath, they just call register().
 */
export class UIRegistry implements IUIExtensionRegistry {
    registerSidebarItem(item: BaseSidebarItem): void {
        useUIRegistryStore.getState().registerSidebarItem(item);
    }

    registerSettingsTab(tab: BaseSettingsTab): void {
        useUIRegistryStore.getState().registerSettingsTab(tab);
    }

    registerMainView(view: BaseMainView): void {
        useUIRegistryStore.getState().registerMainView(view);
    }

    unregisterSidebarItem(id: string): void {
        useUIRegistryStore.getState().unregisterSidebarItem(id);
    }

    unregisterSettingsTab(id: string): void {
        useUIRegistryStore.getState().unregisterSettingsTab(id);
    }

    unregisterMainView(id: string): void {
        useUIRegistryStore.getState().unregisterMainView(id);
    }

    registerTitleBarItem(item: BaseTitleBarItem): void {
        useUIRegistryStore.getState().registerTitleBarItem(item);
    }

    unregisterTitleBarItem(id: string): void {
        useUIRegistryStore.getState().unregisterTitleBarItem(id);
    }

    registerDashboardWidget(widget: BaseDashboardWidget): void {
        useUIRegistryStore.getState().registerDashboardWidget(widget);
    }

    unregisterDashboardWidget(id: string): void {
        useUIRegistryStore.getState().unregisterDashboardWidget(id);
    }

    updatePortal(id: string, node: React.ReactNode): void {
        useUIRegistryStore.getState().setPortal(id, node);
    }
}
