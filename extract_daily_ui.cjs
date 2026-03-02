const fs = require('fs');
const path = require('path');

const dir = path.resolve(__dirname, 'src/components/dashboard/daily');
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
}

// 1. DailyWidgetContent.tsx
const widgetContent = `import React from 'react';
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { TimerWidget } from "../TimerWidget";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface DailyWidgetContentProps {
    isWidgetMode: boolean;
    settings: any;
    saveSettings: (settings: any) => void;
    manualQuote?: string;
    now: Date;
    filteredSessions: any[];
    filteredLiveSession: any;
}

export function DailyWidgetContent({
    isWidgetMode, settings, saveSettings, manualQuote, now, filteredSessions, filteredLiveSession
}: DailyWidgetContentProps) {
    const { t } = useTranslation();

    if (!isWidgetMode || settings?.widgetDisplayMode === 'none') {
        return null;
    }

    if (settings?.widgetDisplayMode === 'quote') {
        return (
            <div className="mb-4 px-1 animate-in fade-in slide-in-from-top-2 group relative">
                <div
                    className="p-4 rounded-lg flex flex-col items-center justify-center min-h-[100px] shadow-sm relative overflow-hidden transition-all duration-500"
                    style={{
                        backgroundColor: \`hsl(var(--muted) / \${Math.max(0, (settings?.widgetOpacity ?? 0.95) * 0.3)})\`,
                        borderColor: \`hsl(var(--border) / \${Math.max(0, (settings?.widgetOpacity ?? 0.95) * 0.5)})\`,
                        borderWidth: '1px', borderStyle: 'solid'
                    }}
                >
                    <div>
                        <p className={cn("text-sm font-medium font-serif italic text-muted-foreground whitespace-pre-line leading-relaxed", isWidgetMode && "drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]")}>
                            "{manualQuote || (() => {
                                const defaultQuotes = [
                                    "창의성은 실수를 허용하는 것이다. 예술은 어떤 것을 지킬지 아는 것이다.",
                                    "완벽함이 아니라 탁월함을 추구하라.",
                                    "시작이 반이다.",
                                    "몰입은 최고의 휴식이다.",
                                    "단순함은 궁극의 정교함이다.",
                                    "가장 좋은 방법은 시작하는 것이다.",
                                    "영감은 존재한다. 그러나 당신이 일하는 도중에 찾아온다.",
                                    "어제보다 나은 내일을 만들어라.",
                                    "작은 진전이 모여 큰 결과를 만든다.",
                                    "실패는 성공으로 가는 이정표다."
                                ];
                                const customQuotes = settings?.customQuotes || [];
                                const allQuotes = customQuotes.length > 0 ? customQuotes : defaultQuotes;
                                return allQuotes[new Date().getDate() % allQuotes.length] || "창의성은 실수를 허용하는 것이다.";
                            })()}"
                        </p>
                    </div>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    saveSettings({ ...settings, widgetDisplayMode: 'none' });
                                }}
                                className="absolute top-1 right-1 p-1 rounded-full text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all no-drag"
                                style={{ WebkitAppRegion: 'no-drag' } as any}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                            </button>
                        </TooltipTrigger>
                        <TooltipContent side="left">
                            <p>{t('settings.appearance.close') || "Close"}</p>
                        </TooltipContent>
                    </Tooltip>
                </div>
            </div>
        );
    }

    if (settings?.widgetDisplayMode === 'goals') {
        return (
            <div className="mb-4 px-1 grid grid-cols-2 gap-2 animate-in fade-in slide-in-from-top-2 group relative">
                <div className="p-2 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                    <div className={cn("text-[10px] font-bold text-blue-600/70 uppercase tracking-wider mb-0.5", isWidgetMode && "drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]")}>{t('dashboard.monthly')}</div>
                    <div className={cn("text-xs font-medium truncate", isWidgetMode && "drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]")} title={settings.focusGoals?.monthly}>{settings.focusGoals?.monthly || t('dashboard.noGoal')}</div>
                </div>
                <div className="p-2 bg-green-500/5 border border-green-500/20 rounded-lg">
                    <div className={cn("text-[10px] font-bold text-green-600/70 uppercase tracking-wider mb-0.5", isWidgetMode && "drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]")}>{t('dashboard.weekly')}</div>
                    <div className={cn("text-xs font-medium truncate", isWidgetMode && "drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]")} title={settings.focusGoals?.weekly}>{settings.focusGoals?.weekly || t('dashboard.noGoal')}</div>
                </div>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            onClick={() => saveSettings({ ...settings, widgetDisplayMode: 'none' })}
                            className="absolute -top-1 -right-1 p-1 rounded-full bg-background border border-border shadow-sm text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all z-10 no-drag"
                            style={{ WebkitAppRegion: 'no-drag' } as any}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="left">
                        <p>{t('settings.appearance.close') || "Close"}</p>
                    </TooltipContent>
                </Tooltip>
            </div>
        );
    }

    if (settings?.widgetDisplayMode === 'timer') {
        return (
            <TimerWidget
                isWidgetMode={isWidgetMode}
                liveSession={filteredLiveSession}
                sessions={filteredSessions}
                now={now}
                onRemove={() => saveSettings({ ...settings, widgetDisplayMode: 'none' })}
            />
        );
    }

    return null;
}
`;
fs.writeFileSync(path.join(dir, 'DailyWidgetContent.tsx'), widgetContent);

