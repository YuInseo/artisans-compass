import { useState, useCallback } from 'react';

export function useSidebarResize(isSidebarOpen: boolean, initialWidth = 400) {
    const [sidebarWidth, setSidebarWidth] = useState(initialWidth);
    const [isResizing, setIsResizing] = useState(false);

    const startResizing = useCallback((mouseDownEvent: React.MouseEvent) => {
        if (!isSidebarOpen) return;
        mouseDownEvent.preventDefault();
        setIsResizing(true);

        const startX = mouseDownEvent.clientX;
        const startWidth = sidebarWidth;

        const doDrag = (mouseMoveEvent: MouseEvent) => {
            const currentX = mouseMoveEvent.clientX;
            const deltaX = currentX - startX;
            const newWidth = Math.max(300, Math.min(500, startWidth + deltaX));
            setSidebarWidth(newWidth);
        };

        const stopDrag = () => {
            setIsResizing(false);
            window.removeEventListener('mousemove', doDrag);
            window.removeEventListener('mouseup', stopDrag);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };

        window.addEventListener('mousemove', doDrag);
        window.addEventListener('mouseup', stopDrag);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    }, [sidebarWidth, isSidebarOpen]);

    return { sidebarWidth, isResizing, startResizing };
}
