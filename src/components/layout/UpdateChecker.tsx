import { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Download, RefreshCw, Loader2, PartyPopper } from "lucide-react";
import { toast } from "sonner";

export function UpdateChecker() {
    const [status, setStatus] = useState<'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error'>('idle');
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        const ipc = (window as any).ipcRenderer;
        if (!ipc || !ipc.onUpdateState) return;

        const cleanup = ipc.onUpdateState((state: any) => {
            console.log('Update State:', state);
            setStatus(state.status);
            if (state.status === 'downloading' && state.progress) {
                setProgress(state.progress.percent);
            }
            if (state.status === 'available') {
                toast("Update Available", {
                    description: "A new version is available. Click to download.",
                    action: {
                        label: "Download",
                        onClick: () => ipc.send('download-update')
                    }
                });
            }
            if (state.status === 'ready') {
                toast("Update Ready", {
                    description: "Restart to apply the update.",
                    action: {
                        label: "Restart",
                        onClick: () => ipc.send('quit-and-install')
                    }
                });
            }
            if (state.status === 'idle' && state.message === 'up-to-date') {
                toast("Up to Date", {
                    description: "You are using the latest version."
                });
            }
            if (state.status === 'error') {
                console.error("Update Error:", state.error);
                toast.error("Update Failed", {
                    description: state.error || "Failed to check for updates."
                });
            }
        });

        return cleanup;
    }, []);

    const handleCheck = () => {
        setStatus('checking');
        const ipc = (window as any).ipcRenderer;
        if (ipc) ipc.send('check-for-updates');
    };

    const handleDownload = () => {
        const ipc = (window as any).ipcRenderer;
        if (ipc) ipc.send('download-update');
    };

    const handleRestart = () => {
        const ipc = (window as any).ipcRenderer;
        if (ipc) ipc.send('quit-and-install');
    };

    if (status === 'idle' || status === 'error') {
        return (
            <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground no-drag"
                onClick={handleCheck}
                title="Check for Updates"
                style={{ WebkitAppRegion: 'no-drag' } as any}
            >
                <RefreshCw className="w-3.5 h-3.5" />
            </Button>
        );
    }

    if (status === 'checking') {
        return (
            <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground no-drag cursor-default"
                disabled
                style={{ WebkitAppRegion: 'no-drag' } as any}
            >
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
            </Button>
        );
    }

    if (status === 'available') {
        return (
            <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs font-medium text-blue-500 hover:text-blue-600 hover:bg-blue-500/10 no-drag gap-1.5"
                onClick={handleDownload}
                title="Download Update"
                style={{ WebkitAppRegion: 'no-drag' } as any}
            >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Update</span>
            </Button>
        );
    }

    if (status === 'downloading') {
        return (
            <div className="flex items-center gap-2 px-2 h-7 bg-muted/50 rounded-md no-drag" title={`Downloading: ${Math.round(progress)}%`}>
                <Loader2 className="w-3 h-3 animate-spin text-primary" />
                <div className="w-16 h-1.5 bg-muted-foreground/20 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-primary transition-all duration-300"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>
        );
    }

    if (status === 'ready') {
        return (
            <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs font-bold text-green-600 hover:text-green-700 hover:bg-green-500/10 no-drag gap-1.5 animate-pulse"
                onClick={handleRestart}
                title="Restart to Update"
                style={{ WebkitAppRegion: 'no-drag' } as any}
            >
                <PartyPopper className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Restart</span>
            </Button>
        );
    }

    return null;
}
