import { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { CircleArrowUp, Loader2, Check } from "lucide-react";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error' | 'up-to-date';

export function UpdateChecker() {
    const [status, setStatus] = useState<UpdateStatus>('idle');
    const [progress, setProgress] = useState<number>(0);

    useEffect(() => {
        const electron = (window as any).electron;
        if (!electron) return;

        // Listen for update events
        const cleanups = [
            electron.on('update_available', () => setStatus('available')),
            electron.on('update_not_available', () => {
                setStatus('up-to-date');
                setTimeout(() => setStatus('idle'), 3000); // Hide after 3s
            }),
            electron.on('update_downloaded', () => setStatus('downloaded')),
            electron.on('update_error', () => {
                setStatus('error');
                setTimeout(() => setStatus('idle'), 5000);
            }),
            electron.on('update_progress', (percent: number) => {
                setStatus('downloading');
                setProgress(percent);
            }),
        ];

        return () => cleanups.forEach((cleanup: any) => cleanup());
    }, []);

    const checkForUpdates = async () => {
        if (status === 'checking' || status === 'downloading') return;

        if (status === 'downloaded') {
            try {
                await (window as any).electron.invoke('quit-and-install');
            } catch (e) {
                console.error("Failed to quit and install", e);
            }
            return;
        }

        setStatus('checking');
        try {
            await (window as any).electron.invoke('check-for-updates');
        } catch (e) {
            console.error(e);
            setStatus('error');
            setTimeout(() => setStatus('idle'), 3000);
        }
    };

    if (status === 'idle') {
        // Show subtle icon or hidden? User asked for visible updater.
        // Let's show visible ghost icon that can be clicked.
        return (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-neutral-400 hover:text-white"
                            onClick={checkForUpdates}
                        >
                            <CircleArrowUp className="h-5 w-5" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Check for Updates</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    }

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                            "h-8 w-8",
                            status === 'error' ? "text-red-500" :
                                status === 'downloaded' ? "text-green-500" :
                                    "text-neutral-400 hover:text-white"
                        )}
                        onClick={checkForUpdates}
                        disabled={status === 'checking' || status === 'downloading'}
                    >
                        {status === 'checking' || status === 'downloading' ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : status === 'up-to-date' ? (
                            <Check className="h-4 w-4 text-green-500" />
                        ) : (
                            <CircleArrowUp className={cn("h-5 w-5", status === 'available' && "animate-bounce text-blue-400")} />
                        )}
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    {status === 'checking' && <p>Checking...</p>}
                    {status === 'available' && <p>Update Available</p>}
                    {status === 'downloading' && <p>Downloading {Math.round(progress)}%</p>}
                    {status === 'downloaded' && <p>Ready to Restart (Check Dialog)</p>}
                    {status === 'up-to-date' && <p>Up to Date</p>}
                    {status === 'error' && <p>Error Checking</p>}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
