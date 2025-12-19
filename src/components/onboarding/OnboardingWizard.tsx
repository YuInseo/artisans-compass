import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, ChevronRight, Sparkles, ArrowRight } from "lucide-react";
import { useDataStore } from "@/hooks/useDataStore";
import { Project } from "@/types";
import { v4 as uuidv4 } from "uuid";
import { format, addDays } from "date-fns";

interface OnboardingWizardProps {
    isOpen: boolean;
    onComplete: () => void;
}

const COMMON_APPS = [
    { name: "CLIP Studio Paint", process: "CLIPStudioPaint" },
    { name: "Photoshop", process: "Photoshop" },
    { name: "Aseprite", process: "Aseprite" },
    { name: "Blender", process: "blender" },
    { name: "VS Code", process: "Code" },
];

export function OnboardingWizard({ isOpen, onComplete }: OnboardingWizardProps) {
    const { settings, saveSettings, saveProjects } = useDataStore();
    const [step, setStep] = useState(1);

    // Step 2 State
    const [selectedApps, setSelectedApps] = useState<string[]>([]);
    const [customApp, setCustomApp] = useState("");

    // Step 3 State
    const [projectName, setProjectName] = useState("My First Project");

    const toggleApp = (proc: string) => {
        if (selectedApps.includes(proc)) {
            setSelectedApps(selectedApps.filter(p => p !== proc));
        } else {
            setSelectedApps([...selectedApps, proc]);
        }
    };

    const handleAddCustomApp = () => {
        if (customApp && !selectedApps.includes(customApp)) {
            setSelectedApps([...selectedApps, customApp]);
            setCustomApp("");
        }
    };

    const handleFinish = async () => {
        // 1. Save Settings
        if (settings) {
            const newPatterns = Array.from(new Set([...settings.targetProcessPatterns, ...selectedApps]));
            await saveSettings({
                ...settings,
                targetProcessPatterns: newPatterns.length > 0 ? newPatterns : ["CLIPStudioPaint"],
                hasCompletedOnboarding: true
            });
        }

        // 2. Create First Project
        const newProject: Project = {
            id: uuidv4(),
            name: projectName,
            type: "Main",
            startDate: format(new Date(), 'yyyy-MM-dd'),
            endDate: format(addDays(new Date(), 14), 'yyyy-MM-dd'),
            isCompleted: false
        };
        await saveProjects([newProject]); // Assuming overwrite for first run, or append? better append if logic allows, but 'saveProjects' replaces. 
        // Logic in useDataStore: 'saveProjects' calls 'ipc.saveProjects' which overwrites file.
        // Since it's onboarding, overwriting or initial set is fine.

        onComplete();
    };

    return (
        <Dialog open={isOpen} onOpenChange={() => { }}>
            <DialogContent className="sm:max-w-2xl bg-card p-0 overflow-hidden gap-0 rounded-2xl shadow-2xl border-border">
                <div className="flex h-[500px]">
                    {/* Sidebar / Progress */}
                    <div className="w-1/3 bg-slate-900 text-white p-8 flex flex-col justify-between relative overflow-hidden dark:bg-black/40">
                        <div className="relative z-10">
                            <h2 className="text-xl font-bold font-serif mb-6 flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-blue-400" />
                                Artisan's Compass
                            </h2>
                            <div className="flex items-center gap-4 mb-6">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-500 ${step >= 1 ? 'bg-primary text-primary-foreground shadow-lg scale-100' : 'bg-muted text-muted-foreground scale-90'}`}>1</div>
                                <div className={`flex items-center gap-3 text-sm ${step === 1 ? 'text-primary-foreground font-bold' : 'text-muted-foreground'}`}>
                                    <span>Welcome</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 mb-6">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-500 ${step >= 2 ? 'bg-primary text-primary-foreground shadow-lg scale-100' : 'bg-muted text-muted-foreground scale-90'}`}>2</div>
                                <div className={`flex items-center gap-3 text-sm ${step === 2 ? 'text-primary-foreground font-bold' : 'text-muted-foreground'}`}>
                                    <span>Tool Stack</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-500 ${step >= 3 ? 'bg-primary text-primary-foreground shadow-lg scale-100' : 'bg-muted text-muted-foreground scale-90'}`}>3</div>
                                <div className={`flex items-center gap-3 text-sm ${step === 3 ? 'text-primary-foreground font-bold' : 'text-muted-foreground'}`}>
                                    <span>First Voyage</span>
                                </div>
                            </div>

                            {/* Decorative Circle */}
                            <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-blue-600/20 rounded-full blur-3xl z-0 pointer-events-none"></div>
                        </div>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 p-10 flex flex-col bg-background/50">
                        {step === 1 && (
                            <div className="flex-1 flex flex-col justify-center animate-in fade-in slide-in-from-right-4">
                                <h1 className="text-3xl font-bold text-foreground mb-4">Craft Your Journey.</h1>
                                <p className="text-muted-foreground leading-relaxed mb-8">
                                    Artisan's Compass helps you separate <b>Doing</b> from <b>Thinking</b>.
                                    <br /><br />
                                    We'll track your immersion time automatically so you can focus on creating.
                                </p>
                                <Button onClick={() => setStep(2)} className="w-fit rounded-full px-8 h-12 bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg group">
                                    Let's Begin <ChevronRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                                </Button>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="flex-1 flex flex-col animate-in fade-in slide-in-from-right-4">
                                <h2 className="text-xl font-bold text-foreground mb-2">What tools do you use?</h2>
                                <p className="text-sm text-muted-foreground mb-6">Select the applications to track automatically.</p>

                                <div className="grid grid-cols-2 gap-3 mb-6">
                                    {COMMON_APPS.map(app => (
                                        <div
                                            key={app.process}
                                            onClick={() => toggleApp(app.process)}
                                            className={`p-3 rounded-lg border-2 cursor-pointer transition-all flex items-center gap-3 ${selectedApps.includes(app.process) ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 bg-card'}`}
                                        >
                                            <div className={`w-5 h-5 rounded flex items-center justify-center ${selectedApps.includes(app.process) ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                                                {selectedApps.includes(app.process) && <Check className="w-3 h-3" />}
                                            </div>
                                            <span className="text-sm font-medium text-foreground">{app.name}</span>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-auto">
                                    <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Add Custom Process (.exe)</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            placeholder="e.g. Maya"
                                            value={customApp}
                                            onChange={(e) => setCustomApp(e.target.value)}
                                            className="bg-card"
                                        />
                                        <Button onClick={handleAddCustomApp} variant="outline" size="icon" className="shrink-0"><PlusIcon className="w-4 h-4" /></Button>
                                    </div>
                                </div>

                                <div className="flex justify-end mt-8">
                                    <Button onClick={() => setStep(3)} disabled={selectedApps.length === 0} className="rounded-full px-8 h-11 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md">
                                        Next
                                    </Button>
                                </div>
                            </div>
                        )}

                        {step === 3 && (
                            <div className="flex-1 flex flex-col animate-in fade-in slide-in-from-right-4">
                                <h2 className="text-xl font-bold text-foreground mb-2">Start your first voyage.</h2>
                                <p className="text-sm text-muted-foreground mb-8">Create a project to visualize your timeline.</p>

                                <div className="bg-card p-6 rounded-xl border border-border shadow-sm space-y-4">
                                    <div>
                                        <Label className="mb-2 block">Project Name</Label>
                                        <Input
                                            value={projectName}
                                            onChange={(e) => setProjectName(e.target.value)}
                                            className="text-lg font-medium border-border focus:border-ring h-12"
                                        />
                                    </div>

                                    <div className="flex gap-4 pt-2">
                                        <div className="flex-1 bg-muted p-3 rounded-lg border border-border">
                                            <Label className="text-xs text-muted-foreground mb-1 block">Start Date</Label>
                                            <div className="font-mono text-sm">{format(new Date(), 'MMM dd')}</div>
                                        </div>
                                        <div className="flex items-center text-muted-foreground"><ArrowRight className="w-4 h-4" /></div>
                                        <div className="flex-1 bg-muted p-3 rounded-lg border border-border">
                                            <Label className="text-xs text-muted-foreground mb-1 block">Deadline (Goal)</Label>
                                            <div className="font-mono text-sm">{format(addDays(new Date(), 14), 'MMM dd')}</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-end mt-auto">
                                    <Button onClick={handleFinish} disabled={!projectName.trim()} className="rounded-full px-8 h-12 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-blue-500/20 font-semibold group">
                                        Launch Compass <Sparkles className="w-4 h-4 ml-2 group-hover:rotate-12 transition-transform" />
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

function PlusIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M5 12h14" />
            <path d="M12 5v14" />
        </svg>
    );
}
