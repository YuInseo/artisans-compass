import "@blocknote/core/fonts/inter.css";
import { useCreateBlockNote, SideMenuController, SideMenu, DragHandleButton } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import "@blocknote/shadcn/style.css";
import { useEffect, useCallback, useRef, useState } from "react";
import { useTodoStore } from "@/hooks/useTodoStore";
import { useDataStore } from "@/hooks/useDataStore";
import { useTheme } from "@/components/theme-provider";
import { todosToBlocks, blocksToTodos, customSchema } from "@/utils/blocknote-utils";
import { cn } from "@/lib/utils";
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
    });

    // 1. Inbound Sync: Store -> Editor
    const lastProjectId = useRef(activeProjectId);

    useEffect(() => {
        if (!editor) return;

        const isProjectSwitch = lastProjectId.current !== activeProjectId;

        // Case 1: Project Switch - Always sync
        if (isProjectSwitch) {
            const newBlocks = todos.length > 0 ? todosToBlocks(todos) : [{ type: "checkListItem", content: "" }];
            // Set flag to avoid loop, though project switch is clear cut
            isLocalUpdate.current = true;
            editor.replaceBlocks(editor.document, newBlocks as any);

            setTimeout(() => isLocalUpdate.current = false, 50);

            lastProjectId.current = activeProjectId;
        }
        // Case 2: External Update (e.g. Undo/Redo) - Sync if NOT a local update
        else if (!isLocalUpdate.current) {
            const newBlocks = todos.length > 0 ? todosToBlocks(todos) : [{ type: "checkListItem", content: "" }];
            editor.replaceBlocks(editor.document, newBlocks as any);
        }

    }, [activeProjectId, editor, todos]);

    // 2. Outbound Sync: Editor -> Store
    const handleEditorChange = useCallback(() => {
        if (!editor) return;

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
            // 500ms after setter is generous for React render cycle.
            setTimeout(() => {
                isLocalUpdate.current = false;
            }, 100);
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
