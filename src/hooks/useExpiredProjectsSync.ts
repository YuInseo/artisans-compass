import { useEffect } from 'react';
import { format } from 'date-fns';
import { Project } from '@/types';

export function useExpiredProjectsSync(projects: Project[], saveProjects: (projects: Project[]) => void) {
    useEffect(() => {
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const expiredProjects = projects.filter(p => !p.isCompleted && p.endDate < todayStr);

        if (expiredProjects.length > 0) {
            const updatedProjects = projects.map(p => {
                if (!p.isCompleted && p.endDate < todayStr) {
                    return { ...p, isCompleted: true, locked: true };
                }
                return p;
            });
            saveProjects(updatedProjects);
        }
    }, [projects, saveProjects]);
}
