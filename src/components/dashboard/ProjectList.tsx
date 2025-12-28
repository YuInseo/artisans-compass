import { useState } from "react";
import { Project } from "@/types";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Trash, Lock, Unlock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useDataStore } from "@/hooks/useDataStore";
import { ProjectSettingsModal } from "./ProjectSettingsModal";

interface ProjectListProps {
    searchQuery?: string;
}

export function ProjectList({ searchQuery: _searchQuery = "" }: ProjectListProps) {
    const { t } = useTranslation();
    const { projects, saveProjects } = useDataStore();
    const [editingProject, setEditingProject] = useState<Project | null>(null);

    const handleDelete = async (id: string) => {
        const updated = projects.filter(p => p.id !== id);
        await saveProjects(updated);
    };

    const handleUpdate = async (updatedProject: Project) => {
        const updated = projects.map(p => p.id === updatedProject.id ? updatedProject : p);
        await saveProjects(updated);
    };

    const toggleLock = async (project: Project) => {
        const updated = projects.map(p =>
            p.id === project.id ? { ...p, locked: !p.locked } : p
        );
        await saveProjects(updated);
    };

    // Sort projects by start date desc
    const sortedProjects = [...projects].sort((a, b) =>
        parseISO(b.startDate).getTime() - parseISO(a.startDate).getTime()
    );

    return (
        <div className="h-full w-full flex flex-col bg-background/50">
            <div className="flex items-center justify-between px-8 py-6 pb-2 shrink-0">
                <div className="flex items-baseline gap-3">
                    <h2 className="text-2xl font-bold tracking-tight text-foreground font-serif">{t('dashboard.projectDatabase')}</h2>
                    <span className="text-sm font-medium text-muted-foreground/50">
                        {t('dashboard.total')} {projects.length}
                    </span>
                </div>
            </div>

            <div className="flex-1 overflow-x-auto overflow-y-hidden custom-scrollbar px-8 pb-8 pt-4 flex items-center gap-6 snap-x snap-mandatory">
                {/* New Project Card Placeholder (Optional, usually users create from nav but good to have) */}
                <div className="min-w-[300px] h-[400px] border-2 border-dashed border-muted-foreground/10 rounded-3xl flex flex-col items-center justify-center text-muted-foreground/30 hover:text-muted-foreground/60 hover:border-muted-foreground/30 hover:bg-muted/5 transition-all cursor-pointer snap-center group"
                    onClick={() => {
                        // Trigger new project creation? 
                        // Currently logic is in AppLayout. 
                        // Just a visual placeholder or maybe redirect?
                        // For now, let's leave it as a "End of list" spacer or generic info?
                        // Actually user explicitly asked for "Project Database list".
                        // I will stick to projects.
                    }}
                >
                    <span className="text-4xl font-light mb-2 group-hover:scale-110 transition-transform">+</span>
                    <span className="text-sm uppercase tracking-widest font-bold">{t('dashboard.newProject')}</span>
                </div>

                {sortedProjects.map((project) => (
                    <div
                        key={project.id}
                        className="relative min-w-[320px] max-w-[320px] h-[400px] bg-card rounded-3xl border border-border shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col snap-center group overflow-hidden"
                    >
                        {/* Top Accent Bar */}
                        <div className={cn(
                            "h-3 w-full",
                            project.type === 'Main' ? "bg-blue-500" :
                                project.type === 'Sub' ? "bg-green-500" :
                                    "bg-orange-500"
                        )} />

                        {/* Content */}
                        <div className="flex-1 p-6 flex flex-col relative">
                            {/* Status Badge */}
                            <div className="flex justify-between items-start mb-6">
                                <span className={cn(
                                    "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                                    project.type === 'Main' ? "bg-blue-500/10 text-blue-600 border-blue-500/20" :
                                        project.type === 'Sub' ? "bg-green-500/10 text-green-600 border-green-500/20" :
                                            "bg-orange-500/10 text-orange-600 border-orange-500/20"
                                )}>
                                    {project.type}
                                </span>

                                {project.locked && (
                                    <Lock className="w-4 h-4 text-muted-foreground/50" />
                                )}
                            </div>

                            <h3 className="text-2xl font-bold text-foreground/90 mb-2 leading-tight min-h-[4rem] group-hover:text-primary transition-colors">
                                {project.name || t('dashboard.untitledProject')}
                            </h3>

                            <div className="space-y-4 mt-auto">
                                <div className="space-y-1">
                                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">{t('sidebar.timeline')}</div>
                                    <div className="text-sm font-medium text-foreground flex items-center justify-between">
                                        <span>{format(parseISO(project.startDate), 'MMM d')}</span>
                                        <div className="h-px flex-1 mx-2 bg-border relative">
                                            <div className="absolute right-0 -top-0.5 w-1 h-1 rounded-full bg-border"></div>
                                        </div>
                                        <span>{format(parseISO(project.endDate), 'MMM d, yyyy')}</span>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-border/50 flex items-center justify-between">
                                    <div className={cn(
                                        "flex items-center gap-1.5 text-xs font-bold",
                                        project.isCompleted ? "text-green-600" : "text-amber-600"
                                    )}>
                                        <div className={cn("w-2 h-2 rounded-full", project.isCompleted ? "bg-green-500" : "bg-amber-500 animate-pulse")} />
                                        {project.isCompleted ? t('dashboard.completed') : t('dashboard.inProgress')}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Actions Footer */}
                        <div className="p-4 bg-muted/30 border-t border-border flex items-center justify-between gap-2 opacity-100 xl:opacity-0 xl:group-hover:opacity-100 transition-opacity duration-200">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 rounded-full hover:bg-background hover:text-foreground hover:shadow-sm"
                                onClick={() => toggleLock(project)}
                                title={project.locked ? t('dashboard.unlockWidget') : t('dashboard.lockWidget')}
                            >
                                {project.locked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                            </Button>

                            <div className="flex items-center gap-1">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 px-3 rounded-full text-xs font-medium bg-background border border-border/50 shadow-sm hover:border-primary/50 hover:text-primary"
                                    onClick={() => setEditingProject(project)}
                                >
                                    {t('dashboard.edit')}
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 rounded-full text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => handleDelete(project.id)}
                                >
                                    <Trash className="w-3.5 h-3.5" />
                                </Button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <ProjectSettingsModal
                isOpen={!!editingProject}
                project={editingProject}
                onClose={() => setEditingProject(null)}
                onSave={handleUpdate}
                onDelete={handleDelete}
            />
        </div>
    );
}
