import React from 'react';

/**
 * Known built-in views in Artisans Compass.
 * Plugins can also add their own views as strings.
 */
export type BuiltinView = 'daily' | 'weekly' | 'pomodoro' | 'statistics';

/**
 * A type that provides auto-completion for known built-in views,
 * but still allows any arbitrary string (like a custom plugin view UI).
 */
export type AppView = BuiltinView | (string & {});

export abstract class BaseSidebarItem {
    abstract id: string;
    abstract title: string;
    abstract icon: React.ReactNode;
    // The view ID to activate when clicking the item (if applicable).
    viewId?: AppView;
    // onClick handler if there is no specific view to switch to.
    onClick?(): void;
    // Optional position on the sidebar rail
    position?: 'top' | 'bottom';
    showOnViews?: AppView[];
}

export abstract class BaseTitleBarItem {
    abstract id: string;
    abstract title: string;
    abstract icon: React.ReactNode;
    onClick?(): void;
    showOnViews?: AppView[];
}

export abstract class BaseSettingsTab {
    abstract id: string;
    abstract title: string;
    icon?: React.ReactNode;
    abstract render(): React.ReactNode;
}

export abstract class BaseMainView {
    abstract id: string;
    // Optional title or metadata could go here later
    abstract render(): React.ReactNode;
}

export abstract class BaseDashboardWidget {
    abstract id: string;
    abstract title: string;
    abstract render(): React.ReactNode;
}

export interface IUIExtensionRegistry {
    /**
     * Register a new button in the global left sidebar rail.
     */
    registerSidebarItem(item: BaseSidebarItem): void;
    /**
     * Register a new settings tab in the main Settings Modal.
     */
    registerSettingsTab(tab: BaseSettingsTab): void;
    /**
     * Register a new full-page Main View plugin.
     */
    registerMainView(view: BaseMainView): void;
    /**
     * Register a new button in the global top title bar.
     */
    registerTitleBarItem(item: BaseTitleBarItem): void;
    /**
     * Register a custom widget in the overview dashboard.
     */
    registerDashboardWidget(widget: BaseDashboardWidget): void;

    unregisterSidebarItem(id: string): void;
    unregisterSettingsTab(id: string): void;
    unregisterMainView(id: string): void;
    unregisterTitleBarItem(id: string): void;
    unregisterDashboardWidget(id: string): void;

    /**
     * Internal: Update a reactive React portal for a given ID.
     */
    updatePortal(id: string, node: React.ReactNode): void;
}
