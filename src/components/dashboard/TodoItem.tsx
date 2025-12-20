import React, { useRef, useEffect } from 'react';
import { Todo } from '@/types';
import { cn } from '@/lib/utils';
import { ChevronRight, ChevronDown, CheckSquare, GripVertical } from 'lucide-react';
import TextareaAutosize from 'react-textarea-autosize';

interface TodoItemProps {
    todo: Todo;
    depth: number;
    onUpdate: (id: string, updates: Partial<Todo>) => void;
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
    checkboxVisibility?: 'high' | 'low';
    isLocked?: boolean;
    onNavigate?: (direction: 'up' | 'down', id: string) => void;
}

export const TodoItem: React.FC<TodoItemProps> = ({
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
    checkboxVisibility = 'high',
    isLocked = false,
    onNavigate
}) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-focus logic
    useEffect(() => {
        if (!isLocked && !isDragging && focusedId === todo.id && textareaRef.current) {
            // Use requestAnimationFrame to break synchronous focus loops
            requestAnimationFrame(() => {
                if (document.activeElement !== textareaRef.current && textareaRef.current) {
                    textareaRef.current.focus();
                }
            });
        }
    }, [focusedId, todo.id, isDragging, isLocked]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (isLocked) return;
        if (e.nativeEvent.isComposing) return;

        if (e.key === 'Enter') {
            e.preventDefault();
            onAdd(null, todo.id); // Add sibling by default
        } else if (e.key === 'Tab') {
            e.preventDefault();
            if (e.shiftKey) {
                onUnindent(todo.id);
            } else {
                onIndent(todo.id);
            }
            onDelete(todo.id);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            onNavigate?.('up', todo.id);
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            onNavigate?.('down', todo.id);
        }
    };

    const toggleCollapse = () => {
        onUpdate(todo.id, { isCollapsed: !todo.isCollapsed });
    };

    const toggleComplete = () => {
        onUpdate(todo.id, { completed: !todo.completed });
    };


    const hasChildren = todo.children && todo.children.length > 0;

    return (
        <div
            className={cn(
                "group flex items-start gap-1 py-[2px] px-2 transition-colors hover:bg-muted/50 rounded-sm text-base min-h-[30px]", // Increased text size and height
                todo.completed && "opacity-60",
                isDragging && "opacity-50 bg-muted"
            )}
            style={{
                marginLeft: `${depth * 24}px`,
                ...style
            }}
        >
            {/* Drag Handle */}
            {!isLocked && (
                <div
                    className="opacity-0 group-hover:opacity-100 flex items-center justify-center h-6 w-4 cursor-move text-muted-foreground/40 hover:text-muted-foreground transition-opacity -ml-1.5 mr-0.5"
                    {...dragHandleProps}
                >
                    <GripVertical size={16} />
                </div>
            )}
            {isLocked && <div className="w-3" />}

            {/* Collapse/Expand Toggle */}
            <div className="w-5 h-6 flex items-center justify-center shrink-0">
                {hasChildren ? (
                    <button
                        onClick={toggleCollapse}
                        className="text-muted-foreground/60 hover:text-foreground transition-colors p-0.5 hover:bg-muted rounded"
                        onPointerDown={(e) => e.stopPropagation()}
                    >
                        {todo.isCollapsed ? <ChevronRight size={16} strokeWidth={2} /> : <ChevronDown size={16} strokeWidth={2} />}
                    </button>
                ) : (
                    <div className="w-5" />
                )}
            </div>

            {/* Checkbox */}
            <div className={cn(
                "h-6 flex items-center justify-center shrink-0 ml-1 mr-2 transition-opacity duration-200",
                checkboxVisibility === 'low' && !todo.completed ? "opacity-0 group-hover:opacity-100 focus-within:opacity-100" : "opacity-100"
            )}>
                <button
                    onClick={toggleComplete}
                    onPointerDown={(e) => e.stopPropagation()}
                    className={cn(
                        "w-4 h-4 flex items-center justify-center rounded-[4px] transition-colors focus:outline-none",
                        todo.completed
                            ? "bg-primary border border-primary text-primary-foreground hover:bg-primary/90"
                            : cn(
                                "border bg-card",
                                checkboxVisibility === 'high'
                                    ? "border-zinc-500 bg-zinc-800 hover:border-zinc-400 hover:bg-zinc-700"
                                    : "border-zinc-700 bg-zinc-800 hover:border-zinc-500"
                            )
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
            <div className="flex-1 min-w-0 flex py-[3px]">
                <TextareaAutosize
                    ref={textareaRef}
                    value={todo.text}
                    onChange={(e) => !isLocked && onUpdate(todo.id, { text: e.target.value })}
                    onKeyDown={handleKeyDown}
                    onFocus={() => onFocus(todo.id)}
                    readOnly={isLocked}
                    minRows={1}
                    placeholder={isLocked ? "" : "New task..."}
                    className={cn(
                        "w-full bg-transparent resize-none outline-none leading-normal overflow-hidden min-h-[1.5rem] pt-0 placeholder:text-muted-foreground/30 font-medium block h-auto",
                        todo.completed ? "line-through text-muted-foreground/60" : "text-foreground focus:text-foreground",
                        isLocked && "cursor-default"
                    )}
                />
            </div>
        </div>
    );
};
