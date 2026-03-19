import React from 'react';
import { IPluginContext, IArtisansCompassPlugin } from './core';
import { BaseSidebarItem, BaseSettingsTab, BaseMainView, BaseTitleBarItem, BaseDashboardWidget } from './ui';
import { useUIRegistryStore } from '../../core/UIRegistry';

// ==== JSX Plugin System ====
export const PluginSDKContext = React.createContext<IPluginContext | null>(null);

export const usePluginContext = () => {
    const ctx = React.useContext(PluginSDKContext);
    if (!ctx) throw new Error("Plugin components must be rendered within a PluginSDKContext.Provider");
    return ctx;
};

const PluginChildrenPortal: React.FC<{ id: string }> = ({ id }) => {
    const node = useUIRegistryStore(state => state.portals[id]);
    return <>{node}</>;
};

type WithChildSupport<T, K extends keyof T> = Omit<T, K> & {
    [P in K]?: T[P];
} & {
    asChild?: boolean;
    children?: React.ReactNode;
};

export const SidebarItem: React.FC<BaseSidebarItem> = (props) => {
    const { ui } = usePluginContext();
    React.useEffect(() => {
        ui.registerSidebarItem(props);
        return () => ui.unregisterSidebarItem(props.id);
    }, [props.id, props.title, props.icon, props.onClick, props.viewId, ui]);
    return null;
};

// For views/tabs/widgets, we replace the `render` requirement with `PluginChildrenPortal`
export const SettingsTab: React.FC<WithChildSupport<BaseSettingsTab, 'render'>> = ({ id, title, icon, render, asChild, children }) => {
    const { ui } = usePluginContext();

    React.useEffect(() => {
        ui.registerSettingsTab({ id, title, icon, render: () => <PluginChildrenPortal id={id} /> });
        return () => ui.unregisterSettingsTab(id);
    }, [id, title, icon, ui]);

    const contentToRender = asChild ? children : render?.();
    React.useEffect(() => { ui.updatePortal(id, contentToRender); }, [id, contentToRender, ui]);

    return null;
};

export const MainView: React.FC<WithChildSupport<BaseMainView, 'render'>> = ({ id, render, asChild, children }) => {
    const { ui } = usePluginContext();

    React.useEffect(() => {
        ui.registerMainView({ id, render: () => <PluginChildrenPortal id={id} /> });
        return () => ui.unregisterMainView(id);
    }, [id, ui]);

    const contentToRender = asChild ? children : render?.();
    React.useEffect(() => { ui.updatePortal(id, contentToRender); }, [id, contentToRender, ui]);

    return null;
};

export const TitleBarItem: React.FC<BaseTitleBarItem> = (props) => {
    const { ui } = usePluginContext();
    React.useEffect(() => {
        ui.registerTitleBarItem(props);
        return () => ui.unregisterTitleBarItem(props.id);
    }, [props.id, props.title, props.icon, props.onClick, props.showOnViews, ui]);
    return null;
};

export const DashboardWidget: React.FC<WithChildSupport<BaseDashboardWidget, 'render'>> = ({ id, title, render, asChild, children }) => {
    const { ui } = usePluginContext();

    React.useEffect(() => {
        ui.registerDashboardWidget({ id, title, render: () => <PluginChildrenPortal id={id} /> });
        return () => ui.unregisterDashboardWidget(id);
    }, [id, title, ui]);

    const contentToRender = asChild ? children : render?.();
    React.useEffect(() => { ui.updatePortal(id, contentToRender); }, [id, contentToRender, ui]);

    return null;
};

// Declarative API helpers
export function useArtisansCompass<T extends IArtisansCompassPlugin>(config: T): T {
    return config;
}

export const ArtisansCompass: React.FC<{ compass: any; children: React.ReactNode }> = ({ compass, children }) => {
    return (
        <>
            {compass?.component ? <compass.component /> : children}
        </>
    );
};
