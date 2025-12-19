import { useState, useRef, useEffect } from "react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Play, Pause, ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScreenshotSliderProps {
    images: string[];
    initialIndex?: number;
    className?: string;
    durationSeconds?: number; // Target total duration for full playback
}

export function ScreenshotSlider({ images, initialIndex = 0, className, durationSeconds = 5 }: ScreenshotSliderProps) {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLooping, setIsLooping] = useState(false); // New State

    // Normalize paths to ensure they work with media:// protocol
    // On Windows, paths like C:\foo need to become media://C:/foo
    const getSrc = (path: string | undefined | null) => {
        if (!path) return "";
        let safePath = path.replace(/\\/g, '/');

        if (!safePath.startsWith('media://') && !safePath.startsWith('http')) {
            safePath = `media://${safePath}`;
        }
        return safePath;
    };

    const currentSrc = images.length > 0 ? getSrc(images[currentIndex]) : null;

    const INTERVAL_MS = durationSeconds * 1000 / Math.max(1, images.length);
    const safeInterval = Math.max(30, INTERVAL_MS); // Cap at ~30fps max speed to prevent freeze
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (isPlaying) {
            timerRef.current = setInterval(() => {
                setCurrentIndex((prev) => {
                    if (prev >= images.length - 1) {
                        if (isLooping) return 0; // Loop back to start
                        setIsPlaying(false);
                        return prev;
                    }
                    return prev + 1;
                });
            }, safeInterval);
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isPlaying, images.length, safeInterval, isLooping]); // Add isLooping dep

    const [isZoomed, setIsZoomed] = useState(false);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (isZoomed && e.key === 'Escape') setIsZoomed(false);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isZoomed]);

    const handleValueChange = (vals: number[]) => {
        setCurrentIndex(vals[0]);
    };

    const togglePlay = () => {
        if (isPlaying) {
            setIsPlaying(false);
        } else {
            if (currentIndex >= images.length - 1) setCurrentIndex(0); // restart
            setIsPlaying(true);
        }
    };

    if (!images || images.length === 0) {
        return <div className="flex items-center justify-center h-64 bg-muted/20 text-muted-foreground rounded-lg">No screenshots available</div>;
    }

    return (
        <div className={cn("flex flex-col gap-4", className)}>
            {/* Image Viewer */}
            <div className="relative aspect-video w-full bg-black/5 rounded-lg overflow-hidden border border-border flex items-center justify-center group/slider">
                {currentSrc ? (
                    <img
                        src={currentSrc}
                        alt={`Screenshot ${currentIndex + 1}`}
                        className="max-w-full max-h-full object-contain shadow-sm"
                    />
                ) : (
                    <span className="text-muted-foreground">Image not found</span>
                )}

                {/* Overlay Counter */}
                <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full backdrop-blur-sm pointer-events-none">
                    {currentIndex + 1} / {images.length}
                </div>

                {/* Looping Status Indicator (Optional Visual Feedback on Image) */}
                {isLooping && (
                    <div className="absolute top-2 left-2 bg-black/50 text-white p-1 rounded-full backdrop-blur-sm pointer-events-none animate-in fade-in">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m17 2 4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" /><path d="m7 22-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" /></svg>
                    </div>
                )}

                {/* Zoom Button - Inside Slider */}
                <button
                    onClick={() => setIsZoomed(true)}
                    className="absolute bottom-3 right-3 bg-black/50 hover:bg-black/70 text-white p-2 rounded-lg opacity-0 group-hover/slider:opacity-100 transition-opacity backdrop-blur-sm border border-white/10"
                    title="Maximize"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-maximize-2"><polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" x2="14" y1="3" y2="10" /><line x1="3" x2="10" y1="21" y2="14" /></svg>
                </button>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => handleValueChange([Math.max(0, currentIndex - 1)])} disabled={currentIndex === 0}>
                    <ArrowLeft className="w-4 h-4" />
                </Button>

                <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={togglePlay}
                    title={isPlaying ? "Pause" : "Play Timelapse"}
                >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                </Button>

                {/* Loop Toggle Button */}
                <Button
                    variant="ghost"
                    size="icon"
                    className={cn("h-8 w-8 shrink-0 transition-all", isLooping ? "bg-primary/20 text-primary hover:bg-primary/30" : "text-muted-foreground hover:text-foreground")}
                    onClick={() => setIsLooping(!isLooping)}
                    title="Toggle Loop"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m17 2 4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" /><path d="m7 22-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" /></svg>
                </Button>

                <Button variant="ghost" size="icon" onClick={() => handleValueChange([Math.min(images.length - 1, currentIndex + 1)])} disabled={currentIndex === images.length - 1}>
                    <ArrowRight className="w-4 h-4" />
                </Button>

                <div className="flex-1 flex flex-col justify-center">
                    <Slider
                        value={[currentIndex]}
                        min={0}
                        max={images.length - 1}
                        step={1}
                        onValueChange={handleValueChange}
                        className="cursor-pointer"
                    />
                </div>
            </div>

            {/* Full Screen Overlay */}
            {isZoomed && (
                <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col animate-in fade-in duration-200">
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 text-white bg-black/40">
                        <span className="font-mono text-sm opacity-70">
                            {currentIndex + 1} / {images.length}
                        </span>
                        <button
                            onClick={() => setIsZoomed(false)}
                            className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-full transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                        </button>
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 flex items-center justify-center p-8 overflow-hidden relative group/fullscreen">
                        {/* Navigation Overlay Buttons */}
                        <button
                            className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 p-4 rounded-full text-white opacity-0 group-hover/fullscreen:opacity-100 transition-opacity hover:bg-black/80 disabled:opacity-0"
                            onClick={() => handleValueChange([Math.max(0, currentIndex - 1)])}
                            disabled={currentIndex === 0}
                        >
                            <ArrowLeft className="w-8 h-8" />
                        </button>

                        <button
                            className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 p-4 rounded-full text-white opacity-0 group-hover/fullscreen:opacity-100 transition-opacity hover:bg-black/80 disabled:opacity-0"
                            onClick={() => handleValueChange([Math.min(images.length - 1, currentIndex + 1)])}
                            disabled={currentIndex === images.length - 1}
                        >
                            <ArrowRight className="w-8 h-8" />
                        </button>

                        <img
                            src={currentSrc || ''}
                            alt="Full Screen"
                            className="max-w-full max-h-full object-contain drop-shadow-2xl"
                        />
                    </div>

                    {/* Footer Controls */}
                    <div className="px-10 py-6 bg-black/40 flex items-center gap-6 justify-center">
                        <Button
                            variant="outline"
                            size="lg"
                            className="h-12 w-12 shrink-0 rounded-full border-white/20 bg-white/5 text-white hover:bg-white/20 hover:text-white"
                            onClick={togglePlay}
                        >
                            {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
                        </Button>
                        <div className="w-[60%] max-w-2xl">
                            <Slider
                                value={[currentIndex]}
                                min={0}
                                max={images.length - 1}
                                step={1}
                                onValueChange={handleValueChange}
                                className="cursor-pointer"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
