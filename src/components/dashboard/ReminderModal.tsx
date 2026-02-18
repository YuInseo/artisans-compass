import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Bell, ArrowRight } from "lucide-react";
import { useMemo } from "react";
import { useDataStore } from "@/hooks/useDataStore";

const DEFAULT_REMINDERS = [
    "Take a deep breath and relax.",
    "Drink some water.",
    "Stretch your body.",
    "Look away from the screen for 20 seconds.",
    "Check your posture."
];

interface ReminderModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function ReminderModal({ isOpen, onClose }: ReminderModalProps) {
    const { settings } = useDataStore();

    const reminder = useMemo(() => {
        const reminders = settings?.reminders && settings.reminders.length > 0
            ? settings.reminders
            : DEFAULT_REMINDERS;
        return reminders[Math.floor(Math.random() * reminders.length)];
    }, [settings?.reminders, isOpen]);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-xl bg-card/95 backdrop-blur-sm border-0 shadow-2xl rounded-2xl p-0 overflow-hidden">
                <div className="flex flex-col items-center justify-center p-10 min-h-[300px] text-center space-y-8 animate-in zoom-in-95 duration-500">
                    <Bell className="w-10 h-10 text-yellow-400 mb-2 animate-bounce" />

                    <div className="space-y-4 max-w-lg">
                        <h1 className="text-4xl font-serif text-muted-foreground/20 select-none absolute top-10 left-10 -z-10 opacity-50">!</h1>
                        <p className="text-xl md:text-2xl font-medium text-foreground leading-relaxed word-keep-all whitespace-pre-line">
                            {reminder}
                        </p>
                    </div>

                    <div className="w-24 h-1 bg-gradient-to-r from-yellow-100 via-yellow-200 to-yellow-100 rounded-full mx-auto opacity-50"></div>

                    <Button
                        onClick={onClose}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full px-8 h-12 text-base shadow-lg hover:shadow-xl transition-all group"
                    >
                        Got it <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
