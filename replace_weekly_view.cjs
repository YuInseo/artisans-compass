const fs = require('fs');
const path = require('path');

const weeklyViewPath = path.join(__dirname, 'src/components/dashboard/WeeklyView.tsx');
let weeklyViewContent = fs.readFileSync(weeklyViewPath, 'utf8');

// 1. Add imports
const useWeeklyMergedImport = "import { useWeeklyMergedSessions } from './hooks/useWeeklyMergedSessions';\nimport { WeeklyGrid } from './weekly/WeeklyGrid';\n";
weeklyViewContent = weeklyViewContent.replace("import { WeeklyDayHeaders } from \"./weekly/WeeklyDayHeaders\";", useWeeklyMergedImport + "import { WeeklyDayHeaders } from \"./weekly/WeeklyDayHeaders\";");

// 2. Add hook invocation
const hookInvocation = `    const { getMergedSessionsForDay } = useWeeklyMergedSessions({ weekSessions, settings, liveSession });\n\n    const portalTarget`;
weeklyViewContent = weeklyViewContent.replace("const portalTarget", hookInvocation);

// 3. Remove getMergedSessionsForDay implementation
weeklyViewContent = weeklyViewContent.replace(/const getMergedSessionsForDay = \(day: Date\) => \{[\s\S]*?return finalBlocks;\n    };\n\n    const portalTarget/g, "const portalTarget");

// 4. Replace the grid JSX starting from `<div className="flex-1 overflow-hidden relative bg-background/50">` to the end of the `days.map` block.
const jsxToReplaceRegex = /<div className="flex-1 overflow-hidden relative bg-background\/50">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*\{isEditorOpen && popoverPosition/g;

const weeklyGridReplacement = `<WeeklyGrid
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
                
                {isEditorOpen && popoverPosition`;

weeklyViewContent = weeklyViewContent.replace(jsxToReplaceRegex, weeklyGridReplacement);

// 5. Also need to expose onMouseMove, onMouseUp if not done.
// In `useWeeklyDragAndDrop` invocation, we should grab `onMouseMove, onMouseUp`
weeklyViewContent = weeklyViewContent.replace(/startDrag\n    } = useWeeklyDragAndDrop/g, "startDrag,\n        onMouseMove, onMouseUp\n    } = useWeeklyDragAndDrop");

fs.writeFileSync(weeklyViewPath, weeklyViewContent);

console.log("Successfully updated WeeklyView.tsx");
