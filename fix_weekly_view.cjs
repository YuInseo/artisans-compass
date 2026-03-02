const fs = require('fs');
const path = require('path');

const weeklyViewPath = path.join(__dirname, 'src/components/dashboard/WeeklyView.tsx');
let weeklyViewContent = fs.readFileSync(weeklyViewPath, 'utf8');

// The original content has getMergedSessionsForDay defined inside WeeklyView component, and then a duplicate from the previous script
weeklyViewContent = weeklyViewContent.replace(/const getMergedSessionsForDay = \(day: Date\) => \{[\s\S]*?return finalBlocks;\n    };\n\n        const \{ getMergedSessionsForDay \} = useWeeklyMergedSessions\(\{ weekSessions, settings, liveSession \}\);/g, "const { getMergedSessionsForDay } = useWeeklyMergedSessions({ weekSessions, settings, liveSession });");

// Now we replace the grid JSX
const gridRegex = /<div className="flex-1 overflow-hidden relative bg-background\/50">[\s\S]*?<\/div>\n                <\/div>\n\n                \{isEditorOpen && popoverPosition && createPortal\(/;

const gridReplacement = `<WeeklyGrid
                    days={days} viewMode={viewMode} now={now} settings={settings}
                    showRoutineOverlay={showRoutineOverlay} routineSessions={routineSessions}
                    showAppUsage={showAppUsage} getMergedSessionsForDay={getMergedSessionsForDay}
                    effectivePlanned={effectivePlanned} dragState={dragState} setDragState={setDragState}
                    selectionRef={selectionRef} selectionBox={selectionBox} setSelectionBox={setSelectionBox}
                    dragRef={dragRef} selectedSessionIds={selectedSessionIds} setSelectedSessionIds={setSelectedSessionIds}
                    isEditorOpen={isEditorOpen} setIsEditorOpen={setIsEditorOpen}
                    selectedPlan={selectedPlan} setSelectedPlan={setSelectedPlan} setPopoverPosition={setPopoverPosition}
                    handleSavePlan={handleSavePlan} handleDeletePlan={handleDeletePlan}
                    startDrag={startDrag} onMouseMove={onMouseMove} onMouseUp={onMouseUp}
                />

                {isEditorOpen && popoverPosition && createPortal(`;

if (weeklyViewContent.match(gridRegex)) {
    weeklyViewContent = weeklyViewContent.replace(gridRegex, gridReplacement);
} else {
    console.log("Failed to match grid regex");
}

fs.writeFileSync(weeklyViewPath, weeklyViewContent);

// Fix unused imports in WeeklyGrid.tsx
const weeklyGridPath = path.join(__dirname, 'src/components/dashboard/weekly/WeeklyGrid.tsx');
let weeklyGridContent = fs.readFileSync(weeklyGridPath, 'utf8');
weeklyGridContent = weeklyGridContent.replace("import { isSameDay, addMinutes, format } from 'date-fns';", "import { isSameDay } from 'date-fns';");
fs.writeFileSync(weeklyGridPath, weeklyGridContent);

console.log("Successfully fixed files.");
