import React, { useRef, useEffect } from 'react';
import { Todo } from '@/types';
import { cn } from '@/lib/utils';
import { CheckSquare, GripVertical } from 'lucide-react';
import TextareaAutosize from 'react-textarea-autosize';

interface TodoItemProps {
    todo: Todo;
    depth: number;
    onUpdate: (id: string, updates: Partial<Todo>, skipHistory?: boolean) => void;
    onAdd: (parentId: string | null, afterId: string | null) => void;
    onDelete: (id: string) => void;
    onIndent: (id: string) => void;
    onUnindent: (id: string) => void;
    focusedId: string | null;
    onFocus: (id: string) => void;
    // DnD props
    style?: React.CSSProperties;
    dragHandleProps?: any;
    isDragging?: boolean;
    showIndentationGuides?: boolean;
    isLocked?: boolean;
    onNavigate?: (direction: 'up' | 'down', id: string, shiftKey: boolean) => void;
    isSelected?: boolean;
    onSelectClick?: (id: string, shiftKey: boolean) => void;
    onSelectAll?: () => void;
    spellCheck?: boolean;
}

export const TodoItem = React.memo<TodoItemProps>(({
    todo,
    depth = 0,
    onUpdate,
    onAdd,
    onDelete,
    onIndent,
    onUnindent,
    focusedId,
    onFocus,
    style,
    dragHandleProps,
    isDragging,
    showIndentationGuides = true,
    isLocked = false,
    onNavigate,
    isSelected,
    onSelectClick,
    onSelectAll,
    spellCheck = false,
    isWidgetMode = false,
    'data-todo-id': dataTodoId,
    editorAlignment = 'left'
}: TodoItemProps & { 'data-todo-id'?: string, isWidgetMode?: boolean, editorAlignment?: 'left' | 'center' }) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [localText, setLocalText] = React.useState(todo.text);
    // Adjusted padding: Large (76px) only for center mode, standard (24px) for left/widget
    const BASE_PADDING = (isWidgetMode || editorAlignment === 'left') ? 24 : 76;

    // Sync local state with prop, but ONLY if not focused (to prevent overwriting user input)
    const isFocused = focusedId === todo.id;
    const isFocusedRef = useRef(isFocused);

    useEffect(() => {
        isFocusedRef.current = isFocused;
    }, [isFocused]);

    useEffect(() => {
        // If we are currently editing, ignore external updates to text to avoid flickering/reverting
        // unless the text is completely different (optional, but for now stick to simple guard)
        if (isFocusedRef.current) return;

        if (todo.text !== localText) {
            setLocalText(todo.text);
        }
    }, [todo.text]);

    // Auto-focus logic
    useEffect(() => {
        if (!isLocked && !isDragging && focusedId === todo.id && textareaRef.current) {
            // Use requestAnimationFrame to break synchronous focus loops
            requestAnimationFrame(() => {
                if (document.activeElement !== textareaRef.current && textareaRef.current) {
                    const el = textareaRef.current;
                    el.focus();
                    // Move cursor to end
                    const len = el.value.length;
                    el.setSelectionRange(len, len);
                }
            });
        }
    }, [focusedId, todo.id, isDragging, isLocked]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (isLocked) return;
        // if (e.nativeEvent.isComposing) return; // Allow keys during composition to be safe, or handle specifically?
        // Usually IME ignores Enter/Tab/Arrows, but we should be careful. 
        // Let's rely on default behavior unless we explicitly handle it.

        if (e.key === 'Enter') {
            if (!e.nativeEvent.isComposing) {
                e.preventDefault();

                // FORCE SAVE: Ensure current text is saved before switching focus/adding new task
                if (localText !== todo.text) {
                    onUpdate(todo.id, { text: localText }, false);
                }

                // If has children, insert as first child
                if (todo.children && todo.children.length > 0) {
                    onAdd(todo.id, todo.id);
                } else {
                    onAdd(null, todo.id); // Add sibling by default
                }
            }
        } else if (e.key === 'Tab') {
            e.preventDefault(); // Always prevent tab navigation
            if (e.shiftKey) {
                onUnindent(todo.id);
            } else {
                onIndent(todo.id);
            }
            // Removed erroneous onDelete(todo.id) here!
        } else if (e.key === 'Backspace') {
            // Delete if empty OR at start of line (merge behavior requested)
            if (e.currentTarget.value === '' || (e.currentTarget.selectionStart === 0 && e.currentTarget.selectionEnd === 0)) {
                e.preventDefault();
                onDelete(todo.id);
            }
        } else if (e.key === 'ArrowUp') {
            // e.preventDefault(); // Don't prevent default immediately, let onNavigate decide? 
            // Actually, for Up/Down, we likely want to override native multiline behavior only if we are at edge.
            // But since these are mostly single lines, let's just trigger navigation.
            // Check if composing to avoid breaking IME selection
            if (!e.nativeEvent.isComposing) {
                e.preventDefault(); // Prevent cursor moving to start of line repeatedly
                if (localText !== todo.text) {
                    onUpdate(todo.id, { text: localText }, false);
                }
                onNavigate?.('up', todo.id, e.shiftKey);
            }
        } else if (e.key === 'ArrowDown') {
            if (!e.nativeEvent.isComposing) {
                e.preventDefault();
                if (localText !== todo.text) {
                    onUpdate(todo.id, { text: localText }, false);
                }
                onNavigate?.('down', todo.id, e.shiftKey);
            }
        } else if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
            // Smart Select All
            if (e.currentTarget.selectionStart === 0 && e.currentTarget.selectionEnd === e.currentTarget.value.length) {
                // If already fully selected, bubble up to select all todos
                e.preventDefault();
                onSelectAll?.();
            }
            // Otherwise, let default Ctrl+A happen (selects text)
        } else if (e.key === 'Escape') {
            // Optional: Block selection entry point?
            // For now, let's just blur or something? 
            // Better: trigger a 'select self' action
            if (onSelectClick) onSelectClick(todo.id, false);
            e.currentTarget.blur();
        }
    };

    // const toggleCollapse = () => { ... } // Removed

    const toggleComplete = () => {
        onUpdate(todo.id, { completed: !todo.completed });
    };


    // const hasChildren = todo.children && todo.children.length > 0; // Unused
    // const hasChildren = todo.children && todo.children.length > 0; // Unused
    // const dataTodoId = todo.id; // Removed duplicate

    return (
        <div
            className={cn(
                "group flex items-start gap-0 py-[2px] pl-2 pr-12 transition-colors duration-100 rounded-sm text-base min-h-[30px] w-full relative", // Added w-full and relative
                todo.completed && "opacity-60",
                isDragging && "opacity-50 bg-muted",
                isSelected ? "bg-primary/20 hover:bg-primary/25" : "hover:bg-muted/50"
            )}
            style={{
                paddingLeft: `${(depth * 24) + BASE_PADDING}px`, // Adjusted base padding
                ...style
            }}
            onClick={(e) => {
                // If clicking content area
                if (onSelectClick) onSelectClick(todo.id, e.shiftKey);
            }}
            data-todo-id={dataTodoId} // Applied here
        >
            {/* Indentation Lines */}
            {showIndentationGuides && depth > 0 && Array.from({ length: depth }).map((_, i) => (
                <div
                    key={i}
                    className="absolute w-[1px] bg-border/50 h-full"
                    style={{
                        left: `${BASE_PADDING + (i * 24)}px` // Aligned with the padding steps
                    }}
                />
            ))}

            {/* Collapse/Expand Toggle Removed as requested */}

            {/* Drag Handle - Moved after Toggle to be closer to checkbox */}
            {!isLocked && (
                <div
                    className="opacity-20 group-hover:opacity-100 flex items-center justify-center h-6 w-4 cursor-move text-muted-foreground/40 hover:text-muted-foreground transition-opacity mr-1"
                    {...dragHandleProps}
                    data-dnd-handle // Explicit marker for checking in TodoEditor
                >
                    <GripVertical size={16} />
                </div>
            )}
            {isLocked && <div className="w-3" />}

            {/* Checkbox */}
            <div className={cn(
                "h-6 flex items-center justify-center shrink-0 mr-2 transition-opacity duration-200 opacity-100", // Always visible
                "relative"
            )}>

                <button
                    onClick={toggleComplete}
                    onPointerDown={(e) => e.stopPropagation()}
                    className={cn(
                        "w-4 h-4 flex items-center justify-center rounded-[4px] transition-colors focus:outline-none",
                        todo.completed
                            ? "bg-primary border-2 border-primary text-primary-foreground hover:bg-primary/90"
                            : "border-2 bg-card border-muted-foreground/60 bg-transparent hover:border-muted-foreground/80 hover:bg-muted/10"
                    )}
                    title={todo.completed ? "Mark as incomplete" : "Mark as complete"}
                >
                    {todo.completed ? (
                        <CheckSquare className="w-3 h-3" strokeWidth={3} />
                    ) : (
                        null
                    )}
                </button>
            </div>

            {/* Content */}
            <div
                className="flex-1 min-w-0 flex cursor-text"
                onClick={(e) => {
                    if (!isLocked && e.target === e.currentTarget) {
                        onFocus(todo.id);
                    }
                }}
            >
                {focusedId === todo.id ? (
                    <TextareaAutosize
                        ref={textareaRef}
                        spellCheck={spellCheck}
                        value={localText}
                        onChange={(e) => {
                            let val = e.target.value;
                            // Notion-style arrow replacement
                            val = val.replace(/->/g, '→').replace(/<-/g, '←');
                            setLocalText(val);
                        }}
                        onBlur={() => {
                            if (isLocked) return;
                            if (localText.trim() === "") {
                                onDelete(todo.id);
                            } else if (localText !== todo.text) {
                                onUpdate(todo.id, { text: localText }, false);
                            }
                        }}
                        onKeyDown={handleKeyDown}
                        readOnly={isLocked}
                        minRows={1}
                        placeholder={isLocked ? "" : "New task..."}
                        className={cn(
                            "bg-transparent resize-none outline-none leading-normal overflow-hidden min-h-[1.5rem] pt-0 placeholder:text-muted-foreground/30 font-medium block h-auto",
                            "w-full max-w-full select-text break-all",
                            todo.completed ? "line-through text-muted-foreground/60" : "text-foreground focus:text-foreground",
                            isLocked && "cursor-default"
                        )}
                    />
                ) : (
                    <div
                        className={cn(
                            "bg-transparent leading-normal min-h-[1.5rem] pt-0 font-medium block h-auto whitespace-pre-wrap break-words break-all",
                            "w-fit max-w-full cursor-text", // Changed w-full to w-fit
                            todo.completed ? "line-through text-muted-foreground/60" : "text-foreground",
                            isLocked && "cursor-default"
                        )}
                        data-editable-text
                        onClick={(e) => {
                            if (!isLocked) {
                                e.stopPropagation(); // Don't trigger row selection
                                onFocus(todo.id);
                            }
                        }}
                    >
                        {localText || <span className="text-muted-foreground/30 italic">New task...</span>}
                    </div>
                )}
            </div>
        </div>
    );
});
