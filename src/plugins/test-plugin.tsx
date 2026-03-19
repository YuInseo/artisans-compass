import { useEffect, useState } from 'react';
import { usePluginContext, DashboardWidget, useArtisansCompass, ArtisansCompass } from './api';


export const TestPlugin = () => {
    const artisans = useArtisansCompass({
        id: 'com.example.test-plugin',
        name: 'Test Plugin for Data API & Dashboard',
        version: '1.0.0',
        onLoad: () => {
            console.log('[TestPlugin] Starting initialization...');
        },
        onUnload: () => {
            console.log('[TestPlugin] Unloading...');
        },
        component: function TestPluginComponent() {
            return (
                <DashboardWidget
                    id="test-widget-projects"
                    title="Custom Test Widget"
                    asChild
                />
            );
        }
    });

    const { data } = usePluginContext();
    const [stats, setStats] = useState({ projectCount: 0 });

    useEffect(() => {
        const updateStats = () => {
            const projects = data.getProjects();
            setStats({ projectCount: projects.length });
        };

        // Initial load
        updateStats();

        // Subscribe to changes
        const unsubscribe = data.subscribe(() => {
            updateStats();
        });

        return () => unsubscribe();
    }, [data]);

    return (
        <ArtisansCompass compass={artisans}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '8px' }}>
                <span style={{ fontSize: '2rem', fontWeight: 'bold', color: '#8b5cf6' }}>{stats.projectCount}</span>
                <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>Total Projects</span>
            </div>
        </ArtisansCompass>
    );
}