// 2. DailyHeader.tsx
const dailyHeaderContent = `import React from 'react';
import { format } from "date-fns";
import { Eraser } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Project } from "@/types";

interface DailyHeaderProps {
    isWidgetMode: boolean;
    activeProjectId: string;
    setActiveProjectId: (id: string) => void;
    projects: Project[];
    clearUntitledTodos: () => void;
    isPinned: boolean;
    togglePin: () => void;
}

export function DailyHeader({
    isWidgetMode, activeProjectId, setActiveProjectId, projects, clearUntitledTodos, isPinned, togglePin
}: DailyHeaderProps) {
    const { t } = useTranslation();

    if (isWidgetMode) return null;

    return (
        <div className="flex items-end justify-between mb-6 px-1 shrink-0">
            <div className="flex items-end gap-2">
                <div>
                    <h2 className="text-2xl font-bold text-foreground tracking-tight cursor-pointer hover:text-muted-foreground transition-colors flex items-center gap-2 whitespace-nowrap">
                        {t('dashboard.todayFocus')}
                    </h2>
                    <p className="text-sm text-muted-foreground font-medium mt-1 truncate max-w-[120px] sm:max-w-none">{format(new Date(), 'MMM dd, yyyy')}</p>
                </div>
            </div>

            <div className="flex items-center gap-3">
                <div className="relative">
                    <Select value={activeProjectId} onValueChange={setActiveProjectId}>
                        <SelectTrigger className="w-[180px] sm:w-[220px]">
                            <SelectValue placeholder={t('dashboard.selectProject')} />
                        </SelectTrigger>
                        <SelectContent>
                            {projects.length === 0 && <SelectItem value="none">No Project</SelectItem>}
                            {projects.map(p => (
                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex items-center gap-1">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 text-muted-foreground hover:text-foreground"
                                onClick={() => clearUntitledTodos()}
                            >
                                <Eraser className="w-[18px] h-[18px]" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>{t('dashboard.clearUntitled')}</p>
                        </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className={cn("h-9 w-9 transition-all", isPinned ? "text-primary bg-primary/10 rotate-45" : "text-muted-foreground hover:text-foreground")}
                                onClick={togglePin}
                            >
                                <span className="sr-only">Pin</span>
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-pin"><line x1="12" x2="12" y1="17" y2="22" /><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" /></svg>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>{isPinned ? t('dashboard.unpin') : t('dashboard.pin')}</p>
                        </TooltipContent>
                    </Tooltip>
                </div>
            </div>
        </div>
    );
}
`;
fs.writeFileSync(path.join(dir, 'DailyHeader.tsx'), dailyHeaderContent);

// 3. DailyGeneralWorkPanel.tsx
const generalWorkContent = `import React from 'react';
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
                            <div className="h-full bg-primary/60 transition-all duration-500" style={{ width: \`\${uniqueGeneralCompletion}%\` }} />
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
`;
fs.writeFileSync(path.join(dir, 'DailyGeneralWorkPanel.tsx'), generalWorkContent);

console.log('Daily UI Components created in src/components/dashboard/daily/');
