import { useState, useEffect, useMemo, useRef } from 'react';
import { startOfWeek, addWeeks, subWeeks, addDays } from 'date-fns';
import { useTimeStore } from '@/hooks/useTimeStore';
import { PlannedSession } from '@/types';

export function useWeeklyState(initialDate: Date, onDateChange: (date: Date) => void) {
    const [viewMode, setViewMode] = useState<'calendar' | 'routine'>('calendar');

    // Time Management
    const { now: getNow, offset: timeOffset } = useTimeStore();
    const [now, setNow] = useState(getNow());

    useEffect(() => {
        setNow(getNow());
    }, [timeOffset, getNow]);

    useEffect(() => {
        const interval = setInterval(() => setNow(getNow()), 60000);
        return () => clearInterval(interval);
    }, [getNow]);

    const [showRoutineOverlay, setShowRoutineOverlay] = useState(false);
    const [showAppUsage, setShowAppUsage] = useState(true);

    const [viewDate, setViewDate] = useState(() => startOfWeek(initialDate, { weekStartsOn: 1 }));

    // Editor State
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState<Partial<PlannedSession> | null>(null);
    const selectedPlanRef = useRef(selectedPlan);
    useEffect(() => { selectedPlanRef.current = selectedPlan; }, [selectedPlan]);

    const [popoverPosition, setPopoverPosition] = useState<{ x: number, y: number } | null>(null);

    // Days calculation
    const days = useMemo(() => {
        if (viewMode === 'routine') {
            const baseDate = startOfWeek(new Date(), { weekStartsOn: 1 });
            return Array.from({ length: 7 }).map((_, i) => addDays(baseDate, i));
        }
        return Array.from({ length: 7 }).map((_, i) => addDays(viewDate, i));
    }, [viewDate, viewMode]);

    // Navigation
    const handlePrevWeek = () => {
        const newDate = subWeeks(viewDate, 1);
        setViewDate(newDate);
        onDateChange(newDate);
    };

    const handleNextWeek = () => {
        const newDate = addWeeks(viewDate, 1);
        setViewDate(newDate);
        onDateChange(newDate);
    };

    const handleToday = () => {
        const today = new Date();
        const start = startOfWeek(today, { weekStartsOn: 1 });
        setViewDate(start);
        onDateChange(start);
    };

    return {
        viewMode, setViewMode,
        now,
        showRoutineOverlay, setShowRoutineOverlay,
        showAppUsage, setShowAppUsage,
        viewDate, setViewDate,
        isEditorOpen, setIsEditorOpen,
        selectedPlan, setSelectedPlan, selectedPlanRef,
        popoverPosition, setPopoverPosition,
        days,
        handlePrevWeek, handleNextWeek, handleToday
    };
}
