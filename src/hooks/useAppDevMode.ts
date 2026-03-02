import { useEffect } from 'react';
import { useDataStore } from './useDataStore';
import { useDebugStore } from './useDebugStore';

export function useAppDevMode() {
    const { settings } = useDataStore();

    // Developer Mode (F12)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'F12') {
                if (settings?.developerMode) {
                    e.preventDefault();
                    console.log("[App] F12 Pressed, toggling DevTools");
                    if ((window as any).ipcRenderer) {
                        (window as any).ipcRenderer.send('toggle-dev-tools');
                    }
                } else {
                    console.log("[App] F12 Pressed, but Developer Mode is OFF");
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [settings?.developerMode]);

    // Console Proxy
    useEffect(() => {
        if (!settings?.developerMode) return;

        const originalConsoleLog = console.log;
        const originalConsoleInfo = console.info;
        const originalConsoleWarn = console.warn;
        const originalConsoleError = console.error;
        const addLog = useDebugStore.getState().addLog;

        const proxyLog = (level: 'info' | 'warn' | 'error' | 'debug', originalMethod: any, ...args: any[]) => {
            // Call original first
            originalMethod.apply(console, args);
            // Then add to store (non-blocking)
            try {
                addLog(level, args[0], 'frontend', ...args.slice(1));
            } catch (e) {
                // Prevent infinite loops if logging fails
            }
        };

        console.log = (...args) => proxyLog('debug', originalConsoleLog, ...args);
        console.info = (...args) => proxyLog('info', originalConsoleInfo, ...args);
        console.warn = (...args) => proxyLog('warn', originalConsoleWarn, ...args);
        console.error = (...args) => proxyLog('error', originalConsoleError, ...args);

        console.log("[Debug] Console interceptor active");

        return () => {
            console.log = originalConsoleLog;
            console.info = originalConsoleInfo;
            console.warn = originalConsoleWarn;
            console.error = originalConsoleError;
        };
    }, [settings?.developerMode]);

    // Global Event & IPC Listener
    useEffect(() => {
        if (!settings?.developerMode) return;
        const addLog = useDebugStore.getState().addLog;

        // 1. Click Listener
        const handleClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const clickable = target.closest('button, a, [role="button"], input, select');
            if (clickable) {
                let label = (clickable as HTMLElement).innerText || (clickable as any).name || (clickable as any).id || clickable.className;
                if (label.length > 50) label = label.substring(0, 50) + '...';
                addLog('info', `Click: ${clickable.tagName} "${label}"`, 'frontend');
            }
        };
        window.addEventListener('click', handleClick, true); // Capture phase

        // 2. Backend Log Listener
        let removeBackendListener: (() => void) | undefined;
        if ((window as any).ipcRenderer?.onBackendLog) {
            removeBackendListener = (window as any).ipcRenderer.onBackendLog((log: any) => {
                addLog(log.level, log.message, 'backend');
            });
        }

        return () => {
            window.removeEventListener('click', handleClick, true);
            if (removeBackendListener) removeBackendListener();
        };
    }, [settings?.developerMode]);
}
