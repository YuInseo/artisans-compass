import { Minus, Square, X } from "lucide-react";

export function WindowControls() {
    return (
        <div className="flex items-center h-full no-drag" style={{ WebkitAppRegion: 'no-drag' } as any}>
            <button
                onClick={() => (window as any).ipcRenderer?.send('minimize-window')}
                className="h-full w-12 flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors pb-1"
            >
                <Minus className="w-4 h-4" />
            </button>
            <button
                onClick={() => (window as any).ipcRenderer?.send('toggle-maximize-window')}
                className="h-full w-12 flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors pb-1"
            >
                <Square className="w-3.5 h-3.5" />
            </button>
            <button
                onClick={() => (window as any).ipcRenderer?.send('close-window')}
                className="h-full w-12 flex items-center justify-center text-muted-foreground hover:bg-destructive hover:text-destructive-foreground transition-colors pb-1"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    );
}
