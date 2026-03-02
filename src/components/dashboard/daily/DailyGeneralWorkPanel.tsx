import { Briefcase, ChevronDown } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { TodoEditor } from "../TodoEditor";
import { useTodoStore } from "@/hooks/useTodoStore";

interface DailyGeneralWorkPanelProps {
    isWidgetMode: boolean;
    isGeneralOpen: boolean;
    setIsGeneralOpen: (open: boolean) => void;
    uniqueGeneralTodos: any[];
    uniqueGeneralCompletion: number;
}

export function DailyGeneralWorkPanel({
    isWidgetMode, isGeneralOpen, setIsGeneralOpen, uniqueGeneralTodos, uniqueGeneralCompletion
}: DailyGeneralWorkPanelProps) {
    const { t } = useTranslation();

    if (isWidgetMode) return null;

    return (
        <div className={cn(
            "absolute bottom-6 z-30 pointer-events-auto transition-all duration-300 ease-in-out",
            isGeneralOpen ? "left-6 right-6" : "left-6"
        )}>
            {!isGeneralOpen && (
                <div className="animate-in fade-in zoom-in duration-300">
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-14 w-14 rounded-full shadow-xl bg-card/80 backdrop-blur-md border border-border/50 hover:scale-105 transition-all group"
                        onClick={() => setIsGeneralOpen(true)}
                    >
                        <div className="relative">
                            <Briefcase className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
                            {uniqueGeneralTodos.filter(t => !t.completed).length > 0 && (
                                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground transform scale-90">
                                    {uniqueGeneralTodos.filter(t => !t.completed).length}
                                </span>
                            )}
                        </div>
                    </Button>
                </div>
            )}

            {isGeneralOpen && (
                <div className="bg-card/95 backdrop-blur-md shadow-2xl border border-border/50 rounded-xl overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-300 flex flex-col max-h-[500px]">
                    <div
                        className="flex items-center gap-2 p-3 cursor-pointer select-none transition-colors hover:bg-muted/30 border-b border-border/40"
                        onClick={() => setIsGeneralOpen(false)}
                    >
                        <div className={cn(
                            "p-1.5 rounded-full transition-colors flex items-center justify-center text-primary bg-primary/10"
                        )}>
                            <ChevronDown className="w-4 h-4" />
                        </div>

                        <div className="flex items-center gap-2 flex-1">
                            <Briefcase className="w-4 h-4 text-primary" />
                            <span className="text-sm font-semibold text-foreground">
                                {t('dashboard.generalWork') || "일반 작업"}
                            </span>
                            {uniqueGeneralTodos.filter(t => !t.completed).length > 0 && (
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-medium text-primary">
                                    {uniqueGeneralTodos.filter(t => !t.completed).length}
                                </span>
                            )}
                            {uniqueGeneralTodos.length > 0 && (
                                <span className="text-xs font-semibold text-muted-foreground ml-auto mr-3 font-mono">
                                    {Math.round(uniqueGeneralCompletion)}%
                                </span>
                            )}
                        </div>

                        <div className="w-24 h-1.5 bg-muted/50 rounded-full overflow-hidden mr-1">
                            <div className="h-full bg-primary/60 transition-all duration-500" style={{ width: `${uniqueGeneralCompletion}%` }} />
                        </div>
                    </div>

                    <div className="overflow-y-auto custom-scrollbar bg-background/50 flex-1 min-h-[300px]">
                        <div className="p-2 pl-1">
                            <TodoEditor
                                key="general-work-section"
                                todos={uniqueGeneralTodos}
                                isWidgetMode={false}
                                isWidgetLocked={false}
                                actions={{
                                    addTodo: (text, parentId, afterId) => {
                                        if ((window as any).ipcRenderer) return useTodoStore.getState().addTodo(text, parentId, afterId, 'general');
                                        return "";
                                    },
                                    updateTodo: (id, updates) => useTodoStore.getState().updateTodo(id, updates, false, 'general'),
                                    deleteTodo: (id) => useTodoStore.getState().deleteTodo(id, 'general'),
                                    deleteTodos: (ids) => useTodoStore.getState().deleteTodos(ids, 'general'),
                                    indentTodo: (id) => useTodoStore.getState().indentTodo(id, 'general'),
                                    unindentTodo: (id) => useTodoStore.getState().unindentTodo(id, 'general'),
                                    moveTodo: (id, pid, idx) => useTodoStore.getState().moveTodo(id, pid, idx, 'general'),
                                    moveTodos: (ids, pid, idx) => useTodoStore.getState().moveTodos(ids, pid, idx, 'general'),
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
