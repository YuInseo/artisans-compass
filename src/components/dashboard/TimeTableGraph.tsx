import { useState, useEffect } from 'react';
import { AppSettings, Session, Project, PlannedSession } from '@/types';
import { useTimeTableData } from './hooks/useTimeTableData';
import { useTimeTableStats } from './hooks/useTimeTableStats';
import { TimeTableGrid } from './timetable/TimeTableGrid';
import { TimeTableSettingsModal } from './timetable/TimeTableSettingsModal';
import { TimeTableFocusStats } from './timetable/TimeTableFocusStats';

interface TimeTableGraphProps {
    sessions: Session[];
    date?: Date;
    activeProjectId?: string;
    liveSession?: Session | null;
    projects?: Project[];
    nightTimeStart?: number;
    settings?: AppSettings | null;
    onUpdateSettings?: (settings: AppSettings) => void;
    renderMode?: 'fixed' | 'dynamic';
    plannedSessions?: PlannedSession[];
    currentTime?: Date;
    firstOpenedAt?: number;
    appSessions?: { start: number; end: number }[];
}

export function TimeTableGraph({
    sessions,
    date,
    liveSession,
    projects = [],
    activeProjectId,
    nightTimeStart = 24,
    settings,
    onUpdateSettings,
    renderMode = 'dynamic',
    plannedSessions = [],
    currentTime,
    firstOpenedAt,
    appSessions
}: TimeTableGraphProps): React.ReactNode {
    const [internalNow, setInternalNow] = useState(new Date());
    const now = currentTime || internalNow;

    const [isIgnoredAppsModalOpen, setIsIgnoredAppsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'ignored' | 'work'>('ignored');
    const [appsToConfigure, setAppsToConfigure] = useState<{ name: string; duration: number }[]>([]);

    useEffect(() => {
        if (!liveSession && currentTime) return;
        if (!currentTime && liveSession) {
            const interval = setInterval(() => {
                setInternalNow(new Date());
            }, 1000);
            setInternalNow(new Date());
            return () => clearInterval(interval);
        }
    }, [liveSession, currentTime]);

    const { sessionBlocks, TOTAL_MINUTES, TOTAL_HOURS } = useTimeTableData(
        sessions, date, liveSession, projects, now, renderMode, plannedSessions, nightTimeStart, settings, activeProjectId
    );

    const { totalFocusTime, peakActivityHour } = useTimeTableStats(
        sessions, liveSession, now
    );

    const toggleAppIgnored = (appName: string, currentIgnored: boolean) => {
        if (!settings || !onUpdateSettings) return;
        const newIgnoredApps = currentIgnored
            ? settings.ignoredApps?.filter(app => app !== appName) || []
            : [...(settings.ignoredApps || []), appName];
        onUpdateSettings({ ...settings, ignoredApps: newIgnoredApps });
    };

    const toggleWorkApp = (appName: string, isCurrentlyWork: boolean) => {
        if (!settings || !onUpdateSettings) return;
        const newWorkApps = isCurrentlyWork
            ? settings.workApps?.filter(app => app !== appName) || []
            : [...(settings.workApps || []), appName];
        onUpdateSettings({ ...settings, workApps: newWorkApps });
    };

    const toggleWorkFilter = (checked: boolean) => {
        if (!settings || !onUpdateSettings) return;
        onUpdateSettings({ ...settings, filterTimelineByWorkApps: checked });
    };

    const openModal = (mode: 'ignored' | 'work', block?: any) => {
        if (block) {
            const apps = Object.entries(block.appDistribution || {})
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .map(([name, duration]) => ({ name, duration: duration as number }));

            if (apps.length === 0) {
                setAppsToConfigure([{ name: block.title, duration: block.durationMins * 60 }]);
            } else {
                setAppsToConfigure(apps);
            }
        } else {
            setAppsToConfigure([]);
        }
        setModalMode(mode);
        setIsIgnoredAppsModalOpen(true);
    };

    return (
        <div className="w-full h-full flex flex-col pointer-events-auto select-none">
            <div className="flex-1 min-h-[200px] relative outline-none flex flex-col bg-transparent">
                <div className="flex-1 mx-2 bg-card/30 rounded-xl border border-border/40 relative select-none flex flex-col mb-2">
                    <TimeTableGrid
                        sessionBlocks={sessionBlocks}
                        TOTAL_MINUTES={TOTAL_MINUTES}
                        TOTAL_HOURS={TOTAL_HOURS}
                        date={date}
                        now={now}
                        firstOpenedAt={firstOpenedAt}
                        nightTimeStart={nightTimeStart}
                        appSessions={appSessions}
                        plannedSessions={plannedSessions}
                        settings={settings}
                        renderMode={renderMode}
                        onUpdateSettings={onUpdateSettings}
                        toggleWorkFilter={toggleWorkFilter}
                        openModal={openModal}
                    />
                </div>
                <TimeTableFocusStats
                    isAppUsageMode={false}
                    liveSession={liveSession}
                    totalFocusTime={totalFocusTime}
                    peakActivityHour={peakActivityHour}
                />
            </div>

            <TimeTableSettingsModal
                isIgnoredAppsModalOpen={isIgnoredAppsModalOpen}
                setIsIgnoredAppsModalOpen={setIsIgnoredAppsModalOpen}
                modalMode={modalMode}
                appsToConfigure={appsToConfigure}
                settings={settings}
                toggleAppIgnored={toggleAppIgnored}
                toggleWorkApp={toggleWorkApp}
            />
        </div>
    );
}