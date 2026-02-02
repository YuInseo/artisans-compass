import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Todo } from "@/types";
import { useTodoStore } from "@/hooks/useTodoStore";
import { useDataStore } from "@/hooks/useDataStore";
import { cn } from "@/lib/utils";
import { TodoItem } from "./TodoItem";
import {
    DndContext,
    DragEndEvent,
    DragOverlay,
    DragStartEvent,
    DragMoveEvent,
    MouseSensor,
    TouchSensor,
    useSensor,
    useSensors,
    closestCenter,
    PointerSensor
} from '@dnd-kit/core';
import {
    SortableContext,
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface TodoEditorProps {
    todos: Todo[];
    isWidgetMode: boolean;
    isWidgetLocked?: boolean;
    actions?: {
        addTodo: (text: string, parentId?: string | null, afterId?: string | null) => string;
        updateTodo: (id: string, updates: Partial<Todo>, skipHistory?: boolean) => void;
        deleteTodo: (id: string) => void;
        deleteTodos: (ids: string[]) => void;
        indentTodo: (id: string) => void;
        unindentTodo: (id: string) => void;
        moveTodo: (activeId: string, parentId: string | null, index: number) => void;
        moveTodos: (activeIds: string[], parentId: string | null, index: number) => void;
    };
}

const SortableTodoItem = ({ todo, indicatorPosition, indicatorDepth, onSelectAll, showIndentationGuides, ...props }: any) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
        isOver
    } = useSortable({ id: todo.id });

    const style = {
        transform: CSS.Translate.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 'auto',
        position: 'relative' as 'relative',
        opacity: isDragging ? 0.3 : 1, // Fade out original
    };

    // Calculate left offset for the indicator based on depth
    const indicatorStyle = indicatorDepth !== undefined ? {
        left: `${indicatorDepth * 24}px`
    } : {};

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            className="w-full"
        // Removed data-todo-id from here to allow "margin" selection
        >
            <TodoItem
                todo={todo}
                {...props}
                isDragging={isDragging}
                dragHandleProps={listeners}
                data-todo-id={todo.id} // Passed to TodoItem visually
                onSelectAll={onSelectAll}
                showIndentationGuides={showIndentationGuides} // Pass it down
            />
            {/* Visual Drop Indicator */}
            {isOver && !isDragging && indicatorPosition && (
                <div
                    className={cn(
                        "absolute right-0 h-[2px] bg-blue-500 pointer-events-none z-50",
                        indicatorPosition === 'top' ? "top-0 -translate-y-1/2" : "bottom-0 translate-y-1/2"
                    )}
                    style={indicatorStyle}
                />
            )}
        </div>
    );
};

