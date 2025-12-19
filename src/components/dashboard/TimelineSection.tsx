import { useDataStore } from "@/hooks/useDataStore";
import { useTimelineStore } from "@/hooks/useTimelineStore";
import { format, addDays, differenceInDays, parseISO, startOfDay, startOfYear, endOfYear, isBefore, addYears } from "date-fns";
import { Trash, Settings } from "lucide-react";
import { useRef, useState, useEffect, useLayoutEffect, useMemo } from "react";
import { ProjectSettingsModal } from "./ProjectSettingsModal";
import { Project } from "@/types";
import * as ContextMenu from '@radix-ui/react-context-menu';
import { cn } from "@/lib/utils";

const PX_PER_DAY = 40;
const BAR_HEIGHT = 40;
const BAR_GAP = 10;
const ROW_HEIGHT = BAR_HEIGHT + BAR_GAP;

interface TimelineSectionProps {
    searchQuery?: string;
    focusedProject?: Project | null;
    navigationSignal?: { date: Date, timestamp: number } | null;
}

export function TimelineSection({ searchQuery: _searchQuery = "", focusedProject, navigationSignal }: TimelineSectionProps) {
    const { projects, saveProjects } = useDataStore();
    const {
        selectedIds,
        selectionBox,
        isDeleting,
        setSelectedIds,
        clearSelection,
        setSelectionBox,
        deleteSelected,
    } = useTimelineStore();


    // --- Drag Logic State Moved Up ---
    const [dragState, setDragState] = useState<{
        id: string;
        action: 'move' | 'resize-left' | 'resize-right';
        startX: number;
        currentX: number; // For live feedback
        initialStart: Date;
        initialEnd: Date;
    } | null>(null);

    const [editingProject, setEditingProject] = useState<Project | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [hasScrolled, setHasScrolled] = useState(false);

    // Generate Date Headers for Full Year + Next Year
    const { today, timelineStart, timelineEnd } = useMemo(() => {
        const t = startOfDay(new Date());
        return {
            today: t,
            timelineStart: startOfYear(t),
            timelineEnd: endOfYear(addYears(t, 1))
        };
    }, []); // Empty dep array: calculate once on mount (or maybe dependency on nothing). 
    // Actually, if the user leaves the app open for days, this might be stale. 
    // But for a session, it's fine. 
    // If strictness needed, verify date every minute? Overkill for now.

    // Create array of all days in the full range
    const totalDays = differenceInDays(timelineEnd, timelineStart) + 1;
    const dates = useMemo(() => Array.from({ length: totalDays }).map((_, i) => addDays(timelineStart, i)), [timelineStart, totalDays]);

    // Directional Highlight State
    const [directionHighlight, setDirectionHighlight] = useState<'left' | 'right' | null>(null);

    // Initial scroll and check
    useLayoutEffect(() => {
        if (containerRef.current && !hasScrolled && !focusedProject) {
            const todayIndex = differenceInDays(today, timelineStart);
            const scrollPosition = (todayIndex * PX_PER_DAY) - (containerRef.current.clientWidth / 2) + (PX_PER_DAY / 2);
            containerRef.current.scrollLeft = Math.max(0, scrollPosition);
            setHasScrolled(true);
        }
    }, [hasScrolled, today, timelineStart, focusedProject]);


    // Auto-Scroll to Focused Project
    useEffect(() => {
        if (focusedProject && containerRef.current) {
            const start = parseISO(focusedProject.startDate);
            const index = differenceInDays(start, timelineStart);
            const scrollPosition = (index * PX_PER_DAY) - (containerRef.current.clientWidth / 2) + (getWidthStyle(focusedProject.startDate, focusedProject.endDate) / 2);

            containerRef.current.scrollTo({
                left: Math.max(0, scrollPosition),
                behavior: 'smooth'
            });
        }
    }, [focusedProject, timelineStart]);

    const scrollToDate = (date: Date) => {
        if (containerRef.current) {
            const index = differenceInDays(date, timelineStart);
            const scrollPosition = (index * PX_PER_DAY) - (containerRef.current.clientWidth / 2) + (PX_PER_DAY / 2);
            containerRef.current.scrollTo({
                left: Math.max(0, scrollPosition),
                behavior: 'smooth'
            });
        }
    };

    // Explicit Navigation Signal Handler
    useEffect(() => {
        if (navigationSignal) {
            scrollToDate(navigationSignal.date);
        }
    }, [navigationSignal, timelineStart]);

    const scrollToToday = () => scrollToDate(today);


    const handleScroll = () => {
        if (!containerRef.current) return;

        const container = containerRef.current;
        const scrollLeft = container.scrollLeft;
        const clientWidth = container.clientWidth;

        const todayIndex = differenceInDays(today, timelineStart);
        const todayLeft = todayIndex * PX_PER_DAY;
        const todayRight = todayLeft + PX_PER_DAY;

        // Check availability
        if (todayRight < scrollLeft) {
            setDirectionHighlight('left');
        } else if (todayLeft > scrollLeft + clientWidth) {
            setDirectionHighlight('right');
        } else {
            setDirectionHighlight(null);
        }
    };

    // Wheel to Horizontal Scroll
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const handleWheel = (e: WheelEvent) => {
            if (e.deltaY !== 0) {
                e.preventDefault();
                container.scrollLeft += e.deltaY;
            }
        };
        container.addEventListener('wheel', handleWheel, { passive: false });
        // Initial Scroll Check
        handleScroll();

        return () => container.removeEventListener('wheel', handleWheel);
    }, []);


    // --- Smart Stacking Logic (Tetris) ---
    const calculateStackedLayout = (projectList: Project[]) => {
        // Sort by start date first, then by ID for stability
        const sorted = [...projectList].sort((a, b) => {
            const timeDiff = parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime();
            return timeDiff !== 0 ? timeDiff : a.id.localeCompare(b.id);
        });

        const rows: Date[] = []; // End date of the last project in each row
        const result = sorted.map(p => {
            const start = parseISO(p.startDate);
            const end = parseISO(p.endDate);

            // Find the first row where this project fits
            let rowIndex = -1;
            for (let i = 0; i < rows.length; i++) {
                // If the row's last project ends before this project starts, it fits.
                if (isBefore(rows[i], start)) {
                    rowIndex = i;
                    break;
                }
            }

            if (rowIndex === -1) {
                // Create new row
                rowIndex = rows.length;
                rows.push(end);
            } else {
                // Update existing row
                rows[rowIndex] = end;
            }

            return { ...p, rowIndex };
        });

        return { projects: result, totalRows: rows.length };
    };

    const stackedProjects = useMemo(() => calculateStackedLayout(projects), [projects]);

    // Calculate Preview Layout for Ghost Bars
    const previewLayoutMap = useMemo(() => {
        if (!dragState || dragState.action !== 'move') return null;

        const deltaX = dragState.currentX - dragState.startX;
        const deltaDays = Math.round(deltaX / PX_PER_DAY);

        if (deltaDays === 0) return null;

        // Create simulated projects list
        const simulatedProjects = projects.map(p => {
            if (selectedIds.has(p.id)) {
                const newStart = addDays(parseISO(p.startDate), deltaDays);
                const newEnd = addDays(parseISO(p.endDate), deltaDays);
                return {
                    ...p,
                    startDate: format(newStart, 'yyyy-MM-dd'),
                    endDate: format(newEnd, 'yyyy-MM-dd')
                };
            }
            return p;
        });

        const layout = calculateStackedLayout(simulatedProjects);
        const map = new Map<string, number>();
        layout.projects.forEach(p => map.set(p.id, p.rowIndex));
        return map;
    }, [projects, selectedIds, dragState?.currentX, dragState?.startX, dragState?.action]);


    const getLeftStyle = (dateStr: string) => {
        const date = parseISO(dateStr);
        const diff = differenceInDays(date, timelineStart);
        return diff * PX_PER_DAY;
    };

    const getWidthStyle = (startStr: string, endStr: string) => {
        const start = parseISO(startStr);
        const end = parseISO(endStr);
        const diff = differenceInDays(end, start);
        return Math.max(diff, 1) * PX_PER_DAY;
    };

    const handleProjectUpdate = async (updatedProject: Project) => {
        const updated = projects.map(p => p.id === updatedProject.id ? updatedProject : p);
        await saveProjects(updated);
    };

    const handleProjectDelete = async (id: string) => {
        let updated: Project[];
        if (selectedIds.has(id)) {
            // Delete all selected
            updated = projects.filter(p => !selectedIds.has(p.id));
            setSelectedIds(new Set());
        } else {
            // Delete just this one
            updated = projects.filter(p => p.id !== id);
        }
        await saveProjects(updated);
    };

    // Separate handler for multi-delete to ensure clean execution after menu closes
    const handleDeleteSelected = () => {
        // Use store action - it handles isDeleting state internally
        // Pass selectedIds explicitly to fix race condition where selection might clear before delete runs
        deleteSelected(projects, saveProjects, selectedIds);
    };

    // --- Selection Logic Handlers ---
    const handleContainerMouseDown = (e: React.MouseEvent) => {
        // Only handle left click for selection box
        if (e.button !== 0) return;

        // If clicking on background (projects stop propagation), start selection
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        setSelectionBox({ startX: x, startY: y, currentX: x, currentY: y });

        // Clear selection if not holding Ctrl
        if (!e.ctrlKey) {
            clearSelection();
        }
    };

    const handleContainerMouseMove = (e: React.MouseEvent) => {
        // Update Selection Box
        if (selectionBox && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            // Direct update instead of functional updater
            setSelectionBox({ ...selectionBox, currentX: x, currentY: y });

            // Calculate Intersection (Live Selection)
            const boxLeft = Math.min(selectionBox.startX, x);
            const boxRight = Math.max(selectionBox.startX, x);
            const boxTop = Math.min(selectionBox.startY, y);
            const boxBottom = Math.max(selectionBox.startY, y);

            const scrollLeft = containerRef.current.scrollLeft;

            const newSelected = new Set(e.ctrlKey ? selectedIds : []);

            stackedProjects.projects.forEach(p => {
                const pLeft = getLeftStyle(p.startDate) - scrollLeft;
                const pWidth = getWidthStyle(p.startDate, p.endDate);
                const pRight = pLeft + pWidth;

                // The project `top` style is `project.rowIndex * ROW_HEIGHT`.
                // That `top` is relative to `Canvas Body` which is `flex-1 relative pt-4`.
                // So actual Y from container top = 32 (header) + 16 (pt-4) + (rowIndex * ROW_HEIGHT).
                const pRealTop = 32 + 16 + (p.rowIndex * ROW_HEIGHT);
                const pRealBottom = pRealTop + BAR_HEIGHT;

                // Box Collision
                if (boxRight > pLeft && boxLeft < pRight && boxBottom > pRealTop && boxTop < pRealBottom) {
                    newSelected.add(p.id);
                }
            });
            setSelectedIds(newSelected);
        }
    };

    const handleContainerMouseUp = () => {
        setSelectionBox(null);
    };

    // --- Drag Logic ---
    const handleMouseDown = (e: React.MouseEvent, proj: Project, action: 'move' | 'resize-left' | 'resize-right') => {
        if (e.button !== 0) return; // Only Left Click
        e.stopPropagation();

        if (e.ctrlKey) {
            // Toggle Selection logic
            const newSet = new Set(selectedIds);
            if (newSet.has(proj.id)) newSet.delete(proj.id);
            else newSet.add(proj.id);
            setSelectedIds(newSet);
            return;
        }

        if (!selectedIds.has(proj.id)) {
            setSelectedIds(new Set([proj.id]));
        }

        setDragState({
            id: proj.id,
            action,
            startX: e.clientX,
            currentX: e.clientX,
            initialStart: parseISO(proj.startDate),
            initialEnd: parseISO(proj.endDate)
        });
    };

    // Use Refs to access fresh state inside Event Listeners without re-binding
    const stateRef = useRef({ projects, selectedIds, dragState });
    useEffect(() => {
        stateRef.current = { projects, selectedIds, dragState };
    }, [projects, selectedIds, dragState]);

    useEffect(() => {
        if (!dragState) return; // Only attach when dragging

        const handleMouseMove = (e: MouseEvent) => {
            // Only update currentX
            setDragState(prev => prev ? { ...prev, currentX: e.clientX } : null);
        };

        const handleMouseUp = async (e: MouseEvent) => {
            const { projects, selectedIds, dragState } = stateRef.current;
            if (!dragState) return;

            const deltaX = e.clientX - dragState.startX;
            const deltaDays = Math.round(deltaX / PX_PER_DAY);

            if (dragState.action === 'move') {
                if (deltaDays !== 0) {
                    const updates: Project[] = [];
                    for (const id of selectedIds) {
                        const p = projects.find(proj => proj.id === id);
                        if (p) {
                            const pStart = parseISO(p.startDate);
                            const pEnd = parseISO(p.endDate);
                            const newStart = addDays(pStart, deltaDays);
                            const newEnd = addDays(pEnd, deltaDays);

                            updates.push({
                                ...p,
                                startDate: format(newStart, 'yyyy-MM-dd'),
                                endDate: format(newEnd, 'yyyy-MM-dd')
                            });
                        }
                    }
                    const projectMap = new Map(updates.map(u => [u.id, u]));
                    const finalProjects = projects.map(p => projectMap.get(p.id) || p);
                    saveProjects(finalProjects);
                }
            } else {
                // Resize
                const project = projects.find(p => p.id === dragState.id);
                if (project) {
                    let newStart = dragState.initialStart;
                    let newEnd = dragState.initialEnd;
                    if (dragState.action === 'resize-left') {
                        newStart = addDays(dragState.initialStart, deltaDays);
                        if (isBefore(newEnd, newStart)) newStart = addDays(newEnd, -1);
                    } else if (dragState.action === 'resize-right') {
                        newEnd = addDays(dragState.initialEnd, deltaDays);
                        if (isBefore(newEnd, newStart)) newEnd = addDays(newStart, 1);
                    }
                    const updated = { ...project, startDate: format(newStart, 'yyyy-MM-dd'), endDate: format(newEnd, 'yyyy-MM-dd') };
                    const finalProjects = projects.map(p => p.id === updated.id ? updated : p);
                    saveProjects(finalProjects);
                }
            }

            setDragState(null);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [dragState !== null]); // Only re-run if drag starts/stops. NOT on every mousemove.

    // ...

    // Render loop update
    // ... inside map ...
    // const isSelected = selectedIds.has(project.id);
    // Add border/ring to className

    // ...

    // Add Selection Box Render
    // {selectionBox && ...}

    return (
        <div className="h-full w-full flex flex-col relative overflow-hidden bg-background select-none text-sm font-sans">
            {/* Directional Highlights */}
            {directionHighlight === 'left' && (
                <div
                    className="absolute left-0 top-0 bottom-0 w-[50px] bg-gradient-to-r from-red-500/35 to-transparent z-40 cursor-pointer hover:from-red-500/50 transition-all group"
                    onClick={scrollToToday}
                />
            )}
            {directionHighlight === 'right' && (
                <div
                    className="absolute right-0 top-0 bottom-0 w-[50px] bg-gradient-to-l from-red-500/35 to-transparent z-40 cursor-pointer hover:from-red-500/50 transition-all group"
                    onClick={scrollToToday}
                />
            )}

            {selectionBox && containerRef.current && (
                <div
                    className="absolute bg-blue-500/20 border border-blue-500 z-50 pointer-events-none"
                    style={{
                        left: Math.min(selectionBox.startX, selectionBox.currentX),
                        top: Math.min(selectionBox.startY, selectionBox.currentY),
                        width: Math.abs(selectionBox.currentX - selectionBox.startX),
                        height: Math.abs(selectionBox.currentY - selectionBox.startY)
                    }}
                />
            )}

            <div
                className="flex-1 relative overflow-x-auto overflow-y-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                ref={containerRef}
                onScroll={handleScroll}
                onMouseDown={handleContainerMouseDown}
                onMouseMove={handleContainerMouseMove}
                onMouseUp={handleContainerMouseUp}
                onMouseLeave={handleContainerMouseUp}
            >
                <div className="min-w-max h-full relative" style={{ width: dates.length * PX_PER_DAY, minHeight: '100%' }}>

                    {/* Header Row (Sticky) */}
                    <div className="sticky top-0 z-20 flex border-b border-border bg-card shadow-sm pointer-events-none">
                        {dates.map((date, i) => {
                            const isFirstDay = date.getDate() === 1;
                            const isToday = differenceInDays(date, today) === 0;
                            return (
                                <div key={i} className={`flex-shrink-0 h-8 flex items-end pb-1 border-r border-border/50 ${isFirstDay ? 'border-l border-border bg-accent/50' : ''}`} style={{ width: PX_PER_DAY }}>
                                    <span className={`w-full text-center text-xs ${isFirstDay ? 'font-bold text-foreground' : 'text-muted-foreground'} ${isToday ? 'text-blue-600 font-bold' : ''}`}>
                                        {isFirstDay ? format(date, 'MMM') : date.getDate()}
                                    </span>
                                </div>
                            )
                        })}
                    </div>

                    {/* Canvas Body */}
                    <div className="relative flex-1 min-h-[500px] pt-4">
                        {/* Background Grid */}
                        <div className="absolute inset-0 flex pointer-events-none h-full pt-8">
                            {dates.map((date, i) => {
                                const isToday = differenceInDays(date, today) === 0;
                                return (
                                    <div key={i} className={`flex-shrink-0 border-r border-border/30 h-full ${isToday ? 'bg-blue-500/5' : ''}`} style={{ width: PX_PER_DAY }} />
                                );
                            })}
                        </div>

                        {/* Today Line Indicator */}
                        <div className="absolute top-0 bottom-0 pointer-events-none z-10 border-l-2 border-red-500/70 opacity-50 border-dashed"
                            style={{ left: getLeftStyle(format(today, 'yyyy-MM-dd')) + (PX_PER_DAY / 2) }} />



                        {/* Project Bars (Stacked) */}
                        {stackedProjects.projects.map((project) => {
                            const left = getLeftStyle(project.startDate);
                            const width = getWidthStyle(project.startDate, project.endDate);
                            const top = project.rowIndex * ROW_HEIGHT;
                            const isSelected = selectedIds.has(project.id);

                            // Calculate Drag Translation
                            let transform = 'none';
                            let zIndex = isSelected ? 30 : 1; // Boost z-index for dragged items

                            // Snap Calculation
                            let showGhost = false;
                            let ghostTransform = 'none';

                            if (dragState && dragState.action === 'move' && isSelected) {
                                // Real Item moves continuously
                                const pixelOffset = dragState.currentX - dragState.startX;
                                transform = `translateX(${pixelOffset}px)`;
                                zIndex = 50;

                                // Ghost Item snaps to grid
                                const snapDays = Math.round(pixelOffset / PX_PER_DAY);
                                const snapPixelOffset = snapDays * PX_PER_DAY;
                                ghostTransform = `translateX(${snapPixelOffset}px)`;
                                showGhost = true;
                            } else if (dragState && dragState.id === project.id) {
                                // Resizing logic...
                            }

                            // Determine Ghost Top Position (Smart Stacking)
                            const ghostRowIndex = previewLayoutMap?.get(project.id);
                            const ghostTop = (ghostRowIndex !== undefined ? ghostRowIndex : project.rowIndex) * ROW_HEIGHT;

                            return (
                                <div key={project.id}>
                                    {/* Ghost Bar (Snap Preview) */}
                                    {showGhost && (
                                        <div
                                            className="absolute h-9 border-2 border-dashed border-red-500/50 rounded-md bg-transparent z-20 pointer-events-none"
                                            style={{
                                                left: `${left}px`,
                                                width: `${width}px`,
                                                top: `${ghostTop}px`, // Use calculated ghost top
                                                transform: ghostTransform
                                            }}
                                        />
                                    )}

                                    {/* Actual Project Bar */}
                                    <ContextMenu.Root modal={false}>
                                        <ContextMenu.Trigger disabled={isDeleting} asChild>
                                            <div
                                                className={cn(
                                                    "absolute h-9 bg-card border border-border rounded-md shadow-sm hover:shadow-md transition-shadow duration-200 group overflow-visible cursor-pointer",
                                                    isSelected && "ring-2 ring-blue-500 border-blue-500",
                                                    dragState?.action === 'move' && isSelected ? 'shadow-xl opacity-90' : '',
                                                    project.locked && "opacity-90 bg-muted/50 border-dashed cursor-default" // Locked style
                                                )}
                                                style={{
                                                    left: `${left}px`,
                                                    width: `${width}px`,
                                                    top: `${top}px`, // Keep original row while dragging
                                                    transform: transform,
                                                    zIndex: zIndex
                                                }}
                                                onContextMenu={(e) => {
                                                    if (isDeleting) {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        return;
                                                    }
                                                    // If right-clicking an unselected project, add it to selection
                                                    // If already selected, keep current selection
                                                    if (!selectedIds.has(project.id)) {
                                                        const newSet = new Set(selectedIds);
                                                        newSet.add(project.id);
                                                        setSelectedIds(newSet);
                                                    }
                                                }}
                                                onMouseDown={(e) => {
                                                    if (project.locked) return; // Prevent drag if locked
                                                    handleMouseDown(e, project, 'move')
                                                }}
                                                onDoubleClick={() => setEditingProject(project)}
                                            >
                                                <div className={`w-full h-full opacity-20 rounded-md ${project.type === 'Main' ? 'bg-blue-500' : project.type === 'Sub' ? 'bg-green-500' : 'bg-yellow-500'}`}></div>

                                                {/* Bar Content */}
                                                <div className="absolute inset-0 flex items-center px-2 gap-1">
                                                    {/* Lock Icon */}
                                                    {project.locked && (
                                                        <div className="bg-background/80 p-0.5 rounded-full shadow-sm">
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-lock text-muted-foreground"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                                                        </div>
                                                    )}
                                                    <span className="font-semibold text-xs text-foreground truncate w-full select-none">
                                                        {project.name}
                                                    </span>
                                                </div>

                                                {/* Resize Handles - Hide if locked */}
                                                {!project.locked && (
                                                    <>
                                                        <div className="absolute left-0 top-0 bottom-0 w-3 cursor-w-resize hover:bg-foreground/5 rounded-l-md" onMouseDown={(e) => handleMouseDown(e, project, 'resize-left')} />
                                                        <div className="absolute right-0 top-0 bottom-0 w-3 cursor-e-resize hover:bg-foreground/5 rounded-r-md" onMouseDown={(e) => handleMouseDown(e, project, 'resize-right')} />
                                                    </>
                                                )}
                                            </div>
                                        </ContextMenu.Trigger>

                                        <ContextMenu.Portal>
                                            <ContextMenu.Content className="min-w-[200px] bg-popover text-popover-foreground rounded-lg shadow-xl border border-border p-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                                                {/* Multi-select mode: show only delete option */}
                                                {isSelected && selectedIds.size > 1 ? (
                                                    <ContextMenu.Item
                                                        className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-destructive/10 focus:bg-destructive/10 text-destructive"
                                                        onSelect={handleDeleteSelected}
                                                    >
                                                        <Trash className="mr-2 h-4 w-4" />
                                                        Delete Selected ({selectedIds.size})
                                                    </ContextMenu.Item>
                                                ) : (
                                                    /* Single project mode: show full menu */
                                                    <>
                                                        <ContextMenu.Label className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                                                            {project.name}
                                                        </ContextMenu.Label>
                                                        <ContextMenu.Item
                                                            className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent focus:bg-accent text-foreground"
                                                            onSelect={() => setEditingProject(project)}
                                                        >
                                                            <Settings className="mr-2 h-4 w-4" />
                                                            Edit Settings
                                                        </ContextMenu.Item>
                                                        <ContextMenu.Separator className="my-1 h-px bg-border" />
                                                        <ContextMenu.Item
                                                            className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-destructive/10 focus:bg-destructive/10 text-destructive"
                                                            onSelect={() => handleProjectDelete(project.id)}
                                                        >
                                                            <Trash className="mr-2 h-4 w-4" />
                                                            Delete Project
                                                        </ContextMenu.Item>
                                                    </>
                                                )}
                                            </ContextMenu.Content>
                                        </ContextMenu.Portal>
                                    </ContextMenu.Root>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>



            {/* Edit Modal */}
            <ProjectSettingsModal
                isOpen={!!editingProject}
                project={editingProject}
                onClose={() => setEditingProject(null)}
                onSave={handleProjectUpdate}
                onDelete={handleProjectDelete}
            />
        </div>
    );
}
