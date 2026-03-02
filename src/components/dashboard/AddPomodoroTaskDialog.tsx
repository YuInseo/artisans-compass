import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePomodoroStore } from "@/hooks/usePomodoroStore";
import { Edit2, Link as LinkIcon } from "lucide-react";

interface AddPomodoroTaskDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function AddPomodoroTaskDialog({ open, onOpenChange }: AddPomodoroTaskDialogProps) {
    const { t } = useTranslation();
    const pomodoro = usePomodoroStore();

    const [title, setTitle] = useState("");
    const [timerMode, setTimerMode] = useState<'pomodoro' | 'stopwatch'>('pomodoro');
    const [targetMinutes, setTargetMinutes] = useState(60);
    const [icon, setIcon] = useState("🙂");

    const handleSave = () => {
        if (!title.trim()) return;

        pomodoro.addTask({
            title: title.trim(),
            timerMode,
            targetMinutes: timerMode === 'pomodoro' ? targetMinutes : undefined,
            icon
        });

        setTitle("");
        setTimerMode('pomodoro');
        setTargetMinutes(60);
        setIcon("🙂");
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{t('pomodoro.addCommonTask', '일반적으로 사용되는 집중 모드 추가하기')}</DialogTitle>
                </DialogHeader>

                <div className="grid gap-6 py-6 px-1">
                    {/* Icon and Title */}
                    <div className="flex items-center gap-4">
                        <div className="relative group cursor-pointer w-14 h-14 rounded-2xl bg-secondary/50 hover:bg-secondary flex items-center justify-center shrink-0 border border-border/50 hover:border-border transition-all">
                            <span className="text-2xl">{icon}</span>
                            <div className="absolute -bottom-2 -right-2 bg-background rounded-full p-1.5 border shadow-sm group-hover:bg-muted transition-colors">
                                <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                            </div>
                        </div>
                        <div className="flex-1 relative group tracking-tight">
                            <Input
                                placeholder={t('pomodoro.description', '설명')}
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="pr-10 rounded-xl border-border/50 bg-secondary/20 focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary/50 transition-all h-12 text-base shadow-inner"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSave();
                                }}
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors">
                                <LinkIcon className="w-4 h-4" />
                            </div>
                        </div>
                    </div>

                    {/* Timer Mode Option */}
                    <div className="space-y-4">
                        <Label className="text-sm font-semibold text-muted-foreground tracking-wide">{t('pomodoro.timerMode', '타이머 모드')}</Label>
                        <div className="space-y-4 pt-1">
                            <label className="flex items-center gap-4 cursor-pointer group">
                                <div className="relative flex items-center justify-center">
                                    <input
                                        type="radio"
                                        name="timerMode"
                                        value="pomodoro"
                                        checked={timerMode === 'pomodoro'}
                                        onChange={() => setTimerMode('pomodoro')}
                                        className="peer sr-only"
                                    />
                                    <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30 peer-checked:border-primary peer-focus-visible:ring-4 peer-focus-visible:ring-primary/20 transition-all"></div>
                                    <div className="absolute w-2.5 h-2.5 rounded-full bg-primary opacity-0 peer-checked:opacity-100 transition-opacity scale-50 peer-checked:scale-100"></div>
                                </div>
                                <span className="text-base font-medium text-muted-foreground group-hover:text-foreground transition-colors w-14">{t('pomodoro.pomo', '포모')}</span>
                                <div className="flex items-center gap-2">
                                    <Input
                                        type="number"
                                        className="w-20 h-10 text-base font-medium text-center bg-secondary/50 border-border/50 rounded-xl focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary/50 transition-all shadow-inner"
                                        value={targetMinutes}
                                        onChange={(e) => setTargetMinutes(parseInt(e.target.value) || 0)}
                                        disabled={timerMode !== 'pomodoro'}
                                    />
                                    <span className="text-sm font-medium text-muted-foreground">{t('pomodoro.minutes', '분')}</span>
                                </div>
                            </label>

                            <label className="flex items-center gap-4 cursor-pointer group">
                                <div className="relative flex items-center justify-center">
                                    <input
                                        type="radio"
                                        name="timerMode"
                                        value="stopwatch"
                                        checked={timerMode === 'stopwatch'}
                                        onChange={() => setTimerMode('stopwatch')}
                                        className="peer sr-only"
                                    />
                                    <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30 peer-checked:border-primary peer-focus-visible:ring-4 peer-focus-visible:ring-primary/20 transition-all"></div>
                                    <div className="absolute w-2.5 h-2.5 rounded-full bg-primary opacity-0 peer-checked:opacity-100 transition-opacity scale-50 peer-checked:scale-100"></div>
                                </div>
                                <span className="text-base font-medium text-muted-foreground group-hover:text-foreground transition-colors">{t('pomodoro.stopwatch', '스톱워치')}</span>
                            </label>
                        </div>
                    </div>
                </div>

                <DialogFooter className="flex items-center sm:justify-end gap-3 border-t border-border/50 pt-6 mt-2">
                    <DialogClose asChild>
                        <Button type="button" variant="ghost" className="min-w-[100px] w-full sm:w-auto font-medium rounded-xl hover:bg-secondary/80">
                            {t('common.cancel', '취소')}
                        </Button>
                    </DialogClose>
                    <Button
                        type="button"
                        className="bg-primary hover:bg-primary/90 text-primary-foreground min-w-[100px] w-full sm:w-auto font-medium rounded-xl shadow-sm transition-all"
                        onClick={handleSave}
                        disabled={!title.trim()}
                    >
                        {t('common.save', '저장')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
