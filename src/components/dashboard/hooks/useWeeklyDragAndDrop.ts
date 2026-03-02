import { useState, useRef, useEffect } from 'react';
import { PlannedSession } from '@/types';
import { addMinutes } from 'date-fns';

export function useWeeklyDragAndDrop({
    selectedPlanRef,
    setIsEditorOpen,
    setSelectedPlan,
    setPopoverPosition,
    handleSavePlan
}: {
    viewMode: 'calendar' | 'routine';
    isEditorOpen: boolean;
    selectedPlanRef: React.MutableRefObject<Partial<PlannedSession> | null>;
    setIsEditorOpen: (open: boolean) => void;
    setSelectedPlan: (plan: Partial<PlannedSession> | null) => void;
    setPopoverPosition: (pos: { x: number, y: number } | null) => void;
    handleSavePlan: (session: Partial<PlannedSession>, originalStart?: number) => Promise<void>;
}) {
    const [dragState, setDragState] = useState<{
        isDragging: boolean;
        type: 'move' | 'resize' | 'create';
        session: PlannedSession | null;
        startY: number;
        startX?: number;
        originalStart: number;
        originalDuration: number;
        currentStart: number;
        currentDuration: number;
        day: Date;
        currentX: number;
        currentY: number;
        initialOffsetX: number;
        initialOffsetY: number;
        ghostWidth: number;
        containerHeight: number;
    } | null>(null);

    const [selectionBox, setSelectionBox] = useState<{ startX: number, startY: number, currentX: number, currentY: number } | null>(null);
    const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());

    const selectionRef = useRef<{
        isSelecting: boolean;
        startX: number;
        startY: number;
        currentX: number;
        currentY: number;
        containerRect: DOMRect;
    } | null>(null);

    const dragRef = useRef<any>(null);
    const saveRef = useRef(handleSavePlan);
    useEffect(() => { saveRef.current = handleSavePlan }, [handleSavePlan]);

    const onMouseMove = (e: MouseEvent) => {
        const selState = selectionRef.current;
        if (selState && selState.isSelecting) {
            selState.currentX = e.clientX;
            selState.currentY = e.clientY;

            setSelectionBox({
                startX: selState.startX,
                startY: selState.startY,
                currentX: selState.currentX,
                currentY: selState.currentY
            });
            return;
        }

        if (!dragRef.current) return;

        const prev = dragRef.current;
        if (!prev) return;

        if (!prev.isDragging) {
            const dx = Math.abs(e.clientX - (prev.startX || 0));
            const dy = Math.abs(e.clientY - prev.startY);
            if (dx < 5 && dy < 5) return;

            prev.isDragging = true;
            setDragState(curr => curr ? ({ ...curr, isDragging: true }) : null);
        }

        const rect = prev.containerRect;
        if (!rect) return;

        let currentHoverDay = prev.day;
        let hoverRect = rect;
        const elements = document.elementsFromPoint(e.clientX, e.clientY);
        const dayColumn = elements.find(el => el.hasAttribute('data-day'));
        if (dayColumn) {
            const dateStr = dayColumn.getAttribute('data-day');
            if (dateStr) {
                currentHoverDay = new Date(dateStr);
                hoverRect = dayColumn.getBoundingClientRect();
            }
        }

        let newStart = prev.originalStart;
        let newDuration = prev.originalDuration;
        let newDay = prev.day;

        if (prev.type === 'move') {
            const deltaY = e.clientY - prev.startY;
            const minutesPerPixel = 1440 / hoverRect.height;
            const deltaMinutes = deltaY * minutesPerPixel;
            const snappedDelta = Math.round(deltaMinutes / 15) * 15;

            const originalDate = new Date(prev.originalStart);
            const targetDate = new Date(currentHoverDay);
            targetDate.setHours(originalDate.getHours(), originalDate.getMinutes(), 0, 0);

            newStart = addMinutes(targetDate, snappedDelta).getTime();
            newDay = currentHoverDay;
        } else if (prev.type === 'resize') {
            const minutesPerPixel = 1440 / hoverRect.height;
            const hoverY = e.clientY - hoverRect.top;
            const hoverMinutes = hoverY * minutesPerPixel;

            const targetEndDate = new Date(currentHoverDay);
            targetEndDate.setHours(0, 0, 0, 0);

            const targetEndTime = targetEndDate.getTime() + (hoverMinutes * 60 * 1000);
            let calculatedDurationSec = (targetEndTime - prev.originalStart) / 1000;

            const newDurationSec = Math.max(900, calculatedDurationSec);
            newDuration = Math.round(newDurationSec / 900) * 900;
        } else if (prev.type === 'create') {
            const deltaY = e.clientY - prev.startY;
            const minutesPerPixel = 1440 / hoverRect.height;
            const deltaMinutes = deltaY * minutesPerPixel;
            const effectiveDelta = Math.max(15, deltaMinutes);
            newDuration = effectiveDelta * 60;

            const originalDate = new Date(prev.originalStart);
            const targetDate = new Date(currentHoverDay);
            targetDate.setHours(originalDate.getHours(), originalDate.getMinutes(), 0, 0);
            newStart = targetDate.getTime();
            newDay = currentHoverDay;
        }

        setDragState(curr => curr ? ({
            ...curr,
            currentStart: prev.type === 'resize' ? prev.originalStart : newStart,
            currentDuration: newDuration,
            day: newDay,
            currentX: e.clientX,
            currentY: e.clientY
        }) : null);
    };

    const onMouseUp = async (e: MouseEvent) => {
        const selState = selectionRef.current;
        if (selState && selState.isSelecting) {
            const box = {
                left: Math.min(selState.startX, selState.currentX),
                top: Math.min(selState.startY, selState.currentY),
                width: Math.abs(selState.currentX - selState.startX),
                height: Math.abs(selState.currentY - selState.startY),
            };

            const sessionElements = document.querySelectorAll('[data-session-id]');
            const newSelection = new Set(selectedSessionIds);
            if (!e.ctrlKey && !e.shiftKey) {
                newSelection.clear();
            }

            sessionElements.forEach((el) => {
                const rect = el.getBoundingClientRect();
                const intersect = !(rect.right < box.left ||
                    rect.left > box.left + box.width ||
                    rect.bottom < box.top ||
                    rect.top > box.top + box.height);

                if (intersect) {
                    const id = el.getAttribute('data-session-id');
                    if (id) newSelection.add(id);
                }
            });

            setSelectedSessionIds(newSelection);
            setSelectionBox(null);
            selectionRef.current = null;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            return;
        }

        if (!dragRef.current) return;

        const prev = dragRef.current;

        let currentHoverDay = prev.day;
        let hoverRect = prev.containerRect;
        const elements = document.elementsFromPoint(e.clientX, e.clientY);
        const dayColumn = elements.find(el => el.hasAttribute('data-day'));
        if (dayColumn) {
            const dateStr = dayColumn.getAttribute('data-day');
            if (dateStr) {
                currentHoverDay = new Date(dateStr);
                hoverRect = dayColumn.getBoundingClientRect();
            }
        }

        let newStart = prev.originalStart;
        let newDuration = prev.originalDuration;

        if (prev.type === 'move') {
            const deltaY = e.clientY - prev.startY;
            const minutesPerPixel = 1440 / hoverRect.height;
            const deltaMinutes = deltaY * minutesPerPixel;
            const snappedDelta = Math.round(deltaMinutes / 15) * 15;

            const originalDate = new Date(prev.originalStart);
            const targetDate = new Date(currentHoverDay);
            targetDate.setHours(originalDate.getHours(), originalDate.getMinutes(), 0, 0);

            newStart = addMinutes(targetDate, snappedDelta).getTime();
        } else if (prev.type === 'resize') {
            const minutesPerPixel = 1440 / hoverRect.height;
            const hoverY = e.clientY - hoverRect.top;
            const hoverMinutes = hoverY * minutesPerPixel;

            const targetEndDate = new Date(currentHoverDay);
            targetEndDate.setHours(0, 0, 0, 0);

            const targetEndTime = targetEndDate.getTime() + (hoverMinutes * 60 * 1000);
            let calculatedDurationSec = (targetEndTime - prev.originalStart) / 1000;

            const newDurationSec = Math.max(900, calculatedDurationSec);
            newDuration = Math.round(newDurationSec / 900) * 900;
        } else if (prev.type === 'create') {
            const deltaY = e.clientY - prev.startY;
            const minutesPerPixel = 1440 / hoverRect.height;
            const deltaMinutes = deltaY * minutesPerPixel;
            const effectiveDelta = Math.max(15, deltaMinutes);
            newDuration = effectiveDelta * 60;

            const originalDate = new Date(prev.originalStart);
            const targetDate = new Date(currentHoverDay);
            targetDate.setHours(originalDate.getHours(), originalDate.getMinutes(), 0, 0);
            newStart = targetDate.getTime();
        }

        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);

        if (!prev.isDragging && prev.type !== 'create') {
            setDragState(null);
            dragRef.current = null;

            if (prev.session) {
                const element = document.querySelector(`[data-session-id="${prev.session.id}"]`);

                if (document.querySelector('.plan-editor-card') && selectedPlanRef.current?.id === prev.session.id) {
                    setIsEditorOpen(false);
                    return;
                }

                if (document.querySelector('.plan-editor-card')) {
                    const currentPlan = selectedPlanRef.current;
                    if (currentPlan && currentPlan.title && currentPlan.title.trim().length > 0) {
                        saveRef.current(currentPlan);
                    }
                }

                if (element) {
                    const rect = element.getBoundingClientRect();
                    const container = document.getElementById('weekly-view-container');
                    const containerRect = container ? container.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth };

                    let x = (rect.right - containerRect.left) - 4;
                    if (x + 340 > containerRect.width) x = (rect.left - containerRect.left) - 340;
                    setPopoverPosition({ x: Math.max(0, x), y: rect.top - containerRect.top });
                } else {
                    const container = document.getElementById('weekly-view-container');
                    const containerRect = container ? container.getBoundingClientRect() : { left: 0, top: 0 };
                    setPopoverPosition({ x: Math.max(0, e.clientX - containerRect.left), y: Math.max(0, e.clientY - containerRect.top) });
                }
                setSelectedPlan(prev.session);
                setIsEditorOpen(true);
            }
            return;
        }

        if (prev.type === 'create') {
            setDragState(null);
            dragRef.current = null;

            if (newDuration >= 900) {
                const rect = prev.containerRect;
                const top = Math.min(prev.startY, e.clientY);
                const container = document.getElementById('weekly-view-container');
                const containerRect = container ? container.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth };

                let x = (rect.right - containerRect.left) - 4;
                if (x + 340 > containerRect.width) x = (rect.left - containerRect.left) - 340;

                setPopoverPosition({ x: Math.max(0, x), y: top - containerRect.top });
                setSelectedPlan({
                    id: crypto.randomUUID(),
                    start: newStart,
                    duration: newDuration,
                } as any);
                setIsEditorOpen(true);
            }
        } else if (newStart !== prev.originalStart || newDuration !== prev.originalDuration) {
            const updated = {
                ...prev.session!,
                start: newStart,
                duration: newDuration
            };
            await saveRef.current(updated, prev.originalStart);
            setDragState(null);
            dragRef.current = null;
        } else {
            setDragState(null);
            dragRef.current = null;
        }
    };

    const startDrag = (e: React.MouseEvent, type: 'move' | 'resize', session: PlannedSession) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();

        const dayColumn = (e.currentTarget as HTMLElement).closest('[data-day]');
        if (!dayColumn) return;

        const dayRect = dayColumn.getBoundingClientRect();
        const sessionElement = (e.currentTarget as HTMLElement).closest('[data-session-id]');
        const sessionRect = sessionElement ? sessionElement.getBoundingClientRect() : (e.currentTarget as HTMLElement).getBoundingClientRect();

        const state = {
            isDragging: false,
            type,
            session,
            startY: e.clientY,
            startX: e.clientX,
            originalStart: session.start,
            originalDuration: session.duration,
            currentStart: session.start,
            currentDuration: session.duration,
            day: new Date(session.start),
            containerRect: dayRect,
            currentX: e.clientX,
            currentY: e.clientY,
            initialOffsetX: e.clientX - dayRect.left,
            initialOffsetY: e.clientY - sessionRect.top,
            ghostWidth: dayRect.width,
            containerHeight: dayRect.height
        };

        setDragState(state);
        dragRef.current = state;

        document.body.style.userSelect = 'none';
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    return {
        dragState, setDragState,
        selectionBox, setSelectionBox,
        selectedSessionIds, setSelectedSessionIds,
        selectionRef, dragRef,
        onMouseMove, onMouseUp, startDrag
    };
}
