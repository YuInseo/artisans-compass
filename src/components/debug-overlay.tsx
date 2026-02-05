import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useDebugStore } from '@/hooks/useDebugStore';
import { cn } from '@/lib/utils';
import { Trash2, ChevronDown, ChevronUp, Activity, ArrowDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useDataStore } from '@/hooks/useDataStore';

export function DebugOverlay() {
    const { settings, saveSettings } = useDataStore();
    const logs = useDebugStore((state) => state.logs);
    const filter = useDebugStore((state) => state.filter);
    const setFilter = useDebugStore((state) => state.setFilter);
    const clearLogs = useDebugStore((state) => state.clearLogs);
    const [isExpanded, setIsExpanded] = useState(true);
    const [position, setPosition] = useState({ x: 20, y: 20 });
    const [isDragging, setIsDragging] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const dragStartRef = useRef({ x: 0, y: 0 }); // Mouse position at start
    const dragOffsetRef = useRef({ x: 0, y: 0 }); // Current delta
    const scrollBottomRef = useRef<HTMLDivElement>(null);
    // Debug: Track instances
    const instanceId = useRef(Math.floor(Math.random() * 1000));

    // Freeze logs during drag to prevent re-renders causing layout thrashing
    const [frozenLogs, setFrozenLogs] = useState<any[]>([]);

    useEffect(() => {
        if (!isDragging) {
            const currentFiltered = logs.filter(l => filter === 'all' || l.source === filter);
            setFrozenLogs(currentFiltered);
        }
    }, [logs, filter, isDragging]);

    const displayLogs = isDragging ? frozenLogs : logs.filter(l => filter === 'all' || l.source === filter);

    useEffect(() => {
        console.log(`[DebugOverlay] Mounted ${instanceId.current}`);
        return () => console.log(`[DebugOverlay] Unmounted ${instanceId.current}`);
    }, []);

    const scrollToBottom = () => {
        scrollBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const headerRef = useRef<HTMLDivElement>(null);

    // Native Drag Logic - Global Capture Phase to guarantee interaction
    useEffect(() => {
        const handlePointerDownCapture = (e: PointerEvent) => {
            // Check if click started inside the header
            if (headerRef.current && headerRef.current.contains(e.target as Node)) {
                if (e.button !== 0) return; // Left click only

                e.preventDefault();
                e.stopPropagation(); // Stop anything else (like Radix's PointerDownOutside) from seeing this

                dragStartRef.current = {
                    x: e.clientX,
                    y: e.clientY
                };
                setIsDragging(true);
            }
        };

        // Use capture: true to intercept before Bubbling (and before Radix sees it)
        window.addEventListener('pointerdown', handlePointerDownCapture, { capture: true });

        return () => {
            window.removeEventListener('pointerdown', handlePointerDownCapture, { capture: true });
        };
    }, []);

    useEffect(() => {
        let animationFrameId: number;

        const handlePointerMove = (e: PointerEvent) => {
            if (isDragging && containerRef.current) {
                const deltaX = e.clientX - dragStartRef.current.x;
                const deltaY = e.clientY - dragStartRef.current.y;
                dragOffsetRef.current = { x: deltaX, y: deltaY };

                // Throttle visual updates to screen refresh rate
                if (!animationFrameId) {
                    animationFrameId = requestAnimationFrame(() => {
                        if (containerRef.current) {
                            containerRef.current.style.transform = `translate3d(${dragOffsetRef.current.x}px, ${dragOffsetRef.current.y}px, 0)`;
                        }
                        animationFrameId = 0;
                    });
                }
            }
        };

        const handlePointerUp = () => {
            if (isDragging && containerRef.current) {
                setIsDragging(false);
                if (animationFrameId) {
                    cancelAnimationFrame(animationFrameId);
                    animationFrameId = 0;
                }

                // Commit the final position
                const finalX = position.x + dragOffsetRef.current.x;
                const finalY = position.y + dragOffsetRef.current.y;

                setPosition({ x: finalX, y: finalY });

                dragOffsetRef.current = { x: 0, y: 0 };
            }
        };

        if (isDragging) {
            window.addEventListener('pointermove', handlePointerMove);
            window.addEventListener('pointerup', handlePointerUp, { capture: true });
        }

        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp, { capture: true });
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
        };
    }, [isDragging, position]); // Depend on position so we verify correct base


    if (!settings?.developerMode || !settings?.debuggerMode) return null;

    return createPortal(
        <div
            ref={containerRef}
            style={{
                left: position.x,
                top: position.y,
                transform: isDragging ? undefined : 'translate3d(0,0,0)',
                zIndex: 2147483647, // Max Z-Index to stay above Radix/Modals
                // Add will-change to hint browser to promote to layer
                willChange: 'transform'
            }}
            className={cn(
                "fixed font-mono pointer-events-auto", // Force pointer events
                // Only animate expansion properties, NEVER position (left/top)
                // This prevents the "jump" on release when switching from transform back to left/top
                isDragging ? "transition-none shadow-none" : "transition-[width,height,box-shadow,border-radius] duration-300 ease-out shadow-2xl",
                isExpanded ? "w-[400px] h-[50vh]" : "w-auto h-auto"
            )}>
            <div className={cn(
                "flex flex-col h-full bg-black/80 border-r border-b border-white/10 overflow-hidden",
                // Disable expensive blur during drag
                isDragging ? "" : "backdrop-blur-md shadow-2xl",
                isExpanded ? "rounded-br-xl" : "rounded-br-lg"
            )}>
                {/* Header */}
                <div
                    ref={headerRef}
                    className={cn(
                        "flex items-center justify-between px-3 py-2 bg-white/5 border-b border-white/5 handle cursor-move select-none",
                        isDragging ? "" : "backdrop-blur-md"
                    )}
                >
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                        <Activity className="w-3 h-3" />
                        <span>DEV LOGS #{instanceId.current}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="flex bg-white/5 rounded p-0.5 mr-2">
                            {(['all', 'frontend', 'backend'] as const).map((f) => (
                                <button
                                    key={f}
                                    onClick={() => setFilter(f)}
                                    className={cn(
                                        "px-2 py-0.5 text-[10px] rounded uppercase transition-colors",
                                        filter === f ? "bg-emerald-500/20 text-emerald-400" : "text-white/30 hover:text-white/50"
                                    )}
                                >
                                    {f === 'frontend' ? 'Front' : f === 'backend' ? 'Back' : 'All'}
                                </button>
                            ))}
                        </div>
                        <Button variant="ghost" size="icon" className="h-5 w-5 hover:bg-white/10 text-white/50" onClick={scrollToBottom} title="Scroll to Bottom">
                            <ArrowDown className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-5 w-5 hover:bg-white/10 text-white/50" onClick={clearLogs} title="Clear Logs">
                            <Trash2 className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-5 w-5 hover:bg-white/10 text-white/50" onClick={() => setIsExpanded(!isExpanded)}>
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-5 w-5 hover:bg-white/10 hover:text-red-400 text-white/50 ml-1" onClick={() => {
                            if (settings) {
                                saveSettings({ ...settings, debuggerMode: false });
                            }
                        }} title="Close Overlay (Disable Debugger Mode)">
                            <X className="w-3 h-3" />
                        </Button>
                    </div>
                </div>

                {/* Content */}
                {isExpanded && (
                    <ScrollArea className="flex-1 p-0">
                        <div className="p-2 space-y-1">
                            {logs.length === 0 && (
                                <div className="text-xs text-white/30 italic text-center py-4">No logs captured yet...</div>
                            )}
                            {displayLogs.map((log) => (
                                <div key={log.id} className="text-[10px] border-b border-white/5 last:border-0 pb-1 mb-1 font-mono group">
                                    <div className="flex items-start gap-2">
                                        <span className="text-white/30 shrink-0 select-none">
                                            {new Date(log.timestamp).toLocaleTimeString().split(' ')[0]}
                                        </span>
                                        <div className="flex-1 break-words">
                                            <span className={cn(
                                                "font-bold uppercase mr-1",
                                                log.level === 'info' && "text-blue-400",
                                                log.level === 'warn' && "text-yellow-400",
                                                log.level === 'error' && "text-red-400",
                                                log.level === 'debug' && "text-gray-400",
                                            )}>
                                                [{log.level}]
                                            </span>
                                            <span className={cn(
                                                "uppercase text-[9px] mr-1 px-1 rounded",
                                                log.source === 'backend' ? "bg-purple-500/20 text-purple-300" : "bg-blue-500/10 text-blue-300/50"
                                            )}>
                                                {log.source === 'backend' ? 'BACK' : 'FRONT'}
                                            </span>
                                            <span className="text-white/80 break-all">{log.message}</span>
                                        </div>
                                    </div>
                                    {log.data && (
                                        <div className="pl-14 text-white/50 overflow-x-auto mt-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                                            <pre className="whitespace-pre-wrap break-all">
                                                {log.data.map((d: any) => (
                                                    typeof d === 'object' ? JSON.stringify(d, null, 2) : String(d)
                                                )).join(' ')}
                                            </pre>
                                        </div>
                                    )}
                                </div>
                            ))}
                            <div ref={scrollBottomRef} />
                        </div>
                    </ScrollArea>
                )}
            </div>
        </div>,
        document.body
    );
}
