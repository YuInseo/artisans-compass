import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useState, useEffect } from "react";
import { ChevronRight, ChevronLeft, Flag, CheckCircle2, Layout, Calendar as CalendarIcon, Settings } from "lucide-react";
import { useDataStore } from "@/hooks/useDataStore";

export function OnboardingOverlay() {
    const { settings, saveSettings } = useDataStore();
    const [open, setOpen] = useState(false);
    const [step, setStep] = useState(0);

    useEffect(() => {
        if (settings && !settings.hasCompletedOnboarding) {
            setOpen(true);
        }
    }, [settings?.hasCompletedOnboarding]);

    const handleComplete = () => {
        if (settings) {
            saveSettings({ ...settings, hasCompletedOnboarding: true });
        }
        setOpen(false);
    };

    const steps = [
        {
            title: "Welcome to Artisan's Compass",
            description: "Your focused workspace for daily craftsmanship. Let's take a quick tour.",
            icon: <Flag className="w-12 h-12 text-primary" />,
            image: null
        },
        {
            title: "The Timeline",
            description: "Top bar shows your active Projects. Drag to resize duration. Lock them when planning is done.",
            icon: <Layout className="w-12 h-12 text-blue-500" />,
            image: null // Placeholder for screenshot if needed
        },
        {
            title: "Daily Focus",
            description: "The left panel is your Todo tree. Break down tasks. Drag to reorder. 'End Day' to log your progress.",
            icon: <CheckCircle2 className="w-12 h-12 text-green-500" />,
            image: null
        },
        {
            title: "Calendar & Review",
            description: "Navigate past days to see what you accomplished. View your 'Journey Log' and Timelapse.",
            icon: <CalendarIcon className="w-12 h-12 text-purple-500" />,
            image: null
        },
        {
            title: "Focus & Settings",
            description: "Toggle Focus Mode (Eye icon) to hide distractions. Pin the app to stay on top.",
            icon: <Settings className="w-12 h-12 text-orange-500" />,
            image: null
        }
    ];

    const currentStep = steps[step];

    return (
        <Dialog open={open} onOpenChange={(open) => {
            if (!open && step === steps.length - 1) handleComplete();
            // Optional: allow closing midway, but maybe reminder?
            if (!open) setOpen(false);
        }}>
            <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden bg-background border-border shadow-2xl">
                <div className="flex flex-col h-[400px]">
                    {/* Hero Section */}
                    <div className="flex-1 bg-muted/30 flex flex-col items-center justify-center p-8 text-center gap-4">
                        <div className="p-4 bg-background rounded-full shadow-sm border border-border animate-in zoom-in duration-300">
                            {currentStep.icon}
                        </div>
                        <h2 className="text-2xl font-bold tracking-tight">{currentStep.title}</h2>
                        <p className="text-muted-foreground max-w-xs mx-auto">
                            {currentStep.description}
                        </p>
                    </div>

                    {/* Footer / Nav */}
                    <div className="p-6 border-t border-border flex items-center justify-between bg-background">
                        <div className="flex gap-1">
                            {steps.map((_, i) => (
                                <div
                                    key={i}
                                    className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? 'w-6 bg-primary' : 'w-1.5 bg-muted-foreground/30'}`}
                                />
                            ))}
                        </div>

                        <div className="flex gap-2">
                            {step > 0 && (
                                <Button variant="ghost" onClick={() => setStep(step - 1)}>
                                    <ChevronLeft className="w-4 h-4 mr-1" /> Back
                                </Button>
                            )}

                            {step < steps.length - 1 ? (
                                <Button onClick={() => setStep(step + 1)}>
                                    Next <ChevronRight className="w-4 h-4 ml-1" />
                                </Button>
                            ) : (
                                <Button onClick={handleComplete}>
                                    Get Started
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
