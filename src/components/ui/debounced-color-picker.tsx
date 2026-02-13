import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"

interface DebouncedColorPickerProps {
    color: string;
    onChange: (color: string) => void;
    className?: string;
}

export function DebouncedColorPicker({ color, onChange, className }: DebouncedColorPickerProps) {
    const [localColor, setLocalColor] = useState(color);

    useEffect(() => {
        setLocalColor(color);
    }, [color]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (localColor !== color) {
                onChange(localColor);
            }
        }, 200); // 200ms debounce
        return () => clearTimeout(timer);
    }, [localColor, color, onChange]);

    return (
        <div className={cn("relative w-6 h-6 rounded-full overflow-hidden border border-border/50 shrink-0 group/picker cursor-pointer", className)}>
            <div
                className="absolute inset-0 rounded-full border-2 border-transparent ring-2 ring-offset-1 transition-transform group-hover/picker:scale-110 pointer-events-none"
                style={{ backgroundColor: localColor }}
            />
            <input
                type="color"
                value={localColor}
                onChange={(e) => setLocalColor(e.target.value)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                title="Change Color"
            />
        </div>
    );
}
