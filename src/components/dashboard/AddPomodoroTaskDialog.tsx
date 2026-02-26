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

                <div className="grid gap-6 py-4">
                    {/* Icon and Title */}
                    <div className="flex items-center gap-3">
                        <div className="relative group cursor-pointer w-12 h-12 rounded-full bg-green-200 flex items-center justify-center shrink-0 border-2 border-transparent hover:border-border transition-colors">
                            <span className="text-2xl">{icon}</span>
                            <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5 border shadow-sm">
                                <Edit2 className="w-3 h-3 text-muted-foreground" />
                            </div>
                        </div>
                        <div className="flex-1 relative">
                            <Input
                                placeholder={t('pomodoro.description', '설명')}
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="pr-10 rounded-xl border-blue-200 focus-visible:ring-blue-500/20 focus-visible:border-blue-500 transition-all h-10"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSave();
                                }}
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                <LinkIcon className="w-4 h-4" />
                            </div>
                        </div>
                    </div>

                    {/* Timer Mode Option */}
                    <div className="space-y-4">
                        <Label className="text-sm font-medium">{t('pomodoro.timerMode', '타이머 모드')}</Label>
                        <div className="space-y-3">
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <div className="relative flex items-center justify-center">
                                    <input
                                        type="radio"
                                        name="timerMode"
                                        value="pomodoro"
                                        checked={timerMode === 'pomodoro'}
                                        onChange={() => setTimerMode('pomodoro')}
                                        className="peer sr-only"
                                    />
                                    <div className="w-4 h-4 rounded-full border border-primary/50 peer-checked:border-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary/30 transition-all"></div>
                                    <div className="absolute w-2 h-2 rounded-full bg-primary opacity-0 peer-checked:opacity-100 transition-opacity"></div>
                                </div>
                                <span className="text-sm font-medium group-hover:text-foreground/80 transition-colors">{t('pomodoro.pomo', '포모')}</span>
                                <Input
                                    type="number"
                                    className="w-16 h-8 text-sm text-center px-1 bg-muted/50 border-none rounded-lg focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:bg-background transition-all"
                                    value={targetMinutes}
                                    onChange={(e) => setTargetMinutes(parseInt(e.target.value) || 0)}
                                    disabled={timerMode !== 'pomodoro'}
                                />
                                <span className="text-sm text-muted-foreground">{t('pomodoro.minutes', '분')}</span>
                            </label>

                            <label className="flex items-center gap-3 cursor-pointer group">
                                <div className="relative flex items-center justify-center">
                                    <input
                                        type="radio"
                                        name="timerMode"
                                        value="stopwatch"
                                        checked={timerMode === 'stopwatch'}
                                        onChange={() => setTimerMode('stopwatch')}
                                        className="peer sr-only"
                                    />
                                    <div className="w-4 h-4 rounded-full border border-primary/50 peer-checked:border-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary/30 transition-all"></div>
                                    <div className="absolute w-2 h-2 rounded-full bg-primary opacity-0 peer-checked:opacity-100 transition-opacity"></div>
                                </div>
                                <span className="text-sm font-medium group-hover:text-foreground/80 transition-colors">{t('pomodoro.stopwatch', '스톱워치')}</span>
                            </label>
                        </div>
                    </div>
                </div>

                <DialogFooter className="flex items-center sm:justify-between sm:space-x-4 border-t pt-4">
                    <div className="flex-1" />
                    <Button
                        type="button"
                        className="bg-blue-400 hover:bg-blue-500 text-white min-w-[100px] w-full sm:w-auto font-medium rounded-xl"
                        onClick={handleSave}
                        disabled={!title.trim()}
                    >
                        {t('common.save', '저장')}
                    </Button>
                    <DialogClose asChild>
                        <Button type="button" variant="outline" className="min-w-[100px] w-full sm:w-auto font-medium rounded-xl">
                            {t('common.cancel', '취소')}
                        </Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
