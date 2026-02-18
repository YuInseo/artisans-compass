import { useDataStore } from "@/hooks/useDataStore";
import { useTranslation } from "react-i18next";
import { useTimelineStore } from "@/hooks/useTimelineStore";
import { format, addDays, differenceInDays, parseISO, startOfDay, startOfYear, endOfYear, isBefore, addYears, subYears } from "date-fns";
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
    onOpenSettings?: (tab: 'timeline') => void;
}

export function TimelineSection({ searchQuery: _searchQuery = "", focusedProject, navigationSignal, onOpenSettings }: TimelineSectionProps) {
    const { t } = useTranslation();
    const { projects, saveProjects, settings, addToHistory } = useDataStore();
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

    const [scrollLeft, setScrollLeft] = useState(0);
    const [containerWidth, setContainerWidth] = useState(0);

    // Generate Date Headers for Full Year + Next Year
    const { today, timelineStart, timelineEnd } = useMemo(() => {
        const t = startOfDay(new Date());
        return {
            today: t,
            // Optimized: Virtualization allows us to have a HUGE range. 50 years is effectively infinite for this use case.
            timelineStart: subYears(startOfYear(t), 50),
            timelineEnd: endOfYear(addYears(t, 50))
        };
    }, []); // Empty dep array: calculate once on mount (or maybe dependency on nothing). 

    // Create array of all days in the full range
    const totalDays = differenceInDays(timelineEnd, timelineStart) + 1;
    // const dates = useMemo(() => Array.from({ length: totalDays }).map((_, i) => addDays(timelineStart, i)), [timelineStart, totalDays]);

    // Directional Highlight State
    const [directionHighlight, setDirectionHighlight] = useState<'left' | 'right' | null>(null);

    // Initial scroll and check
    useLayoutEffect(() => {
        if (containerRef.current) {
            setContainerWidth(containerRef.current.clientWidth);

            // Resize Observer to keep width updated
            const observer = new ResizeObserver(entries => {
                for (const entry of entries) {
                    setContainerWidth(entry.contentRect.width);
                }
            });
            observer.observe(containerRef.current);

            if (!hasScrolled && !focusedProject) {
                const todayIndex = differenceInDays(today, timelineStart);
                const scrollPosition = (todayIndex * PX_PER_DAY) - (containerRef.current.clientWidth / 2) + (PX_PER_DAY / 2);
                containerRef.current.scrollLeft = Math.max(0, scrollPosition);
                setHasScrolled(true);
            }

            return () => observer.disconnect();
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
        setScrollLeft(container.scrollLeft);

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

    // Quantize drag X to avoid excessive recalculation
    const quantizedDragX = useMemo(() => {
        if (!dragState) return 0;
        // Only update when we cross a day threshold (PX_PER_DAY = 40)
        return Math.round(dragState.currentX / PX_PER_DAY) * PX_PER_DAY;
    }, [dragState?.currentX]);

    // Calculate Preview Layout for Ghost Bars
    const previewLayoutMap = useMemo(() => {
        if (!dragState || dragState.action !== 'move') return null;

        // Use original startX and quantized currentX
        // Or simpler: just use deltaDays directly derived from quantized values

        const deltaDays = Math.round((dragState.currentX - dragState.startX) / PX_PER_DAY);

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
    }, [projects, selectedIds, dragState?.action, quantizedDragX]); // Depend on quantizedDragX instead of currentX


    const getLeftStyle = (dateStr: string) => {
        const date = parseISO(dateStr);
        const diff = differenceInDays(date, timelineStart);
        return diff * PX_PER_DAY;
    };

    const getWidthStyle = (startStr: string, endStr: string) => {
        const start = parseISO(startStr);
        const end = parseISO(endStr);
        const diff = differenceInDays(end, start);
        // Inclusive duration: diff + 1 day
        return (diff + 1) * PX_PER_DAY;
    };

    const handleProjectUpdate = async (updatedProject: Project) => {
        addToHistory();
        const updated = projects.map(p => p.id === updatedProject.id ? updatedProject : p);
        await saveProjects(updated);
    };

    const handleProjectDelete = async (id: string) => {
        // Prevent deleting if the specific target is locked (and not part of a larger valid selection logic)
        const targetProject = projects.find(p => p.id === id);
        if (targetProject?.locked && !selectedIds.has(id)) return;

        addToHistory();
        let updated: Project[];
        if (selectedIds.has(id)) {
            // Delete all selected EXCEPT locked
            const lockedInSelection = projects.filter(p => selectedIds.has(p.id) && p.locked);
            const lockedIds = new Set(lockedInSelection.map(p => p.id));

            updated = projects.filter(p => {
                if (selectedIds.has(p.id)) {
                    return p.locked; // Keep it if it's locked
                }
                return true; // Keep non-selected
            });

            // Update selection to only contain the locked items we couldn't delete
            setSelectedIds(lockedIds);
        } else {
            // Delete just this one
            if (targetProject?.locked) return;
            updated = projects.filter(p => p.id !== id);
        }
        await saveProjects(updated);
    };

    // Separate handler for multi-delete to ensure clean execution after menu closes
    const handleDeleteSelected = async () => {
        // Filter out locked projects
        const lockedInSelection = projects.filter(p => selectedIds.has(p.id) && p.locked);
        const lockedIds = new Set(lockedInSelection.map(p => p.id));
        const unlockedIds = new Set([...selectedIds].filter(id => !lockedIds.has(id)));

        if (unlockedIds.size === 0) return;

        addToHistory();
        // Use store action
        await deleteSelected(projects, saveProjects, unlockedIds);

        // Restore selection for locked items if any remained
        if (lockedIds.size > 0) {
            setSelectedIds(lockedIds);
        }
    };

    // Keyboard Delete Listener
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (selectedIds.size === 0) return;

            if (e.key === 'Delete' || e.key === 'Backspace') {
                // Safety: Don't delete if we are typing in an input or editor
                const active = document.activeElement;
                const isInput = active instanceof HTMLInputElement ||
                    active instanceof HTMLTextAreaElement ||
                    (active as HTMLElement).isContentEditable;

                if (isInput) return;

                e.preventDefault(); // Prevent browser back navigation on Backspace
                handleDeleteSelected();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedIds, projects, saveProjects]); // Re-bind when data/selection changes

    // --- Selection Logic Handlers ---
    // Ref to store selection state at drag start for additive logic
    const initialSelectionRef = useRef<Set<string>>(new Set());

    const handleContainerMouseDown = (e: React.MouseEvent) => {

        if (e.button !== 0) return;

        // If clicking on background (projects stop propagation), start selection
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Snapshot current selection for additive drag
        if (e.ctrlKey) {
            initialSelectionRef.current = new Set(selectedIds);
        } else {
            initialSelectionRef.current = new Set();
            clearSelection();
        }
        setSelectionBox({ startX: x, startY: y, currentX: x, currentY: y });
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

            // Additive by default: Start with initial selection, then add what's in box
            // Unless Alt key is held? (Maybe later)
            // Just satisfy "No Ctrl needed to select multiple"
            const newSelected = new Set(initialSelectionRef.current);

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
                    // Prevent selecting locked projects
                    if (!p.locked) {
                        newSelected.add(p.id);
                    }
                }
            });
            setSelectedIds(newSelected);
        }
    };

    const handleContainerMouseUp = (e: React.MouseEvent) => {
        if (selectionBox) {
            const deltaX = Math.abs(selectionBox.currentX - selectionBox.startX);
            const deltaY = Math.abs(selectionBox.currentY - selectionBox.startY);
            // Treat as click if movement is very small
            const isClick = deltaX < 5 && deltaY < 5;

            if (isClick && !e.ctrlKey) {
                clearSelection();
            }
        }
        setSelectionBox(null);
    };

    // --- Drag Logic ---
    const handleMouseDown = (e: React.MouseEvent, proj: Project, action: 'move' | 'resize-left' | 'resize-right') => {
        if (e.button !== 0) return; // Only Left Click
        if (proj.locked) return; // Prevent interaction with locked projects entirely
        e.stopPropagation();

        if (e.ctrlKey) {
            // Toggle Selection logic
            const newSet = new Set(selectedIds);
            if (newSet.has(proj.id)) newSet.delete(proj.id);
            else newSet.add(proj.id); // Locked check already handled above
            setSelectedIds(newSet);
            return;
        }

        if (!selectedIds.has(proj.id)) {
            // Standard selection: Clear others, Select this one
            const newSet = new Set<string>();
            newSet.add(proj.id);
            setSelectedIds(newSet);
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
                    addToHistory(); // Snapshot before saving
                    const updates: Project[] = [];
                    for (const id of selectedIds) {
                        const p = projects.find(proj => proj.id === id);
                        if (p && !p.locked) { // Double check: Ensure locked projects don't move even if selected
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

                    // Clear drag state BEFORE saving to prevent visual jump (double-application of transform)
                    setDragState(null);
                    await saveProjects(finalProjects);
                }
            } else {
                // Resize
                const project = projects.find(p => p.id === dragState.id);
                if (project) {
                    let newStart = dragState.initialStart;
                    let newEnd = dragState.initialEnd;
                    let changed = false;

                    if (dragState.action === 'resize-left') {
                        newStart = addDays(dragState.initialStart, deltaDays);
                        if (isBefore(newEnd, newStart)) newStart = addDays(newEnd, -1);
                        changed = format(newStart, 'yyyy-MM-dd') !== project.startDate;
                    } else if (dragState.action === 'resize-right') {
                        newEnd = addDays(dragState.initialEnd, deltaDays);
                        if (isBefore(newEnd, newStart)) newEnd = addDays(newStart, 1);
                        changed = format(newEnd, 'yyyy-MM-dd') !== project.endDate;
                    }

                    if (changed) {
                        addToHistory(); // Snapshot before saving
                        const updated = { ...project, startDate: format(newStart, 'yyyy-MM-dd'), endDate: format(newEnd, 'yyyy-MM-dd') };
                        const finalProjects = projects.map(p => p.id === updated.id ? updated : p);

                        setDragState(null);
                        await saveProjects(finalProjects);
                    }
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
    }, [!!dragState]); // Only re-run if drag starts/stops

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
                <div className="min-w-max h-full relative" style={{ width: totalDays * PX_PER_DAY, minHeight: '100%' }}>

                    {/* Header Row (Sticky) */}
                    <div className="sticky top-0 z-20 h-8 flex border-b border-border bg-card shadow-sm pointer-events-none overflow-hidden relative" style={{ width: '100%' }}>
                        {(() => {
                            const buffer = 10; // Extra days to render on sides
                            const visibleStartIndex = Math.max(0, Math.floor(scrollLeft / PX_PER_DAY) - buffer);
                            const visibleEndIndex = Math.min(totalDays, Math.ceil((scrollLeft + containerWidth) / PX_PER_DAY) + buffer);

                            const visibleDates = [];
                            for (let i = visibleStartIndex; i < visibleEndIndex; i++) {
                                visibleDates.push({ date: addDays(timelineStart, i), index: i });
                            }

                            return visibleDates.map(({ date, index }) => {
                                const isFirstDay = date.getDate() === 1;
                                const isToday = differenceInDays(date, today) === 0;
                                const left = index * PX_PER_DAY;

                                return (
                                    <div
                                        key={index}
                                        className={`absolute top-0 bottom-0 flex items-end pb-1 border-r border-border/50 ${isFirstDay ? 'border-l border-border bg-accent/50' : ''}`}
                                        style={{ left, width: PX_PER_DAY }}
                                    >
                                        {isFirstDay ? (
                                            <span className="absolute left-1 bottom-1 w-max font-bold text-foreground text-xs select-none z-10 whitespace-nowrap">
                                                {format(date, 'yyyy. M')}
                                            </span>
                                        ) : (
                                            <span className={`w-full text-center text-xs text-muted-foreground ${isToday ? 'text-blue-600 font-bold' : ''}`}>
                                                {date.getDate()}
                                            </span>
                                        )}
                                    </div>
                                );
                            });
                        })()}
                    </div>

                    {/* Canvas Body */}
                    <div
                        className="relative flex-1 pt-4"
                        style={{
                            minHeight: `${((settings?.visibleProjectRows || 10) * ROW_HEIGHT) + 60}px`
                        }}
                    >
                        {/* Background Grid */}
                        <div className="absolute inset-0 pointer-events-none h-full pt-8">
                            {(() => {
                                const buffer = 10;
                                const visibleStartIndex = Math.max(0, Math.floor(scrollLeft / PX_PER_DAY) - buffer);
                                const visibleEndIndex = Math.min(totalDays, Math.ceil((scrollLeft + containerWidth) / PX_PER_DAY) + buffer);

                                const gridLines = [];
                                for (let i = visibleStartIndex; i < visibleEndIndex; i++) {
                                    gridLines.push({ date: addDays(timelineStart, i), index: i });
                                }

                                return gridLines.map(({ date, index }) => {
                                    const isToday = differenceInDays(date, today) === 0;
                                    const left = index * PX_PER_DAY;
                                    return (
                                        <div
                                            key={index}
                                            className={`absolute top-0 bottom-0 border-r border-border/30 ${isToday ? 'bg-blue-500/5' : ''}`}
                                            style={{ left, width: PX_PER_DAY }}
                                        />
                                    );
                                });
                            })()}
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
                            } else if (dragState && dragState.id === project.id && (dragState.action === 'resize-left' || dragState.action === 'resize-right')) {
                                // Resize Preview
                                showGhost = true;
                                zIndex = 50;
                                const pixelOffset = dragState.currentX - dragState.startX;
                                const snapDays = Math.round(pixelOffset / PX_PER_DAY);

                                // Calculate ghost dimensions
                                const originalWidth = getWidthStyle(project.startDate, project.endDate);

                                if (dragState.action === 'resize-left') {
                                    // Ghost Left moves, Width changes
                                    const snapPixelChange = snapDays * PX_PER_DAY;
                                    // Prevent inverting (min width 1 day)
                                    // Width decreases as Left increases
                                    let newWidth = originalWidth - snapPixelChange;
                                    let translate = snapPixelChange;

                                    if (newWidth < PX_PER_DAY) {
                                        translate = originalWidth - PX_PER_DAY;
                                        newWidth = PX_PER_DAY;
                                    }

                                    // Apply transform to position relative to original 'left'
                                    ghostTransform = `translateX(${translate}px)`;
                                    // We need to override dimensions in style below. 
                                    // But ghost style uses 'left' from project loop which is 'originalLeft'.
                                    // So translateX works.

                                    // Actually, we can just modify the style directly if we extract text content? 
                                    // No, easier to just calculate "ghostLeft" and "ghostWidth".
                                } else {
                                    // Resize Right: Left stays, Width changes
                                    const snapPixelChange = snapDays * PX_PER_DAY;
                                    let newWidth = originalWidth + snapPixelChange;
                                    if (newWidth < PX_PER_DAY) newWidth = PX_PER_DAY;

                                    // Ghost starts at original left, just width changes?
                                    // The render below uses `width: ${width}px`.
                                    // We need to pass dynamic width to ghost style.
                                }
                            }

                            // Determine Ghost Top Position (Smart Stacking)
                            const ghostRowIndex = previewLayoutMap?.get(project.id);
                            const ghostTop = (ghostRowIndex !== undefined ? ghostRowIndex : project.rowIndex) * ROW_HEIGHT;

                            return (
                                <div key={project.id}>
                                    {/* Ghost Bar (Snap Preview) */}
                                    {showGhost && settings?.showTimelinePreview && (
                                        <div
                                            className="absolute h-9 border-2 border-dashed border-red-500/80 rounded-md bg-background/50 z-[60] pointer-events-none"
                                            style={{
                                                left: `${left}px`,
                                                width: (() => {
                                                    if (dragState?.id === project.id && (dragState.action === 'resize-left' || dragState.action === 'resize-right')) {
                                                        const pixelOffset = dragState.currentX - dragState.startX;
                                                        const snapDays = Math.round(pixelOffset / PX_PER_DAY);
                                                        const originalWidth = getWidthStyle(project.startDate, project.endDate);

                                                        if (dragState.action === 'resize-left') {
                                                            return Math.max(PX_PER_DAY, originalWidth - (snapDays * PX_PER_DAY)) + 'px';
                                                        } else {
                                                            return Math.max(PX_PER_DAY, originalWidth + (snapDays * PX_PER_DAY)) + 'px';
                                                        }
                                                    }
                                                    return `${width}px`;
                                                })(),
                                                top: `${ghostTop}px`, // Use calculated ghost top
                                                transform: (() => {
                                                    if (dragState?.id === project.id && dragState.action === 'resize-left') {
                                                        const pixelOffset = dragState.currentX - dragState.startX;
                                                        const snapDays = Math.round(pixelOffset / PX_PER_DAY);
                                                        const originalWidth = getWidthStyle(project.startDate, project.endDate);
                                                        // If we hit min width, we stop moving right
                                                        if (originalWidth - (snapDays * PX_PER_DAY) < PX_PER_DAY) {
                                                            return `translateX(${originalWidth - PX_PER_DAY}px)`;
                                                        }
                                                        return `translateX(${snapDays * PX_PER_DAY}px)`;
                                                    }
                                                    return ghostTransform;
                                                })()
                                            }}
                                        />
                                    )}

                                    {/* Actual Project Bar */}
                                    {/* Actual Project Bar */}
                                    {isSelected && selectedIds.size > 1 ? (
                                        <ContextMenu.Root modal={false}>
                                            <ContextMenu.Trigger disabled={isDeleting} asChild>
                                                <div
                                                    className={cn(
                                                        "absolute h-9 bg-card border border-border rounded-md shadow-sm hover:shadow-md transition-shadow duration-200 group overflow-visible cursor-pointer",
                                                        isSelected && "ring-2 ring-blue-500 border-blue-500",
                                                        dragState?.action === 'move' && isSelected ? 'shadow-xl opacity-90' : '',
                                                        project.locked && "opacity-90 bg-muted/50 border-dashed cursor-default"
                                                    )}
                                                    style={{
                                                        left: `${left}px`,
                                                        width: `${width}px`,
                                                        top: `${top}px`,
                                                        transform: transform,
                                                        zIndex: zIndex
                                                    }}
                                                    onContextMenu={(e) => {
                                                        if (isDeleting) {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            return;
                                                        }
                                                        // Already multi-selected, just open menu
                                                    }}
                                                    onMouseDown={(e) => {
                                                        if (project.locked) return;
                                                        handleMouseDown(e, project, 'move')
                                                    }}
                                                    onDoubleClick={() => setEditingProject(project)}
                                                >
                                                    <div
                                                        className="w-full h-full opacity-20 rounded-md"
                                                        style={{
                                                            backgroundColor: (() => {
                                                                if (settings?.enableCustomProjectColors && project.color) return project.color;
                                                                return settings?.typeColors?.[project.type] || "#3b82f6";
                                                            })()
                                                        }}
                                                    ></div>
                                                    <div className="absolute inset-0 flex items-center px-2 gap-1">
                                                        {project.locked && (
                                                            <div className="bg-background/80 p-0.5 rounded-full shadow-sm">
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-lock text-muted-foreground"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                                                            </div>
                                                        )}
                                                        <span className="font-semibold text-xs text-foreground truncate w-full select-none">
                                                            {project.name}
                                                        </span>
                                                    </div>
                                                </div>
                                            </ContextMenu.Trigger>
                                            <ContextMenu.Portal>
                                                <ContextMenu.Content
                                                    className="min-w-[200px] bg-popover text-popover-foreground rounded-lg shadow-xl border border-border p-1 z-50 animate-in fade-in zoom-in-95 duration-100"
                                                    onMouseDown={(e) => e.stopPropagation()}
                                                    onMouseUp={(e) => e.stopPropagation()}
                                                >
                                                    <ContextMenu.Item
                                                        className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-destructive/10 focus:bg-destructive/10 text-destructive"
                                                        onSelect={handleDeleteSelected}
                                                    >
                                                        <Trash className="mr-2 h-4 w-4" />
                                                        {t('dashboard.deleteSelected')} ({selectedIds.size})
                                                    </ContextMenu.Item>
                                                </ContextMenu.Content>
                                            </ContextMenu.Portal>
                                        </ContextMenu.Root>
                                    ) : (
                                        <ContextMenu.Root modal={false}>
                                            <ContextMenu.Trigger disabled={isDeleting} asChild>
                                                <div
                                                    className={cn(
                                                        "absolute h-9 bg-card border border-border rounded-md shadow-sm hover:shadow-md transition-shadow duration-200 group overflow-visible cursor-pointer",
                                                        isSelected && "ring-2 ring-blue-500 border-blue-500",
                                                        dragState?.action === 'move' && isSelected ? 'shadow-xl opacity-90' : '',
                                                        project.locked && "opacity-90 bg-muted/50 border-dashed cursor-default"
                                                    )}
                                                    style={{
                                                        left: `${left}px`,
                                                        width: `${width}px`,
                                                        top: `${top}px`,
                                                        transform: transform,
                                                        zIndex: zIndex
                                                    }}
                                                    onContextMenu={(e) => {
                                                        if (isDeleting) {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            return;
                                                        }
                                                        if (!selectedIds.has(project.id)) {
                                                            const newSet = new Set(selectedIds);
                                                            newSet.add(project.id);
                                                            setSelectedIds(newSet);
                                                        }
                                                    }}
                                                    onMouseDown={(e) => {
                                                        if (project.locked) return;
                                                        handleMouseDown(e, project, 'move')
                                                    }}
                                                    onDoubleClick={() => setEditingProject(project)}
                                                >
                                                    <div
                                                        className="absolute inset-0 w-full h-full opacity-20 rounded-md"
                                                        style={{
                                                            backgroundColor: (() => {
                                                                if (settings?.enableCustomProjectColors && project.color) return project.color;
                                                                return settings?.typeColors?.[project.type] || "#3b82f6";
                                                            })()
                                                        }}
                                                    ></div>
                                                    <div className="sticky left-0 z-10 flex flex-col justify-center px-3 min-w-0 h-full w-fit max-w-full pointer-events-none">
                                                        <div className="flex items-center gap-1.5 w-full">
                                                            {project.locked && (
                                                                <div className="shrink-0 bg-background/80 p-0.5 rounded-full shadow-sm">
                                                                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-lock text-muted-foreground"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                                                                </div>
                                                            )}
                                                            <span className="font-bold text-xs text-foreground truncate select-none leading-none">
                                                                {project.name}
                                                            </span>
                                                        </div>
                                                        {project.type && (
                                                            <span className="text-[10px] text-foreground/70 font-medium truncate select-none leading-none mt-0.5 ml-0.5">
                                                                {project.type}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {!project.locked && (
                                                        <>
                                                            <div className="absolute left-0 top-0 bottom-0 w-3 cursor-w-resize hover:bg-foreground/5 rounded-l-md" onMouseDown={(e) => handleMouseDown(e, project, 'resize-left')} />
                                                            <div className="absolute right-0 top-0 bottom-0 w-3 cursor-e-resize hover:bg-foreground/5 rounded-r-md" onMouseDown={(e) => handleMouseDown(e, project, 'resize-right')} />
                                                        </>
                                                    )}
                                                </div>
                                            </ContextMenu.Trigger>
                                            <ContextMenu.Portal>
                                                <ContextMenu.Content
                                                    className="min-w-[200px] bg-popover text-popover-foreground rounded-lg shadow-xl border border-border p-1 z-50 animate-in fade-in zoom-in-95 duration-100"
                                                    onMouseDown={(e) => e.stopPropagation()}
                                                    onMouseUp={(e) => e.stopPropagation()}
                                                >
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
                                                </ContextMenu.Content>
                                            </ContextMenu.Portal>
                                        </ContextMenu.Root>
                                    )}
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
                onManageTypes={onOpenSettings}
            />
        </div>
    );
}