export function TodoEditor({ todos, isWidgetMode, isWidgetLocked = false, actions }: TodoEditorProps) {
    const store = useTodoStore();
    const { settings } = useDataStore();

    // transform store actions to match interface if needed, or just pluck them
    // easier to destructure based on priority
    const addTodo = actions?.addTodo || store.addTodo;
    const updateTodo = actions?.updateTodo || store.updateTodo;
    const deleteTodo = actions?.deleteTodo || store.deleteTodo;
    const deleteTodos = actions?.deleteTodos || store.deleteTodos;
    const indentTodo = actions?.indentTodo || store.indentTodo;
    const unindentTodo = actions?.unindentTodo || store.unindentTodo;
    const moveTodo = actions?.moveTodo || store.moveTodo;
    const moveTodos = actions?.moveTodos || store.moveTodos;

    // We strictly control focus via state
    const [focusedId, setFocusedId] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [activeDragId, setActiveDragId] = useState<string | null>(null);
    const [dragDeltaX, setDragDeltaX] = useState<number>(0); // Track horizontal drag

    // Selection Box State
    const [selectionBox, setSelectionBox] = useState<{ startX: number, startY: number, currentX: number, currentY: number } | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Sensors
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5, // Avoid accidental drags while clicking
            },
        }),
        useSensor(TouchSensor),
        useSensor(MouseSensor)
    );

    // Helpers to flatten visible list for navigation AND SortableContext
    // Flatten list with depth info for projection
    const getVisibleItemsHelper = useCallback((list: Todo[], depth: number = 0): { todo: Todo, depth: number }[] => {
        let flat: { todo: Todo, depth: number }[] = [];
        for (const t of list) {
            flat.push({ todo: t, depth });
            if (!t.isCollapsed && t.children && t.children.length > 0) {
                flat.push(...getVisibleItemsHelper(t.children, depth + 1));
            }
        }
        return flat;
    }, []);

    const visibleItemsWithDepth = useMemo(() => getVisibleItemsHelper(todos), [todos, getVisibleItemsHelper]);
    const visibleIds = useMemo(() => visibleItemsWithDepth.map(i => i.todo.id), [visibleItemsWithDepth]);

    // Helpers need simple list sometimes (for basic lookup)
    const visibleItems = useMemo(() => visibleItemsWithDepth.map(i => i.todo), [visibleItemsWithDepth]);


    const handleNavigate = useCallback((direction: 'up' | 'down', currentId: string, shiftKey: boolean = false) => {
        const flat = visibleItems;
        const idx = flat.findIndex(t => t.id === currentId);

        if (idx === -1) return;

        let targetId: string | null = null;
        if (direction === 'up' && idx > 0) targetId = flat[idx - 1].id;
        else if (direction === 'down' && idx < flat.length - 1) targetId = flat[idx + 1].id;

        if (targetId) {
            if (shiftKey) {
                const newSelected = new Set(selectedIds);
                newSelected.add(currentId);
                newSelected.add(targetId);
                setSelectedIds(newSelected);
                setFocusedId(targetId);
            } else {
                setSelectedIds(new Set());
                setFocusedId(targetId);
            }
        }
    }, [visibleItems, selectedIds]);

    // Handle Click for Selection (Shift+Click)
    const handleClick = useCallback((id: string, shiftKey: boolean) => {
        if (shiftKey && focusedId) {
            const flat = visibleItems;
            const startIdx = flat.findIndex(t => t.id === focusedId);
            const endIdx = flat.findIndex(t => t.id === id);

            if (startIdx !== -1 && endIdx !== -1) {
                const min = Math.min(startIdx, endIdx);
                const max = Math.max(startIdx, endIdx);
                const range = flat.slice(min, max + 1).map(t => t.id);
                setSelectedIds(new Set(range));
            }
        } else {
            if (selectedIds.size > 0) setSelectedIds(new Set());
        }
        setFocusedId(id);
    }, [visibleItems, focusedId, selectedIds]);

    // Handlers
    const handleAdd = useCallback((parentId: string | null, afterId: string | null) => {
        const newId = addTodo("", parentId, afterId);
        setFocusedId(newId);
        setSelectedIds(new Set());
    }, [addTodo]);

    // Auto-create default todo if list is empty
    useEffect(() => {
        // Only in main dashboard mode (not widget) - AND ONLY AFTER LOADING
        if (!isWidgetMode && todos.length === 0 && store.hasLoaded) {
            handleAdd(null, null);
        }
    }, [todos.length, isWidgetMode, handleAdd, store.hasLoaded]);

    const handleDelete = useCallback((id: string) => {
        const flat = visibleItems;

        // Prevent deletion of the last remaining item
        if (flat.length === 1 && flat[0].id === id) {
            updateTodo(id, { text: "" });
            return;
        }

        const idx = flat.findIndex(t => t.id === id);

        let nextFocusId: string | null = null;
        if (idx > 0) nextFocusId = flat[idx - 1].id;
        else if (idx < flat.length - 1) nextFocusId = flat[idx + 1].id;

        deleteTodo(id);

        if (nextFocusId) {
            setFocusedId(nextFocusId);
        }
        setSelectedIds(new Set());
    }, [visibleItems, deleteTodo, updateTodo]);

    const handleSelectAll = useCallback(() => {
        const allIds = new Set(visibleIds);
        setSelectedIds(allIds);
    }, [visibleIds]);

    // DnD Handlers
    const handleDragStart = (event: DragStartEvent) => {
        setActiveDragId(event.active.id as string);
        setDragDeltaX(0); // Reset delta
    };

    const handleDragMove = (event: DragMoveEvent) => {
        setDragDeltaX(event.delta.x);
    };

    const INDENT_WIDTH = 24;

    // Helper to calculate visual depth from drag offset
    // const getDragDepth = (offset: number, indentationWidth: number) => {
    //     return Math.round(offset / indentationWidth);
    // };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over, delta } = event;

        setActiveDragId(null);
        setDragDeltaX(0);
        document.body.style.cursor = '';

        if (!over || active.id === over.id) return;

        const flatItems = visibleItemsWithDepth;

        const activeIndex = flatItems.findIndex(i => i.todo.id === active.id);
        const overIndex = flatItems.findIndex(i => i.todo.id === over.id);

        if (activeIndex === -1 || overIndex === -1) return;

        const activeItem = flatItems[activeIndex];

        // Calculate Projected Depth
        const dragDepth = Math.round(delta.x / INDENT_WIDTH);
        const projectedDepth = Math.max(0, activeItem.depth + dragDepth);

        // Determine New Parent
        let newParentId: string | null = null;

        // If moving UP (activeIndex > overIndex), we are inserting BEFORE `over`. 
        // So the relevant context is the item at `overIndex - 1`.
        // If moving DOWN (activeIndex < overIndex), we are inserting AFTER `over`.
        // So the relevant context is `over` itself.

        const isMovingDown = activeIndex < overIndex;
        const searchStart = isMovingDown ? overIndex : overIndex - 1;

        if (searchStart < 0) {
            // We are at the very top of the list
            newParentId = null;
        } else {
            for (let i = searchStart; i >= 0; i--) {
                const item = flatItems[i];
                if (item.todo.id === active.id) continue;

                if (item.depth < projectedDepth) {
                    newParentId = item.todo.id;
                    break;
                }
            }
        }
        // Calculate Index
        const parentIndex = newParentId ? flatItems.findIndex(i => i.todo.id === newParentId) : -1;
        const searchStartIndex = parentIndex === -1 ? 0 : parentIndex + 1;
        const targetDepth = newParentId ? (flatItems[parentIndex].depth + 1) : 0;

        let newIndex = 0;
        // Count siblings up to `overIndex`
        // If moving DOWN (activeIndex < overIndex), we insert AFTER the over item, so we include it in the count.
        // If moving UP (activeIndex > overIndex), we insert BEFORE the over item, so we exclude it (stop before).

        const limitIndex = isMovingDown ? overIndex : overIndex - 1;

        // Check if we are dragging a selection
        const isMultiDrag = active.id && selectedIds.has(active.id as string) && selectedIds.size > 1;
        const idsToMove = isMultiDrag ? Array.from(selectedIds) : [active.id as string];

        for (let i = searchStartIndex; i <= limitIndex; i++) {
            if (i >= flatItems.length) break;
            if (flatItems[i].depth < targetDepth) break; // Exited scope

            // If any of the moved items are here, skip them (they will be removed)
            if (isMultiDrag) {
                if (selectedIds.has(flatItems[i].todo.id)) continue;
            } else {
                if (i === activeIndex) continue;
            }

            if (flatItems[i].depth === targetDepth) {
                newIndex++;
            }
        }

        if (isMultiDrag) {
            moveTodos(idsToMove, newParentId, newIndex);
            setSelectedIds(new Set()); // Contextually clear selection or keep it? 
            // Usually nice to keep selection on drop? 
            // But if we move, the IDs might be regenerated? No, we keep IDs.
            // Let's keep selection.
        } else {
            moveTodo(active.id as string, newParentId, newIndex);
        }
    };


    const [draggedIds, setDraggedIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (activeDragId) {
            const ids = new Set<string>();
            const collect = (nodes: Todo[]) => {
                for (const node of nodes) {
                    ids.add(node.id);
                    if (node.children) collect(node.children);
                }
            };
            // Find the active node first
            const findAndCollect = (nodes: Todo[]) => {
                for (const node of nodes) {
                    if (node.id === activeDragId) {
                        collect([node]);
                        return true;
                    }
                    if (node.children) {
                        if (findAndCollect(node.children)) return true;
                    }
                }
                return false;
            };
            findAndCollect(todos);
            setDraggedIds(ids);
        } else {
            setDraggedIds(new Set());
        }
    }, [activeDragId, todos]);

    // Recursive Renderer for Overlay (tree structure)
    const renderOverlayItem = (todo: Todo, depth: number) => {
        const isMultiDrag = draggedIds.size > 1;

        return (
            <div className="relative">
                <TodoItem
                    todo={todo}
                    depth={depth}
                    onUpdate={() => { }}
                    onAdd={() => { }}
                    onDelete={() => { }}
                    onIndent={() => { }}
                    onUnindent={() => { }}
                    isLocked={true}
                    isDragging={true}
                    focusedId={null}
                    onFocus={() => { }}
                />
                {!todo.isCollapsed && todo.children && (
                    todo.children.map(child => renderOverlayItem(child, depth + 1))
                )}
                {isMultiDrag && (
                    <div className="absolute -top-2 -right-2 bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-md z-[100]">
                        +{draggedIds.size}
                    </div>
                )}
            </div>
        );
    };



    // Auto-scroll and Bulk Selection Logic
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.key === 'Backspace' || e.key === 'Delete') && selectedIds.size > 0) {
                const activeTag = document.activeElement?.tagName;
                // If input/textarea is focused, ONLY allow delete if it's a multi-selection
                // (Assuming intention is to delete selected items, not edit text)
                // If single selection + input focus, let native backspace handle text edit
                if ((activeTag === 'INPUT' || activeTag === 'TEXTAREA') && selectedIds.size <= 1) return;

                e.preventDefault();
                deleteTodos(Array.from(selectedIds));
                setSelectedIds(new Set());
            }

            // Undo/Redo
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'z') {
                    e.preventDefault();
                    if (e.shiftKey) {
                        store.redo();
                    } else {
                        store.undo();
                    }
                } else if (e.key === 'y') {
                    e.preventDefault();
                    store.redo();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedIds, deleteTodo, store]);

    // Track pointer Y for auto-scroll independent of events
    const pointerY = useRef(0);

    useEffect(() => {
        if (!selectionBox) return;

        let animationFrameId: number;

        const scrollLoop = () => {
            const scrollThreshold = 50;
            const scrollSpeed = 15; // Increased speed
            const viewHeight = window.innerHeight;
            const y = pointerY.current;

            if (y < scrollThreshold) {
                window.scrollBy(0, -scrollSpeed);
            } else if (y > viewHeight - scrollThreshold) {
                window.scrollBy(0, scrollSpeed);
            }

            animationFrameId = requestAnimationFrame(scrollLoop);
        };

        // Start loop
        animationFrameId = requestAnimationFrame(scrollLoop);

        const handleSelectionMove = (e: PointerEvent) => {
            pointerY.current = e.clientY; // Update ref

            if (!containerRef.current) return;

            const containerRect = containerRef.current.getBoundingClientRect();
            // Calculate coordinates relative to the container
            // This ensures logic holds even if page scrolls
            const currentX = e.clientX - containerRect.left;
            const currentY = e.clientY - containerRect.top;

            setSelectionBox(prev => prev ? { ...prev, currentX, currentY } : null);

            const rect = {
                left: Math.min(selectionBox.startX, currentX),
                top: Math.min(selectionBox.startY, currentY),
                width: Math.abs(currentX - selectionBox.startX),
                height: Math.abs(currentY - selectionBox.startY)
            };

            const elements = containerRef.current.querySelectorAll('[data-todo-id]');
            const newSelected = new Set<string>();

            elements.forEach((el) => {
                const elRect = el.getBoundingClientRect();
                // Convert to relative coordinates to match selection box
                const elRelativeTop = elRect.top - containerRect.top;
                const elRelativeBottom = elRect.bottom - containerRect.top;

                // Vertical-only intersection check using relative coordinates
                const isIntersecting = !(
                    rect.top >= elRelativeBottom ||
                    rect.top + rect.height <= elRelativeTop
                );

                if (isIntersecting) {
                    const id = el.getAttribute('data-todo-id');
                    if (id) newSelected.add(id);
                }
            });

            setSelectedIds(newSelected);
        };

        const handleSelectionEnd = () => {
            setSelectionBox(null);
        };

        window.addEventListener('pointermove', handleSelectionMove);
        window.addEventListener('pointerup', handleSelectionEnd);

        return () => {
            window.removeEventListener('pointermove', handleSelectionMove);
            window.removeEventListener('pointerup', handleSelectionEnd);
            cancelAnimationFrame(animationFrameId);
        };
    }, [selectionBox]);

    const handleSelectionStart = (e: React.PointerEvent) => {
        const target = e.target as HTMLElement;

        // Prevent selection start only if clicking interactive elements
        if (
            target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.tagName === 'BUTTON' ||
            target.closest('button') || // Check parent button
            target.closest('[data-dnd-handle]') || // If we mark handles explicitly
            target.closest('[data-editable-text]') || // Allow text selection/focus
            target.closest('.lucide') // Icons often clickable
        ) {
            return;
        }

        // We DO NOT block [data-todo-id] anymore, allowing drag from indentation/background.
        e.preventDefault(); // Prevent native text selection
        e.currentTarget.setPointerCapture(e.pointerId); // Capture pointer for consistent drag

        // Calculate start position relative to container (handles scroll)
        const containerRect = e.currentTarget.getBoundingClientRect();
        const startX = e.clientX - containerRect.left;
        const startY = e.clientY - containerRect.top;

        setSelectionBox({
            startX,
            startY,
            currentX: startX,
            currentY: startY
        });
        setSelectedIds(new Set()); // Clear selection on new drag
        setFocusedId(null);
    };

    // Calculate active index and item once
    const activeItemWithDepth = useMemo(() => {
        if (!activeDragId) return null;
        return visibleItemsWithDepth.find(i => i.todo.id === activeDragId);
    }, [activeDragId, visibleItemsWithDepth]);

    const activeIndex = useMemo(() => {
        if (!activeDragId) return -1;
        return visibleItemsWithDepth.findIndex(i => i.todo.id === activeDragId);
    }, [activeDragId, visibleItemsWithDepth]);

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragMove={handleDragMove}
            onDragEnd={handleDragEnd}
        >
            {/* Outer container captures interactions across full width */}
            <div
                ref={containerRef}
                className={cn("w-full h-full min-h-full relative select-none")}
                onPointerDown={handleSelectionStart}
            >
                {/* Inner container centers the content */}
                <div className={cn(
                    "w-full pb-20 flex flex-col items-stretch",
                    !isWidgetMode && "max-w-4xl mx-auto px-6"
                )}>
                    <SortableContext
                        items={visibleIds}
                        strategy={verticalListSortingStrategy}
                    >
                        {visibleItemsWithDepth.map((item, index) => {
                            // Calculate indicator depth
                            let indicatorDepth = item.depth;
                            let indicatorPosition = undefined;

                            // ... (indicator logic remains same)

                            if (activeDragId && activeIndex !== -1 && activeItemWithDepth && activeDragId !== item.todo.id) {
                                const isMovingDown = activeIndex < index;
                                indicatorPosition = isMovingDown ? 'bottom' : 'top';

                                const contextItem = isMovingDown ? item : (index > 0 ? visibleItemsWithDepth[index - 1] : null);
                                const maxDepth = contextItem ? contextItem.depth + 1 : 0;

                                const projectedDepth = Math.max(0, activeItemWithDepth.depth + Math.round(dragDeltaX / INDENT_WIDTH));
                                indicatorDepth = Math.min(projectedDepth, maxDepth);
                            }

                            return (
                                <SortableTodoItem
                                    key={item.todo.id}
                                    id={item.todo.id}
                                    todo={item.todo}
                                    depth={item.depth}
                                    onUpdate={updateTodo}
                                    onAdd={handleAdd}
                                    onDelete={handleDelete}
                                    onIndent={indentTodo}
                                    onUnindent={unindentTodo}
                                    focusedId={focusedId}
                                    onFocus={setFocusedId}
                                    onNavigate={handleNavigate}
                                    isLocked={isWidgetLocked}
                                    isSelected={selectedIds.has(item.todo.id)}
                                    onSelectClick={handleClick}
                                    isMultiSelection={selectedIds.size > 1}
                                    indicatorPosition={indicatorPosition}
                                    indicatorDepth={indicatorDepth}
                                    onSelectAll={handleSelectAll}
                                    showIndentationGuides={settings?.showIndentationGuides} // Pass prop
                                    spellCheck={settings?.enableSpellCheck ?? false}
                                    isWidgetMode={isWidgetMode}
                                />
                            );
                        })}
                    </SortableContext>


                </div>

                {/* Selection Box Overlay */}
                {selectionBox && (
                    <div
                        className="absolute border border-blue-500 bg-blue-500/20 z-50 pointer-events-none"
                        style={{
                            left: Math.min(selectionBox.startX, selectionBox.currentX),
                            top: Math.min(selectionBox.startY, selectionBox.currentY),
                            width: Math.abs(selectionBox.currentX - selectionBox.startX),
                            height: Math.abs(selectionBox.currentY - selectionBox.startY),
                        }}
                    />
                )}
            </div>

            <DragOverlay dropAnimation={null}>
                {activeDragId ? (
                    (() => {
                        // Find the node in the flat list to get the Todo object
                        const flatNode = visibleItemsWithDepth.find(i => i.todo.id === activeDragId);

                        if (flatNode) {
                            return renderOverlayItem(flatNode.todo, 0); // Overlay always depth 0 relative to cursor
                        }
                        return null;
                    })()
                ) : null}
            </DragOverlay>
        </DndContext>
    );
};
