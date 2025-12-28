import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, ChevronRight, Sparkles, ArrowRight, Plus } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useDataStore } from "@/hooks/useDataStore";
import { useTodoStore } from "@/hooks/useTodoStore";
import { Project } from "@/types";
import { v4 as uuidv4 } from "uuid";
import { format, addDays } from "date-fns";
import { useTranslation } from "react-i18next";

interface OnboardingWizardProps {
    isOpen: boolean;
    onComplete: () => void;
}

const COMMON_APPS: { name: string; process: string }[] = [];

export function OnboardingWizard({ isOpen, onComplete }: OnboardingWizardProps) {
    const { t } = useTranslation();
    const { settings, saveSettings, saveProjects } = useDataStore();
    const { setActiveProjectId } = useTodoStore();
    const [step, setStep] = useState(1);
    const [selectedApps, setSelectedApps] = useState<string[]>([]);
    const [runningApps, setRunningApps] = useState<{ name: string, process: string }[]>([]);
    const [customApp, setCustomApp] = useState("");
    const [projectName, setProjectName] = useState("My First Project");
    const [startDate, setStartDate] = useState<Date>(new Date());
    const [endDate, setEndDate] = useState<Date>(addDays(new Date(), 14));

    useEffect(() => {
        if (isOpen && step === 2) {
            if ((window as any).ipcRenderer) {
                (window as any).ipcRenderer.invoke('get-running-apps').then((apps: any[]) => {
                    setRunningApps(apps || []);
                });
            }
        }
    }, [isOpen, step]);

    const toggleApp = (process: string) => {
        setSelectedApps(prev =>
            prev.includes(process)
                ? prev.filter(p => p !== process)
                : [...prev, process]
        );
    };

    const handleAddCustomApp = () => {
        if (!customApp.trim()) return;
        setSelectedApps(prev => [...prev, customApp.trim()]);
        setCustomApp("");
    };

    const handleFinish = async () => {
        // 1. Save Settings (Robust)
        let currentSettings = settings;
        if (!currentSettings && (window as any).ipcRenderer) {
            try {
                currentSettings = await (window as any).ipcRenderer.invoke('get-settings');
            } catch (e) {
                console.error("Failed to fetch settings during onboarding", e);
            }
        }

        if (currentSettings) {
            const existingPatterns = currentSettings.targetProcessPatterns || [];
            const newPatterns = Array.from(new Set([...existingPatterns, ...selectedApps]));

            await saveSettings({
                ...currentSettings,
                targetProcessPatterns: newPatterns.length > 0 ? newPatterns : existingPatterns,
                hasCompletedOnboarding: true
            });
        }

        // 2. Create First Project
        const newProject: Project = {
            id: uuidv4(),
            name: projectName,
            type: "Main",
            startDate: format(startDate, 'yyyy-MM-dd'),
            endDate: format(endDate, 'yyyy-MM-dd'),
            isCompleted: false
        };
        await saveProjects([newProject]);

        // 3. Set as Active Project
        setActiveProjectId(newProject.id);

        onComplete();
    };

    return (
        <Dialog open={isOpen} onOpenChange={() => { }}>
            <DialogContent className="sm:max-w-xl bg-background/95 backdrop-blur-xl border-border/50 shadow-2xl p-0 overflow-hidden outline-none duration-500">
                <div className="relative p-8 min-h-[480px] flex flex-col">

                    {/* Background decoration */}
                    <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-60 h-60 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

                    {/* Step Indicator */}
                    <div className="flex justify-center mb-8 relative z-10">
                        <div className="flex items-center gap-3 bg-muted/50 p-1.5 rounded-full backdrop-blur-sm">
                            {[1, 2, 3].map((s) => (
                                <div
                                    key={s}
                                    className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${step === s ? 'bg-primary scale-125' : step > s ? 'bg-primary/50' : 'bg-muted-foreground/30'}`}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 flex flex-col relative z-10">
                        {step === 1 && (
                            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
                                <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-2">
                                    <Sparkles className="w-8 h-8 text-primary" />
                                </div>
                                <div className="space-y-2">
                                    <h1 className="text-3xl font-bold tracking-tight">{t('onboarding.welcome')}</h1>
                                    <p className="text-muted-foreground text-lg max-w-sm mx-auto">
                                        {t('onboarding.description')}
                                    </p>
                                </div>

                                <div className="pt-8">
                                    <Button size="lg" onClick={() => setStep(2)} className="rounded-full px-8 h-12 text-base shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all">
                                        {t('onboarding.startSetup')} <ChevronRight className="w-4 h-4 ml-2" />
                                    </Button>
                                </div>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="flex-1 flex flex-col animate-in fade-in slide-in-from-right-8 duration-500">
                                <div className="mb-6 text-center">
                                    <h2 className="text-2xl font-bold mb-2">{t('onboarding.selectTools')}</h2>
                                    <p className="text-muted-foreground">{t('onboarding.toolsDescription')}</p>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-2 gap-3 mb-6 max-h-[240px] overflow-y-auto custom-scrollbar p-1">
                                    {/* Running Apps + Common Apps */}
                                    {[...runningApps, ...COMMON_APPS.filter(c => !runningApps.some(r => r.process === c.process))].map(app => (
                                        <div
                                            key={app.process}
                                            onClick={() => toggleApp(app.process)}
                                            className={`
                                                group relative p-3 rounded-xl border cursor-pointer transition-all duration-200 flex items-center gap-3
                                                ${selectedApps.includes(app.process)
                                                    ? 'border-primary bg-primary/5 shadow-sm'
                                                    : 'border-border/50 bg-card/50 hover:border-primary/50 hover:bg-card'
                                                }
                                            `}
                                        >
                                            <div className={`
                                                w-8 h-8 rounded-lg flex items-center justify-center transition-colors
                                                ${selectedApps.includes(app.process)
                                                    ? 'bg-primary text-primary-foreground'
                                                    : 'bg-muted text-muted-foreground group-hover:bg-muted/80'
                                                }
                                            `}>
                                                {selectedApps.includes(app.process) ? <Check className="w-4 h-4" /> : <div className="w-2 h-2 rounded-full bg-current opacity-50" />}
                                            </div>
                                            <div className="flex flex-col overflow-hidden text-left">
                                                <span className="text-sm font-semibold truncate">{app.name}</span>
                                                <span className="text-[10px] text-muted-foreground truncate opacity-70">{app.process}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-auto space-y-4">
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                                            <Plus className="h-4 w-4 text-muted-foreground" />
                                        </div>
                                        <Input
                                            placeholder={t('onboarding.addCustom')}
                                            value={customApp}
                                            onChange={(e) => setCustomApp(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleAddCustomApp()}
                                            className="pl-9 bg-muted/30 border-border/50 focus:bg-background transition-all"
                                        />
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={handleAddCustomApp}
                                            className="absolute right-1 top-1 h-8 px-3"
                                            disabled={!customApp.trim()}
                                        >
                                            {t('onboarding.add')}
                                        </Button>
                                    </div>

                                    <div className="flex justify-between items-center pt-2">
                                        <Button variant="ghost" onClick={() => setStep(1)} className="text-muted-foreground hover:text-foreground">{t('onboarding.back')}</Button>
                                        <Button onClick={() => setStep(3)} disabled={selectedApps.length === 0} className="rounded-full px-8">
                                            {t('onboarding.nextStep')}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {step === 3 && (
                            <div className="flex-1 flex flex-col animate-in fade-in slide-in-from-right-8 duration-500">
                                <div className="mb-8 text-center">
                                    <h2 className="text-2xl font-bold mb-2">{t('onboarding.nameVoyage')}</h2>
                                    <p className="text-muted-foreground">{t('onboarding.voyageDescription')}</p>
                                </div>

                                <div className="bg-card/50 backdrop-blur-sm p-6 rounded-2xl border border-border/50 shadow-sm space-y-6">
                                    <div className="space-y-2">
                                        <Label className="text-sm font-medium ml-1">{t('onboarding.projectTitle')}</Label>
                                        <Input
                                            value={projectName}
                                            onChange={(e) => setProjectName(e.target.value)}
                                            className="text-lg h-12 bg-background border-border/60 focus:ring-2 ring-primary/20 transition-all font-medium"
                                            placeholder={t('onboarding.projectPlaceholder')}
                                            autoFocus
                                        />
                                    </div>

                                    <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border/30 text-sm text-muted-foreground">
                                        <div className="flex-1 flex flex-col gap-1">
                                            <span className="text-xs uppercase tracking-wider opacity-70 text-center mb-1">{t('onboarding.start')}</span>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button variant="outline" className={cn("w-full justify-center text-center font-mono font-medium h-9 bg-background/50 hover:bg-background border-border/50", !startDate && "text-muted-foreground")}>
                                                        {startDate ? format(startDate, "MMM dd") : <span>{t('onboarding.pickDate')}</span>}
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0" align="start">
                                                    <Calendar mode="single" selected={startDate} onSelect={(date) => date && setStartDate(date)} initialFocus />
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                        <ArrowRight className="w-4 h-4 opacity-30 mt-6" />
                                        <div className="flex-1 flex flex-col gap-1">
                                            <span className="text-xs uppercase tracking-wider opacity-70 text-center mb-1">{t('onboarding.goal')}</span>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button variant="outline" className={cn("w-full justify-center text-center font-mono font-medium h-9 bg-background/50 hover:bg-background border-border/50", !endDate && "text-muted-foreground")}>
                                                        {endDate ? format(endDate, "MMM dd") : <span>{t('onboarding.pickDate')}</span>}
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0" align="start">
                                                    <Calendar mode="single" selected={endDate} onSelect={(date) => date && setEndDate(date)} initialFocus />
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-between items-center mt-auto pt-6">
                                    <Button variant="ghost" onClick={() => setStep(2)} className="text-muted-foreground hover:text-foreground">{t('onboarding.back')}</Button>
                                    <Button
                                        onClick={handleFinish}
                                        disabled={!projectName.trim()}
                                        className="rounded-full px-8 h-11 bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all duration-300"
                                    >
                                        {t('onboarding.launch')} <Sparkles className="w-4 h-4 ml-2" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

