import { BlockNoteView } from "@blocknote/shadcn";
import "@blocknote/shadcn/style.css";
import { useCreateBlockNote } from "@blocknote/react";
import { SideMenu, SideMenuController, DragHandleButton } from "@blocknote/react";
import { useTranslation } from "react-i18next";
import { useTodoStore } from "@/hooks/useTodoStore";
import { useDataStore } from "@/hooks/useDataStore";
import { useTheme } from "@/components/theme-provider";
import { useRef, useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { customSchema, todosToBlocks, blocksToTodos } from "@/utils/blocknote-utils";
import { Todo } from "@/types";

interface TodoEditorProps {
    activeProjectId: string;
    todos: Todo[];
    isWidgetMode: boolean;
    isWidgetLocked?: boolean;
}

export function TodoEditor({ activeProjectId, todos, isWidgetMode, isWidgetLocked = false }: TodoEditorProps) {
    const { setTodos } = useTodoStore();
    const { settings } = useDataStore();
    const { theme } = useTheme();
    const { } = useTranslation();

    // Internal state to track if we are currently editing (to avoid loops)
    const isLocalUpdate = useRef(false);

    // Debounce timer for saving to store
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Initial blocks generation
    // We only use this for initial render. Subsequent updates are handled via replaceBlocks
    const [initialBlocks] = useState(() => {
        return todos.length > 0 ? todosToBlocks(todos) : [{ type: "checkListItem", content: "" }];
    });

    const editor = useCreateBlockNote({
        initialContent: initialBlocks as any,
        schema: customSchema,
        // dictionary: {
        //     ...locales.en,
        //     placeholders: {
        //         ...locales.en.placeholders,
        //         default: t('dashboard.todoPlaceholder')
        //     }
        // }
    });

    // 1. Inbound Sync: Store -> Editor
    const lastProjectId = useRef(activeProjectId);

    useEffect(() => {
        if (!editor) return;

        const isProjectSwitch = lastProjectId.current !== activeProjectId;

        // Check for content equivalence to avoid unnecessary re-renders (which break cursor/input)
        const currentEditorTodos = blocksToTodos(editor.document);
        const isContentFunctionallyIdentical = JSON.stringify(currentEditorTodos) === JSON.stringify(todos);

        // Case 1: Project Switch - Always sync
        if (isProjectSwitch) {
            const newBlocks = todos.length > 0 ? todosToBlocks(todos) : [{ type: "checkListItem", content: "" }];
            // Set flag to avoid loop, though project switch is clear cut
            isLocalUpdate.current = true;
            editor.replaceBlocks(editor.document, newBlocks as any);

            setTimeout(() => isLocalUpdate.current = false, 50);

            lastProjectId.current = activeProjectId;
        }
        // Case 2: External Update - Sync only if content is DIFFERENT and it's NOT a local update
        // We add the content check here as a safety net. 
        else if (!isLocalUpdate.current && !isContentFunctionallyIdentical) {
            const newBlocks = todos.length > 0 ? todosToBlocks(todos) : [{ type: "checkListItem", content: "" }];
            editor.replaceBlocks(editor.document, newBlocks as any);
        }

    }, [activeProjectId, editor, todos]);

    // 2. Outbound Sync: Editor -> Store
    const handleEditorChange = useCallback(() => {
        if (!editor) return;

        // Auto-convert Paragraph -> CheckListItem if it has content
        const selection = editor.getTextCursorPosition();
        if (selection && selection.block.type === 'paragraph') {
            const text = Array.isArray(selection.block.content)
                ? selection.block.content.map(c => c.type === 'text' ? c.text : '').join('')
                : '';

            if (text.trim().length > 0) {
                editor.updateBlock(selection.block, { type: 'checkListItem', props: { checked: false } });
            }
        }

        // Clear previous timeout
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

        // Debounce update
        saveTimeoutRef.current = setTimeout(() => {
            const currentBlocks = editor.document;
            const newTodos = blocksToTodos(currentBlocks);

            // Mark this as a local update so the Effect doesn't overwrite us
            isLocalUpdate.current = true;
            setTodos(newTodos);

            // Clear the flag after safe margin (Store update + Effect run should happen fast)
            // But we need to ensure the Effect ran. 
            // Increase to 2000ms to be extremely safe against slow renders or race conditions
            setTimeout(() => {
                isLocalUpdate.current = false;
            }, 2000);
        }, 500);
    }, [editor, setTodos]);


    // 3. Custom Keyboard Handling (Arrow Keys & Locking)
    useEffect(() => {
        if (!editor || !editor.domElement) return;
        const container = editor.domElement.parentElement; // The div wrapping the editor
        if (!container) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            // Widget Locking
            if (isWidgetMode && isWidgetLocked) {
                if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key)) return;
                if ((e.metaKey || e.ctrlKey) && e.key === 'c') return; // Allow copy

                e.preventDefault();
                e.stopPropagation();
                return;
            }

            // Arrow Keys for Block Navigation (Fix for "Stuck in block")
            if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                const selection = editor.getTextCursorPosition();
                if (selection) {
                    const getFlatBlocks = (blocks: any[]): any[] => {
                        let flat: any[] = [];
                        for (const b of blocks) {
                            flat.push(b);
                            if (b.children && b.children.length > 0) {
                                flat = flat.concat(getFlatBlocks(b.children));
                            }
                        }
                        return flat;
                    };

                    const flat = getFlatBlocks(editor.document);
                    const idx = flat.findIndex(b => b.id === selection.block.id);

                    if (idx !== -1) {
                        if (e.key === "ArrowUp") {
                            if (idx > 0) {
                                e.preventDefault();
                                e.stopPropagation();
                                editor.setTextCursorPosition(flat[idx - 1], 'end');
                                editor.focus();
                            }
                        } else if (e.key === "ArrowDown") {
                            if (idx < flat.length - 1) {
                                e.preventDefault();
                                e.stopPropagation();
                                editor.setTextCursorPosition(flat[idx + 1], 'start');
                                editor.focus();
                            }
                        }
                    }
                }
            }
        };

        container.addEventListener("keydown", handleKeyDown, { capture: true });
        return () => container.removeEventListener("keydown", handleKeyDown, { capture: true });

    }, [editor, editor?.domElement, isWidgetMode, isWidgetLocked]);


    return (
        <div
            className={cn(
                "h-full w-full",
                settings?.showIndentationGuides === false && "hide-indent-guides",
                // Custom class to control checkbox visibility if needed
                settings?.checkboxVisibility === 'low' ? 'bn-checkbox-hover-only' : 'bn-checkbox-always-visible'
            )}
            data-hide-indent={settings?.showIndentationGuides === false ? "true" : "false"}
        >
            <BlockNoteView
                editor={editor}
                theme={theme === "dark" ? "dark" : "light"}
                formattingToolbar={false} // User requested menu removal
                onChange={handleEditorChange}
                editable={!(isWidgetMode && isWidgetLocked)} // Native locking!
                className={cn("min-h-full", isWidgetMode ? "widget-mode" : "")}
                sideMenu={false}
                slashMenu={false}
                data-hide-indent={!settings?.showIndentationGuides}
            >
                {/* Dictionary removed - auto-conversion handles flow */}
                <SideMenuController
                    sideMenu={(props) => (
                        <SideMenu {...props}>
                            <div onClickCapture={(e) => { e.stopPropagation(); e.preventDefault(); }}>
                                <DragHandleButton {...props} />
                            </div>
                        </SideMenu>
                    )}
                />
            </BlockNoteView>
        </div>
    );
}
