import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { TimerWidget } from "../TimerWidget";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface DailyWidgetContentProps {
    isWidgetMode: boolean;
    settings: any;
    saveSettings: (settings: any) => void;
    manualQuote?: string | null;
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
                        backgroundColor: `hsl(var(--muted) / ${Math.max(0, (settings?.widgetOpacity ?? 0.95) * 0.3)})`,
                        borderColor: `hsl(var(--border) / ${Math.max(0, (settings?.widgetOpacity ?? 0.95) * 0.5)})`,
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
