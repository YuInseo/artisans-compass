export function SmoothAreaChart({ data, color, maxY, valueFormatter }: { data: { label: string, value: number, tooltip?: string }[], color: string, maxY?: number, valueFormatter?: (v: number) => string }) {
    if (!data || data.length === 0) return null;

    const getCurvePath = (points: { x: number, y: number }[]) => {
        if (points.length === 0) return '';
        let d = `M ${points[0].x},${points[0].y}`;
        for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i];
            const p2 = points[i + 1];
            const cx = (p1.x + p2.x) / 2;
            d += ` C ${cx},${p1.y} ${cx},${p2.y} ${p2.x},${p2.y}`;
        }
        return d;
    };

    const parsedMax = Math.max(...data.map(d => d.value));
    const maxVal = maxY ?? Math.max(parsedMax, 5);
    const minVal = 0;
    const range = maxVal - minVal;

    const w = 1000;
    const h = 240;

    const points = data.map((d, i) => {
        const x = (i / (data.length - 1)) * w;
        const y = range === 0 ? h : h - ((d.value - minVal) / range) * h;
        return { x, y };
    });

    const curvePath = getCurvePath(points);
    const fillPath = `${curvePath} L ${w},${h} L 0,${h} Z`;
    const gradientId = `grad-${color.replace('#', '')}`;

    return (
        <div className="relative w-full h-full flex flex-col justify-end">
            {/* Y-axis labels / grid lines */}
            <div className="absolute inset-x-0 top-0 bottom-8 flex flex-col justify-between pointer-events-none text-[10px] text-muted-foreground/30 font-medium z-0">
                {[1, 0.8, 0.6, 0.4, 0.2, 0].map((perc, i) => (
                    <div key={i} className="w-full border-t border-dashed border-border/10 flex items-center relative h-0">
                        <span className="absolute -top-[7px] bg-background pr-2 text-[9px] -left-2 text-right w-8">{valueFormatter ? valueFormatter(maxVal * perc) : Math.round(maxVal * perc)}</span>
                    </div>
                ))}
            </div>

            <div className="flex-1 w-full relative z-10 p-1 pb-8 pl-8">
                <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" preserveAspectRatio="none" className="overflow-visible">
                    <defs>
                        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={color} stopOpacity={0.6} />
                            <stop offset="100%" stopColor={color} stopOpacity={0.0} />
                        </linearGradient>
                    </defs>
                    <path d={fillPath} fill={`url(#${gradientId})`} />
                    <path d={curvePath} fill="none" stroke={color} strokeWidth="4" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
                    {points.map((p, i) => (
                        <circle key={i} cx={p.x} cy={p.y} r={4} fill={color} stroke="currentColor" strokeWidth={2} vectorEffect="non-scaling-stroke" className="text-card" />
                    ))}
                </svg>

                {/* Overlay tooltips */}
                <div className="absolute inset-x-8 inset-y-0 pb-8 flex justify-between">
                    {data.map((d, i) => (
                        <div key={i} className="flex-1 h-full relative group cursor-pointer">
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-popover text-popover-foreground text-[10px] py-1 px-2 rounded whitespace-nowrap pointer-events-none z-20 shadow-md">
                                {d.tooltip || `${d.value}`}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* X-axis labels */}
            <div className="absolute bottom-0 left-8 right-0 flex justify-between text-[10px] text-muted-foreground/50 font-medium px-1 z-10">
                {data.map((d, i) => (
                    <div key={i} className="flex-1 text-center -ml-3">{d.label}</div>
                ))}
            </div>
        </div>
    );
}

export function SimpleBarChart({ data, color, maxY, valueFormatter }: { data: { label: string, value: number, tooltip?: string }[], color: string, maxY?: number, valueFormatter?: (v: number) => string }) {
    if (!data || data.length === 0) return null;
    const parsedMax = Math.max(...data.map(d => d.value));
    const maxVal = maxY ?? Math.max(parsedMax, 5);

    return (
        <div className="relative w-full h-full flex flex-col justify-end">
            {/* Y-axis */}
            <div className="absolute inset-x-0 top-0 bottom-8 flex flex-col justify-between pointer-events-none text-[10px] text-muted-foreground/30 font-medium z-0">
                {[1, 0.8, 0.6, 0.4, 0.2, 0].map((perc, i) => (
                    <div key={i} className="w-full border-t border-dashed border-border/10 flex items-center relative h-0">
                        <span className="absolute -top-[7px] bg-background pr-2 text-[9px] -left-2 text-right w-8">{valueFormatter ? valueFormatter(maxVal * perc) : Math.round(maxVal * perc)}</span>
                    </div>
                ))}
            </div>

            <div className="flex-1 w-full relative z-10 flex items-end justify-between px-2 pb-8 pl-8 gap-4 sm:gap-6 md:gap-8">
                {data.map((d, i) => {
                    const heightPercent = Math.max(2, (d.value / maxVal) * 100);
                    return (
                        <div key={i} className="flex-1 h-full flex flex-col justify-end items-center relative group">
                            <div
                                className="w-full max-w-[12px] md:max-w-[16px] rounded-t-sm transition-all duration-300 cursor-pointer hover:brightness-110"
                                style={{ height: `${heightPercent}%`, backgroundColor: color }}
                            >
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-popover text-popover-foreground text-[10px] py-1 px-2 rounded whitespace-nowrap pointer-events-none z-20 shadow-md">
                                    {d.tooltip || d.value}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* X-axis labels */}
            <div className="absolute bottom-0 left-8 right-0 flex justify-between text-[10px] text-muted-foreground/50 font-medium px-2 z-10">
                {data.map((d, i) => (
                    <div key={i} className="flex-1 text-center -ml-2">{d.label}</div>
                ))}
            </div>
        </div>
    );
}
