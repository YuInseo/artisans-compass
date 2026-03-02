import { useState, useMemo } from 'react';
import { useTodoStore } from '@/hooks/useTodoStore';

export function useDailyTodos() {
    const { projectTodos, activeProjectId } = useTodoStore();
    const [isGeneralOpen, setIsGeneralOpen] = useState(false);

    const todos = useMemo(() => projectTodos[activeProjectId] || [], [projectTodos, activeProjectId]);
    const generalTodos = useMemo(() => projectTodos['general'] || [], [projectTodos]);

    const uniqueGeneralTodos = useMemo(() => {
        const seen = new Set();
        return generalTodos.filter(t => {
            if (seen.has(t.id)) return false;
            seen.add(t.id);
            return true;
        });
    }, [generalTodos]);

    const uniqueGeneralCompletion = useMemo(() => {
        if (uniqueGeneralTodos.length === 0) return 0;
        const completed = uniqueGeneralTodos.filter((t: any) => t.completed).length;
        return (completed / uniqueGeneralTodos.length) * 100;
    }, [uniqueGeneralTodos]);

    return {
        todos,
        isGeneralOpen,
        setIsGeneralOpen,
        uniqueGeneralTodos,
        uniqueGeneralCompletion
    };
}
