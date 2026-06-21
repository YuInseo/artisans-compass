import React, { useRef, useEffect } from 'react';
import { Todo } from '@/types';
import { cn } from '@/lib/utils';
import { CheckSquare, GripVertical, X, Download, Trash2, ZoomIn, MessageSquareText, Eye, EyeOff } from 'lucide-react';
import TextareaAutosize from 'react-textarea-autosize';
import { useTranslation } from 'react-i18next';
import { ImageModal } from './ImageModal';

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
    onAddImages?: (paths: string[], insertAfterId: string) => void;
    onPasteItems?: (items: Array<{text: string, completed: boolean, indent: number}>, afterId: string) => void;
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
    onAddImages,
    onPasteItems,
    isWidgetMode = false,
    'data-todo-id': dataTodoId,
    editorAlignment = 'left'
}: TodoItemProps & { 'data-todo-id'?: string, isWidgetMode?: boolean, editorAlignment?: 'left' | 'center' }) => {
    const { t } = useTranslation();
    const textareaRef = useRef<HTMLTextAreaElement | HTMLDivElement>(null);
    const [localText, setLocalText] = React.useState(todo.text);
    // Adjusted padding: Large (76px) only for center mode, standard (24px) for left/widget
    const BASE_PADDING = (isWidgetMode || editorAlignment === 'left') ? 24 : 76;

    // Sync local state with prop, but ONLY if not focused (to prevent overwriting user input)
    const isFocused = focusedId === todo.id;
    const isFocusedRef = useRef(isFocused);
    const [isUploading, setIsUploading] = React.useState(false);
    const [isImageModalOpen, setIsImageModalOpen] = React.useState(false);
    // resizingWidth removed — resize uses direct DOM manipulation for performance
    const [isCaptionVisible, setIsCaptionVisible] = React.useState(!!todo.text);
    const [isImageCollapsed, setIsImageCollapsed] = React.useState(todo.isCollapsed || false);
    const imageContainerRef = useRef<HTMLDivElement>(null);

    const handleResizeStart = (e: React.PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();
        // Stop DndContext PointerSensor from intercepting via capture phase
        e.nativeEvent.stopImmediatePropagation();

        if (isLocked) return;

        // Capture pointer to this element so all subsequent pointer events route here
        const target = e.currentTarget as HTMLElement;
        target.setPointerCapture(e.pointerId);

        const startX = e.pageX;
        const container = imageContainerRef.current;
        const startWidth = container?.getBoundingClientRect().width || 0;

        document.body.classList.add('select-none');

        // Direct DOM manipulation during drag to avoid React re-renders (prevents lag)
        const handlePointerMove = (moveEvent: PointerEvent) => {
            const deltaX = moveEvent.pageX - startX;
            const newWidth = Math.max(100, Math.min(startWidth + deltaX, window.innerWidth - 100));
            if (container) {
                container.style.width = `${newWidth}px`;
            }
        };

        const handlePointerUp = (upEvent: PointerEvent) => {
            target.releasePointerCapture(upEvent.pointerId);
            document.removeEventListener('pointermove', handlePointerMove);
            document.removeEventListener('pointerup', handlePointerUp);
            document.removeEventListener('pointercancel', handlePointerUp);
            document.body.classList.remove('select-none');

            const finalDeltaX = upEvent.pageX - startX;
            const finalWidth = Math.max(100, startWidth + finalDeltaX);
            if (container) {
                container.style.width = '';  // Clear inline style, let React take over
            }
            onUpdate(todo.id, { imageWidth: finalWidth });
        };

        document.addEventListener('pointermove', handlePointerMove);
        document.addEventListener('pointerup', handlePointerUp);
        document.addEventListener('pointercancel', handlePointerUp);
    };

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

    useEffect(() => {
        setIsImageCollapsed(todo.isCollapsed || false);
    }, [todo.isCollapsed]);

    // Auto-focus logic
    useEffect(() => {
        if (!isLocked && !isDragging && focusedId === todo.id && textareaRef.current) {
            // Use requestAnimationFrame to break synchronous focus loops
            requestAnimationFrame(() => {
                if (document.activeElement !== textareaRef.current && textareaRef.current) {
                    const el = textareaRef.current;
                    el.focus();
                    // Move cursor to end if input type
                    if ('setSelectionRange' in el && typeof el.setSelectionRange === 'function' && 'value' in el) {
                        const len = (el as HTMLTextAreaElement).value.length;
                        (el as HTMLTextAreaElement).setSelectionRange(len, len);
                    }
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

    const handleImageUpload = async (file: File) => {
        if (!file.type.startsWith('image/')) return;

        try {
            setIsUploading(true);
            const reader = new FileReader();
            reader.onload = async (e) => {
                const base64Data = e.target?.result as string;
                if (!base64Data) return;

                try {
                    const savedPath = await (window as any).ipcRenderer.saveTodoImage(base64Data);
                    if (onAddImages) {
                        onAddImages([savedPath], todo.id);
                    } else {
                        const currentImages = todo.images || [];
                        onUpdate(todo.id, { images: [...currentImages, savedPath] });
                    }
                } catch (error) {
                    console.error("Failed to save image locally", error);
                } finally {
                    setIsUploading(false);
                }
            };
            reader.readAsDataURL(file);
        } catch (error) {
            console.error("Error processing image file", error);
            setIsUploading(false);
        }
    }

    const handlePaste = (e: React.ClipboardEvent) => {
        if (isLocked) return;
        const items = e.clipboardData?.items;
        if (!items) return;

        // Check for images first
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                e.preventDefault();
                const file = items[i].getAsFile();
                if (file) handleImageUpload(file);
                return;
            }
        }

        // Check for markdown checkbox patterns in text
        const text = e.clipboardData?.getData('text/plain');
        if (text && onPasteItems) {
            const checkboxPattern = /^(\s*)[-*]\s*\[([ xX])\]\s*(.*)/;
            const lines = text.split('\n').filter(l => l.trim().length > 0);
            const hasCheckboxes = lines.some(l => checkboxPattern.test(l));

            if (hasCheckboxes) {
                e.preventDefault();
                const baseIndent = lines.reduce((min, l) => {
                    const match = l.match(/^(\s*)/);
                    const spaces = match ? match[1].replace(/\t/g, '    ').length : 0;
                    return Math.min(min, spaces);
                }, Infinity);

                const parsed = lines.map(line => {
                    const match = line.match(checkboxPattern);
                    if (match) {
                        const rawIndent = match[1].replace(/\t/g, '    ').length;
                        return {
                            text: match[3].trim(),
                            completed: match[2].toLowerCase() === 'x',
                            indent: Math.floor((rawIndent - baseIndent) / 2)
                        };
                    }
                    // Non-checkbox line: treat as unchecked item
                    const rawIndent = (line.match(/^(\s*)/)?.[1] || '').replace(/\t/g, '    ').length;
                    return {
                        text: line.trim(),
                        completed: false,
                        indent: Math.floor((rawIndent - baseIndent) / 2)
                    };
                });

                onPasteItems(parsed, todo.id);
            }
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        if (isLocked) return;

        // Prevent default to allow drop
        e.preventDefault();
        e.stopPropagation();

        const items = e.dataTransfer.items;
        if (!items) return;

        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const file = items[i].getAsFile();
                if (file) handleImageUpload(file);
                // We don't break here to allow dropping multiple images at once
            }
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        if (isLocked) return;
        // Allows drop
        e.preventDefault();
    };

    const removeImage = (indexToRemove: number) => {
        if (isLocked || !todo.images) return;
        const newImages = todo.images.filter((_, idx) => idx !== indexToRemove);
        onUpdate(todo.id, { images: newImages });
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
            {todo.type !== 'image' && (
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
            )}

            {/* Content */}
            <div
                className="flex-1 min-w-0 flex flex-col cursor-text"

                onClick={(e) => {
                    if (!isLocked && e.target === e.currentTarget) {
                        onFocus(todo.id);
                    }
                }}
                onPaste={handlePaste}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
            >
                {todo.type === 'image' && todo.images && todo.images.length > 0 ? (
                    <div
                        className={cn("relative group/img my-3 outline-none rounded-lg flex flex-col items-center", focusedId === todo.id ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : "")}
                        tabIndex={0}
                        ref={(node) => {
                            if (node) {
                                (textareaRef as any).current = node;
                                (imageContainerRef as any).current = node;
                            }
                        }}
                        onKeyDown={(e) => handleKeyDown(e as any)}
                        style={{
                            width: isImageCollapsed ? 'auto' : (todo.imageWidth ? `${todo.imageWidth}px` : '100%'),
                            maxWidth: '100%'
                        }}
                    >
                        {/* Collapsed/Expanded View */}
                        {!isImageCollapsed ? (
                            <>
                                <img
                                    src={todo.images[0]}
                                    className="w-full h-auto rounded-lg object-contain shadow-sm cursor-pointer select-none"
                                    style={{
                                        height: todo.imageWidth ? 'auto' : undefined,
                                    }}
                                    draggable={false}
                                    alt="Image block"
                                    onDoubleClick={(e) => {
                                        e.stopPropagation();
                                        setIsImageModalOpen(true);
                                    }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsImageModalOpen(true);
                                    }}
                                />
                                <div
                                    className="absolute top-3 right-3 flex items-center h-8 bg-[#2f2f2f]/95 backdrop-blur-md text-[#a5a5a5] rounded-[6px] px-1 opacity-0 group-hover/img:opacity-100 transition-opacity z-10 shadow-lg border border-white/10"
                                    onPointerDown={(e) => e.stopPropagation()}
                                >
                                    <button
                                        className="h-6 w-7 flex items-center justify-center hover:bg-[#454545] hover:text-white rounded-sm transition-colors"
                                        title="Collapse Image"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setIsImageCollapsed(true);
                                            onUpdate(todo.id, { isCollapsed: true });
                                        }}
                                    >
                                        <EyeOff size={14} />
                                    </button>
                                    <button
                                        className={cn(
                                            "h-6 w-7 flex items-center justify-center hover:bg-[#454545] rounded-sm transition-colors",
                                            isCaptionVisible ? "text-white bg-[#454545]" : "hover:text-white"
                                        )}
                                        title="Toggle Caption"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setIsCaptionVisible(!isCaptionVisible);
                                        }}
                                    >
                                        <MessageSquareText size={14} />
                                    </button>
                                    <button
                                        className="h-6 w-7 flex items-center justify-center hover:bg-[#454545] hover:text-white rounded-sm transition-colors"
                                        title="Open Original"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setIsImageModalOpen(true);
                                        }}
                                    >
                                        <ZoomIn size={14} />
                                    </button>
                                    <button
                                        className="h-6 w-7 flex items-center justify-center hover:bg-[#454545] hover:text-white rounded-sm transition-colors"
                                        title="Download"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const a = document.createElement('a');
                                            a.href = todo.images![0];
                                            a.download = `image-${Date.now()}.png`;
                                            document.body.appendChild(a);
                                            a.click();
                                            document.body.removeChild(a);
                                        }}
                                    >
                                        <Download size={14} />
                                    </button>

                                    {!isLocked && (
                                        <button
                                            className="h-6 w-7 flex items-center justify-center hover:bg-red-500/80 hover:text-white rounded-sm transition-colors ml-1"
                                            title="Delete Block"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onDelete(todo.id);
                                            }}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>

                                {/* Right-side Resize Handle */}
                                {!isLocked && (
                                    <div
                                        data-resize-handle
                                        className="absolute top-0 right-0 w-4 h-full cursor-col-resize opacity-0 group-hover/img:opacity-100 flex items-center justify-center -mr-2 z-20 select-none"
                                        style={{ touchAction: 'none' }}
                                        onPointerDown={handleResizeStart}
                                        onDragStart={(e) => e.preventDefault()}
                                    >
                                        <div className="w-1.5 h-12 bg-white/50 rounded-full shadow-sm pointer-events-none" />
                                    </div>
                                )}
                            </>
                        ) : (
                            <div
                                className="w-full flex items-center gap-2 py-2 px-3 bg-muted/30 border border-border/50 rounded-md cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsImageCollapsed(false);
                                    onUpdate(todo.id, { isCollapsed: false });
                                }}
                            >
                                <Eye size={16} className="text-muted-foreground" />
                                <span className="text-sm font-medium text-muted-foreground flex-1">
                                    {todo.text ? `이미지 접힘: ${todo.text}` : '이미지 접힘 (1장)'}
                                </span>
                                <div
                                    className="flex items-center gap-1"
                                    onPointerDown={(e) => e.stopPropagation()}
                                >
                                    <button
                                        className="h-6 w-7 flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground rounded-sm transition-colors"
                                        title="Expand Image"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setIsImageCollapsed(false);
                                            onUpdate(todo.id, { isCollapsed: false });
                                        }}
                                    >
                                        <Eye size={14} />
                                    </button>
                                    {!isLocked && (
                                        <button
                                            className="h-6 w-7 flex items-center justify-center text-muted-foreground hover:bg-red-500/20 hover:text-red-500 rounded-sm transition-colors"
                                            title="Delete Block"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onDelete(todo.id);
                                            }}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Image Caption Area */}
                        {!isLocked && isCaptionVisible && (
                            <div className="mt-1.5 w-full flex justify-center transition-all duration-200">
                                <TextareaAutosize
                                    value={localText}
                                    onChange={(e) => setLocalText(e.target.value)}
                                    onBlur={() => {
                                        if (localText !== todo.text) {
                                            onUpdate(todo.id, { text: localText }, false);
                                        }
                                    }}
                                    minRows={1}
                                    placeholder="캡션 작성"
                                    className="bg-transparent resize-none outline-none leading-normal overflow-hidden h-auto text-sm text-center text-muted-foreground placeholder:text-muted-foreground/40 block w-full max-w-[90%]"
                                />
                            </div>
                        )}
                    </div>
                ) : todo.type !== 'image' && focusedId === todo.id ? (
                    <TextareaAutosize
                        ref={textareaRef as any}
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
                            if (localText.trim() === "" && todo.text.trim() !== "") {
                                // Only auto-delete if the user cleared existing text, not a fresh empty todo
                                onDelete(todo.id);
                            } else if (localText !== todo.text) {
                                onUpdate(todo.id, { text: localText }, false);
                            }
                        }}
                        onKeyDown={handleKeyDown}
                        readOnly={isLocked}
                        minRows={1}
                        placeholder={isLocked ? "" : t("dashboard.newTask")}
                        className={cn(
                            "bg-transparent resize-none outline-none leading-normal overflow-hidden min-h-[1.5rem] pt-0 placeholder:text-muted-foreground/30 font-medium block h-auto",
                            "w-full max-w-full select-text break-all",
                            todo.completed ? "line-through text-muted-foreground/60" : "text-foreground focus:text-foreground",
                            isLocked && "cursor-default",
                            isWidgetMode && "drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
                        )}
                    />
                ) : todo.type !== 'image' ? (
                    <div
                        className={cn(
                            "bg-transparent leading-normal min-h-[1.5rem] pt-0 font-medium block h-auto whitespace-pre-wrap break-words break-all",
                            "w-fit max-w-full cursor-text", // Changed w-full to w-fit
                            todo.completed ? "line-through text-muted-foreground/60" : "text-foreground",
                            isLocked && "cursor-default",
                            isWidgetMode && "drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
                        )}
                        data-editable-text
                        onClick={(e) => {
                            if (!isLocked) {
                                e.stopPropagation(); // Don't trigger row selection
                                onFocus(todo.id);
                            }
                        }}
                    >
                        {localText || <span className="text-muted-foreground/30 italic">{t("dashboard.newTask")}</span>}
                    </div>
                ) : null}

                {/* Images Container */}
                {todo.type !== 'image' && todo.images && todo.images.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2 select-none mb-1">
                        {todo.images.map((imgSrc, idx) => (
                            <div key={idx} className="relative group/img">
                                <img
                                    src={imgSrc}
                                    className="max-h-32 md:max-h-64 rounded-md object-contain cursor-pointer shadow-sm border border-border/40 bg-zinc-950/20"
                                    alt="Todo attachment"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        window.open(imgSrc, '_blank');
                                    }}
                                />
                                {!isLocked && (
                                    <div onPointerDown={(e) => e.stopPropagation()}>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                removeImage(idx);
                                            }}
                                            className="absolute -top-2 -right-2 bg-destructive/90 text-destructive-foreground hover:bg-destructive p-0.5 rounded-full opacity-0 group-hover/img:opacity-100 transition-opacity drop-shadow-md z-10"
                                        >
                                            <X size={12} strokeWidth={3} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
                {isUploading && (
                    <div className="text-xs text-muted-foreground mt-1 animate-pulse">
                        Uploading image...
                    </div>
                )}
            </div>

            {isImageModalOpen && todo.images && todo.images.length > 0 && (
                <ImageModal
                    src={todo.images[0]}
                    onClose={() => setIsImageModalOpen(false)}
                />
            )}
        </div>
    );
});
