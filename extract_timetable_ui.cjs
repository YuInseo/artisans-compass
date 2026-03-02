const fs = require('fs');
const path = require('path');

const code = fs.readFileSync('src/components/dashboard/TimeTableGraph.tsx', 'utf8');

function extractUseMemo(startSubstring) {
    const startIdx = code.indexOf(startSubstring);
    if (startIdx === -1) throw new Error("Could not find " + startSubstring);

    const useMemoIdx = code.indexOf('useMemo(', startIdx);
    let i = useMemoIdx + 'useMemo('.length;
    let bCount = 1;
    for (; i < code.length; i++) {
        if (code[i] === '(') bCount++;
        else if (code[i] === ')') bCount--;

        if (bCount === 0) {
            break;
        }
    }
    return code.substring(startIdx, i + 1) + ';';
}

const eventsWithRelativeTimeMemo = extractUseMemo('const { eventsWithRelativeTime, TOTAL_MINUTES = 1440 }');
const sessionBlocksMemo = extractUseMemo('const sessionBlocks = useMemo(');
const totalFocusTimeMemo = extractUseMemo('const { totalFocusTime, peakActivityHour }');
const statsAppsMemo = extractUseMemo('const { sortedApps, totalAppUsageTime }');

// Write hooks
const hooksDir = 'src/components/dashboard/hooks';
if (!fs.existsSync(hooksDir)) fs.mkdirSync(hooksDir, { recursive: true });

let hookData = `import { useMemo } from 'react';
import { differenceInMinutes, differenceInSeconds, format } from 'date-fns';
import { Session, Project, PlannedSession, AppSettings } from '@/types';
import { useTranslation } from 'react-i18next';

export function useTimeTableData(
    sessions: Session[],
    date: Date | undefined,
    liveSession: Session | null | undefined,
    allSessions: Session[] | undefined,
    projects: Project[],
    now: Date,
    renderMode: 'fixed' | 'dynamic',
    plannedSessions: PlannedSession[],
    nightTimeStart: number,
    settings: AppSettings | null | undefined
) {
    const { t } = useTranslation();

    const isValidDate = (d: any) => {
        return d instanceof Date && !isNaN(d.getTime());
    };

    const TOTAL_HOURS = 24;

${eventsWithRelativeTimeMemo}

    interface RenderEvent {
        id: string;
        title: string;
        startDate: Date;
        endDate: Date;
        startMins: number;
        endMins: number;
        durationMins: number;
        colIndex?: number;
        appDistribution: Record<string, number>;
        type?: string;
        startHour: number;
        color?: string;
        isIgnored?: boolean;
        forceSide?: 'left' | 'right';
    }

${sessionBlocksMemo}

    return { sessionBlocks, TOTAL_MINUTES, TOTAL_HOURS };
}
`;
fs.writeFileSync(path.join(hooksDir, 'useTimeTableData.ts'), hookData);

let hookStats = `import { useMemo } from 'react';
import { differenceInSeconds, getHours } from 'date-fns';
import { Session, AppSettings } from '@/types';
import { useTranslation } from 'react-i18next';

export function useTimeTableStats(
    sessions: Session[],
    liveSession: Session | null | undefined,
    allSessions: Session[] | undefined,
    allLiveSession: Session | null | undefined,
    now: Date,
    settings: AppSettings | null | undefined
) {
    const { t } = useTranslation();

${totalFocusTimeMemo}

${statsAppsMemo}

    return { totalFocusTime, peakActivityHour, sortedApps, totalAppUsageTime };
}
`;
fs.writeFileSync(path.join(hooksDir, 'useTimeTableStats.ts'), hookStats);

// Function to extract text enclosed in JSX elements or just substrings
function extractBetween(prefix, suffix) {
    const start = code.indexOf(prefix);
    if (start === -1) throw new Error("Could not find prefix " + prefix);
    const end = code.indexOf(suffix, start);
    if (end === -1) throw new Error("Could not find suffix " + suffix);
    return code.substring(start, end + suffix.length);
}

// 1. TimeTableFooter (Timeline Tab)
const timelineFooterStr = extractBetween('    const TimelineFooter = (', '    );');
// 2. AppUsageFooter (App Usage Tab)
const appUsageFooterStr = extractBetween('    const AppUsageFooter = (', '    );');

// 3. TimeTableGrid JSX
const timetableGridJsx = extractBetween('{/* GRAPH CONTENT */}', '                    </div>');

// 4. TimeTableAppUsageList JSX
const timetableAppUsageJsx = extractBetween('{/* App Usage List - Scrollable Area */}', '                        </div>');

// 5. TimeTableSettingsModal JSX
const settingsModalJsx = extractBetween('<Dialog open={isIgnoredAppsModalOpen}', '</Dialog>');

const uiDir = 'src/components/dashboard/timetable';
if (!fs.existsSync(uiDir)) fs.mkdirSync(uiDir, { recursive: true });

// TimeTableGrid
const gridCode = `import React, { Fragment } from 'react';
import { format, differenceInMinutes, isSameDay, getDay } from 'date-fns';
import { Session, AppSettings, PlannedSession } from '@/types';
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ContextMenu, ContextMenuContent, ContextMenuTrigger, ContextMenuSeparator, ContextMenuItem, ContextMenuCheckboxItem } from "@/components/ui/context-menu";
import { Settings2, Briefcase } from "lucide-react";

export function TimeTableGrid({
    sessionBlocks,
    TOTAL_MINUTES,
    TOTAL_HOURS,
    date,
    now,
    firstOpenedAt,
    nightTimeStart,
    appSessions,
    plannedSessions,
    settings,
    renderMode,
    onUpdateSettings,
    toggleWorkFilter,
    openModal
}: any) {
    const { t } = useTranslation();

    return (
        <Fragment>
${timetableGridJsx}
        </Fragment>
    );
}`;
fs.writeFileSync(path.join(uiDir, 'TimeTableGrid.tsx'), gridCode);

// TimeTableAppUsage
const appUsageCode = `import React from 'react';
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export function TimeTableAppUsage({
    sortedApps,
    settings
}: any) {
    const { t } = useTranslation();

    return (
        <Fragment>
${timetableAppUsageJsx}
        </Fragment>
    );
}`;
fs.writeFileSync(path.join(uiDir, 'TimeTableAppUsage.tsx'), appUsageCode);

// TimeTableSettingsModal
const settingsModalCode = `import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export function TimeTableSettingsModal({
    isIgnoredAppsModalOpen,
    setIsIgnoredAppsModalOpen,
    modalMode,
    appsToConfigure,
    settings,
    toggleAppIgnored,
    toggleWorkApp
}: any) {
    const { t } = useTranslation();

    return (
${settingsModalJsx}
    );
}`;
fs.writeFileSync(path.join(uiDir, 'TimeTableSettingsModal.tsx'), settingsModalCode);

// Focus Stats Footer (extracted from inside graph)
const statsFooterCode = `import React from 'react';
import { useTranslation } from "react-i18next";

export function TimeTableFocusStats({
    liveSession,
    totalFocusTime,
    peakActivityHour,
    totalAppUsageTime,
    isAppUsageMode
}: any) {
    const { t } = useTranslation();

    if(isAppUsageMode) {
        return (
${appUsageFooterStr.replace('const AppUsageFooter = (', '').replace(/;\s*$/, '')}
        );
    }

    return (
${timelineFooterStr.replace('const TimelineFooter = (', '').replace(/;\s*$/, '')}
    );
}`;
fs.writeFileSync(path.join(uiDir, 'TimeTableFocusStats.tsx'), statsFooterCode);

console.log('UI Components extracted.');
