import { useTranslation } from "react-i18next";

export function TimeTableFocusStats({
    liveSession,
    totalFocusTime,
    peakActivityHour,
    totalAppUsageTime,
    isAppUsageMode
}: any) {
    const { t } = useTranslation();

    if (isAppUsageMode) {
        return (
            <div className="mt-2 mb-2 px-2 shrink-0">
                <div className="bg-card/30 rounded-xl p-3 border border-border/40 flex flex-col items-start text-left">
                    <div className="flex flex-col items-start w-full gap-0">
                        {liveSession ? (
                            <div className="text-[10px] text-green-500 uppercase tracking-wider font-bold mb-1 opacity-90 truncate max-w-[200px] flex items-center gap-1.5 pl-0.5">
                                <span className="relative flex h-1.5 w-1.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"></span>
                                </span>
                                {liveSession.process}
                            </div>
                        ) : (
                            <div className="h-[19px] mb-1 w-full" aria-hidden="true" />
                        )}
                        <div className="flex items-center justify-between w-full">
                            <div>
                                <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-1 opacity-70">{t('calendar.totalWork')}</div>
                                <div className="text-2xl font-bold font-mono tracking-tight text-foreground flex items-baseline justify-start gap-1 shadow-sm">
                                    {Math.floor(totalAppUsageTime / 3600)}<span className="text-xs font-sans font-medium text-muted-foreground">h</span>
                                    {Math.floor((totalAppUsageTime % 3600) / 60)}<span className="text-xs font-sans font-medium text-muted-foreground">m</span>
                                    {totalAppUsageTime % 60}<span className="text-xs font-sans font-medium text-muted-foreground">s</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="mt-2 mb-2 px-2 shrink-0">
            <div className="bg-card/30 rounded-xl p-3 border border-border/40 flex flex-col items-start text-left min-h-24 justify-center">
                <div className="flex flex-col items-start w-full">
                    {liveSession ? (
                        <div className="text-[10px] text-green-500 uppercase tracking-wider font-bold mb-1 opacity-90 truncate max-w-[200px] flex items-center gap-1.5 pl-0.5">
                            <span className="relative flex h-1.5 w-1.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"></span>
                            </span>
                            {liveSession.process}
                        </div>
                    ) : (
                        <div className="h-[19px] mb-1 w-full" aria-hidden="true" />
                    )}

                    <div className="flex items-center gap-8 w-full">
                        <div>
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-1 opacity-70">{t('calendar.totalFocus')}</div>
                            <div className="text-2xl font-bold font-mono tracking-tight text-foreground flex items-baseline justify-start gap-1 shadow-sm">
                                {Math.floor(totalFocusTime / 3600)}<span className="text-xs font-sans font-medium text-muted-foreground">h</span>
                                {Math.floor((totalFocusTime % 3600) / 60)}<span className="text-xs font-sans font-medium text-muted-foreground">m</span>
                                {totalFocusTime % 60}<span className="text-xs font-sans font-medium text-muted-foreground">s</span>
                            </div>
                        </div>

                        {peakActivityHour !== null && (
                            <div>
                                <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-1 opacity-70">{t('calendar.peakFocus')}</div>
                                <div className="text-2xl font-bold font-mono tracking-tight text-foreground flex items-baseline justify-start gap-1 shadow-sm">
                                    {peakActivityHour}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}