import { useTranslation } from "react-i18next";
import { useState } from "react";
import { usePomodoroStore } from "@/hooks/usePomodoroStore";
import { useDataStore } from "@/hooks/useDataStore";
import { Button } from "@/components/ui/button";
import { Play, Pause, Square, Target } from "lucide-react";
import { format } from "date-fns";

export function PomodoroPanel() {
    const { t } = useTranslation();
    const pomodoro = usePomodoroStore();
    const dataStore = useDataStore();
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

    // Format time left (mm:ss)
    const minutes = Math.floor(pomodoro.timeLeft / 60);
    const seconds = pomodoro.timeLeft % 60;
    const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    const activeTask = pomodoro.tasks.find(t => t.id === pomodoro.activeTaskId);

    // Calculate total focus time (hh:mm)
    const totalFocusHours = Math.floor(pomodoro.todayTotalFocusTime / 3600);
    const totalFocusMinutes = Math.floor((pomodoro.todayTotalFocusTime % 3600) / 60);

    return (
        <div className="flex-1 flex bg-background h-full text-foreground relative z-0">
            {/* Left Sidebar: Projects/Routines */}
            <div className="w-[300px] border-r border-border/50 flex flex-col bg-muted/5">
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
                    {pomodoro.tasks.map(task => {
                        const isRunning = pomodoro.activeTaskId === task.id && pomodoro.status === 'running';
                        const isSelected = selectedTaskId === task.id;
                        return (
                            <div
                                key={task.id}
                                className={`flex items-center justify-between p-3 rounded-lg group cursor-pointer border border-transparent transition-colors ${isSelected ? 'bg-muted/50 border-border/50 shadow-sm' : 'hover:bg-muted/30'}`}
                                onClick={() => setSelectedTaskId(task.id)}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs bg-orange-500/10 text-orange-500">
                                        {task.icon || '🔥'}
                                    </div>
                                    <span className={`font-medium text-sm ${isSelected ? 'text-foreground' : 'text-foreground/80'}`}>{task.title}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`text-xs font-bold text-muted-foreground px-2 py-0.5 rounded-full ${isSelected ? 'bg-background shadow-sm' : 'bg-muted'}`}>{task.focusCount} 🍅</span>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className={`h-6 w-6 rounded-full text-blue-500 hover:bg-blue-500/10 hover:text-blue-600 transition-opacity ${isRunning ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (isRunning) {
                                                pomodoro.pause();
                                            } else {
                                                pomodoro.start(task.id);
                                            }
                                        }}
                                    >
                                        {isRunning ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                                    </Button>
                                </div>
                            </div>
                        );
                    })}

                </div>

                {/* Bottom Left: Global Timer Controls (if active) */}
                {pomodoro.activeTaskId && (
                    <div className="h-20 border-t border-border/50 bg-background flex items-center justify-between px-6 shrink-0 shadow-[0_-4px_20px_rgba(0,0,0,0.02)]">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-sm">
                                🔥
                            </div>
                            <div className="flex flex-col">
                                <span className="text-xs font-semibold text-muted-foreground">{activeTask?.title}</span>
                                <span className="text-lg font-bold font-mono tracking-wider">{timeString}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost" size="icon" className="h-10 w-10 rounded-full bg-blue-500/10 text-blue-600 hover:bg-blue-500/20"
                                onClick={() => pomodoro.status === 'running' ? pomodoro.pause() : pomodoro.resume()}
                            >
                                {pomodoro.status === 'running' ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
                            </Button>
                            <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:bg-muted" onClick={() => pomodoro.stop()}>
                                <Square className="w-4 h-4 fill-current" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Central Area: Active Timer */}
            <div className="flex-1 flex flex-col items-center justify-center relative">
                {pomodoro.activeTaskId ? (
                    <div className="flex flex-col items-center animate-in zoom-in-95 duration-500">
                        <div className="text-sm font-medium text-muted-foreground mb-8 flex items-center gap-2">
                            <span>{activeTask?.title}</span>
                            <span className="text-muted-foreground/30">&gt;</span>
                        </div>

                        {/* Big Circle Timer */}
                        <div className="relative w-80 h-80 rounded-full border-[12px] border-muted/30 flex items-center justify-center mb-12 shadow-inner">
                            {/* Progress Ring Overlay (Mocked with simple arc or just rely on radial gradient / SVG) */}
                            <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 100 100">
                                <circle
                                    cx="50" cy="50" r="44"
                                    fill="none" stroke="currentColor" strokeWidth="12"
                                    className="text-blue-500 opacity-80"
                                    strokeDasharray="276"
                                    strokeDashoffset={276 - (276 * ((pomodoro.focusDuration - pomodoro.timeLeft) / pomodoro.focusDuration))}
                                    strokeLinecap="round"
                                />
                            </svg>
                            <div className="text-6xl font-black tracking-tight font-mono relative z-10 text-foreground">
                                {timeString}
                            </div>
                        </div>

                        <Button
                            variant="outline"
                            className="rounded-full px-8 py-6 text-blue-500 border-blue-500/30 hover:bg-blue-500/10 font-medium tracking-wide"
                            onClick={() => pomodoro.status === 'running' ? pomodoro.pause() : pomodoro.resume()}
                        >
                            {pomodoro.status === 'running' ? '일시 중지' : '다시 시작'}
                        </Button>
                    </div>
                ) : (
                    <div className="text-muted-foreground flex flex-col items-center text-center opacity-50">
                        <div className="w-24 h-24 mb-6 rounded-full border-4 border-dashed border-muted-foreground/20 flex items-center justify-center">
                            <Target className="w-8 h-8" />
                        </div>
                        <p className="text-lg font-medium">{t('pomodoro.selectTask', '포모도로를 시작할 항목을 선택해주세요.')}</p>
                    </div>
                )}
            </div>

            {/* Right Sidebar: Stats & Logs */}
            <div className="w-[350px] border-l border-border/50 bg-muted/5 flex flex-col">
                {selectedTaskId ? (() => {
                    const selectedTask = pomodoro.tasks.find(t => t.id === selectedTaskId);
                    if (!selectedTask) return null;
                    return (
                        <div className="p-6 h-full flex flex-col overflow-y-auto">
                            {/* Header: Icon, Title, Subtitle */}
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-12 h-12 rounded-full bg-green-300/40 text-green-600 flex items-center justify-center text-2xl shadow-sm">
                                    {selectedTask.icon || '🙂'}
                                </div>
                                <div className="flex flex-col">
                                    <h2 className="text-xl font-bold text-foreground">{selectedTask.title}</h2>
                                    <p className="text-sm text-muted-foreground font-medium">
                                        {selectedTask.timerMode === 'stopwatch' ? '스톱워치 ' : `포모 ${selectedTask.targetMinutes || 60} m`}
                                    </p>
                                </div>
                            </div>

                            {/* Stats Row */}
                            <div className="grid grid-cols-3 gap-3 mb-8">
                                <div className="bg-muted/40 rounded-xl p-3 shadow-sm border border-border/30">
                                    <div className="text-[11px] text-muted-foreground font-medium mb-1 truncate">{t('pomodoro.focusDays', '집중 일수')}</div>
                                    <div className="text-2xl font-semibold">{selectedTask.focusCount > 0 ? 1 : 0}</div>
                                </div>
                                <div className="bg-muted/40 rounded-xl p-3 shadow-sm border border-border/30">
                                    <div className="text-[11px] text-muted-foreground font-medium mb-1 truncate">{t('pomodoro.todaysFocus', '오늘의 초점')}</div>
                                    <div className="text-2xl font-semibold">0<span className="text-sm font-medium ml-0.5 text-muted-foreground">m</span></div>
                                </div>
                                <div className="bg-muted/40 rounded-xl p-3 shadow-sm border border-border/30">
                                    <div className="text-[11px] text-muted-foreground font-medium mb-1 truncate">{t('pomodoro.totalFocus', '총 집중 시간')}</div>
                                    <div className="text-2xl font-semibold">{Math.round((selectedTask.focusCount * (selectedTask.targetMinutes || 60)))}<span className="text-sm font-medium ml-0.5 text-muted-foreground">m</span></div>
                                </div>
                            </div>

                            {/* Chart Area */}
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-end gap-1">
                                    <span className="text-2xl font-semibold">0</span>
                                    <span className="text-sm font-medium text-muted-foreground mb-1">m</span>
                                </div>
                                <select className="bg-transparent border border-border/50 text-foreground/80 rounded-full px-3 py-1 text-xs outline-none focus-visible:ring-1 focus-visible:ring-primary/30">
                                    <option>{t('pomodoro.weekly', '주')} v</option>
                                </select>
                            </div>

                            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-6 font-medium">
                                <button className="hover:text-foreground transition-colors">&lt;</button>
                                <span>2월 22일 - 2월 28일</span>
                                <button className="hover:text-foreground transition-colors">&gt;</button>
                            </div>

                            {/* Mock Chart Area */}
                            <div className="h-44 border-t border-b border-border/30 flex flex-col pt-3 pb-8 relative mt-auto">
                                {/* Horizontal grid lines & labels */}
                                <div className="absolute right-0 top-0 bottom-8 flex flex-col justify-between text-[10px] text-muted-foreground/60 w-8 items-end pointer-events-none">
                                    <span>1h</span>
                                    <span>40m</span>
                                    <span>20m</span>
                                    <span>0m</span>
                                </div>
                                {/* Grid lines background */}
                                <div className="absolute inset-x-0 inset-y-0 mr-10 pointer-events-none flex flex-col justify-between pt-1 pb-10">
                                    <div className="border-t border-dashed border-border/40 w-full h-0"></div>
                                    <div className="border-t border-dashed border-border/40 w-full h-0"></div>
                                    <div className="border-t border-dashed border-border/40 w-full h-0"></div>
                                    <div className="border-t border-dashed border-border/40 w-full h-0"></div>
                                </div>
                                {/* Vertical bars area */}
                                <div className="flex-1 flex items-end justify-between mr-10 px-2 z-10">
                                    {['일', '월', '화', '수', '목', '금', '토'].map((day) => (
                                        <div key={day} className="flex flex-col items-center gap-2 w-8 h-full justify-end">
                                            {/* <div className="w-full bg-blue-500 rounded-sm" style={{ height: '0%' }}></div> */}
                                        </div>
                                    ))}
                                </div>
                                {/* X-Axis Labels */}
                                <div className="absolute bottom-2 left-0 right-10 flex justify-between px-2 text-[10px] text-muted-foreground/60 font-medium">
                                    {['일', '월', '화', '수', '목', '금', '토'].map(day => (
                                        <span key={day} className="w-8 text-center">{day}</span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    );
                })() : (
                    <>
                        <div className="p-6">
                            <h3 className="font-bold mb-6 text-lg">{t('pomodoro.overview', '개요')}</h3>
                            <div className="grid grid-cols-2 gap-3 mb-8">
                                <div className="bg-card border border-border/50 p-4 rounded-xl shadow-sm">
                                    <div className="text-xs text-muted-foreground font-medium mb-1 truncate">{t('pomodoro.todayPomos', '오늘의 포모스')}</div>
                                    <div className="text-2xl font-bold">{pomodoro.completedPomodoros}</div>
                                </div>
                                <div className="bg-card border border-border/50 p-4 rounded-xl shadow-sm">
                                    <div className="text-xs text-muted-foreground font-medium mb-1 truncate">{t('pomodoro.todayFocus', '오늘의 포커스')}</div>
                                    <div className="text-2xl font-bold">
                                        {totalFocusHours > 0 ? `${totalFocusHours}h ` : ''}{totalFocusMinutes}m
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between mb-6">
                                <h3 className="font-bold text-lg">{t('pomodoro.focusLog', '집중 기록')}</h3>
                            </div>

                            <div className="space-y-6">
                                {dataStore.dailyLog?.sessions && dataStore.dailyLog!.sessions.length > 0 ? (
                                    <div>
                                        <div className="text-xs font-bold text-muted-foreground mb-3">{format(new Date(), 'yyyy년 M월 d일')}</div>
                                        {dataStore.dailyLog!.sessions.slice().reverse().map((session, index) => {
                                            const startTime = new Date(session.startTime);
                                            const endTime = new Date(session.endTime);
                                            const mins = Math.round(session.durationSeconds / 60);
                                            return (
                                                <div key={index} className="pl-4 border-l-2 border-border relative pb-4 last:pb-0 pt-1">
                                                    <div className="absolute w-2 h-2 bg-blue-500 rounded-full -left-[5px] top-2 ring-4 ring-background"></div>
                                                    <div className="flex justify-between items-start mb-1">
                                                        <span className="text-xs font-medium text-muted-foreground">{format(startTime, 'a h:mm')} - {format(endTime, 'a h:mm')}</span>
                                                        <span className="text-xs text-muted-foreground">{mins}m</span>
                                                    </div>
                                                    <div className="text-sm font-medium">{session.process || "Unknown"}</div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-sm text-muted-foreground italic">오늘 집중한 기록이 없습니다.</div>
                                )}
                            </div>
                        </div>

                        <div className="mt-auto p-6 border-t border-border/10 bg-muted/10">
                            <h3 className="font-bold mb-3 text-sm">{t('pomodoro.focusNotes', '집중 노트')}</h3>
                            <textarea
                                className="w-full h-24 bg-card border border-border/50 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary/50"
                                placeholder={t('pomodoro.notesPlaceholder', '당신의 생각을 기록해보세요... 무슨 생각이 있나요?')}
                                value={pomodoro.notes}
                                onChange={(e) => pomodoro.setNotes(e.target.value)}
                            />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
