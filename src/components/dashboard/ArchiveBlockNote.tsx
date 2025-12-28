
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import { todosToBlocks, customSchema } from "@/utils/blocknote-utils";
import { Todo } from "@/types";
import { useEffect, useMemo } from "react";
import { useDataStore } from "@/hooks/useDataStore";
import { cn } from "@/lib/utils";
import "@blocknote/shadcn/style.css";

interface ArchiveBlockNoteProps {
    todos: Todo[];
}

export function ArchiveBlockNote({ todos }: ArchiveBlockNoteProps) {
    const { settings } = useDataStore();
    const initialBlocks = useMemo(() => {
        // Recursive Clean: Remove "Untitled" or empty text items
        const cleanTodosRecursive = (list: Todo[]): Todo[] => {
            return list
                .filter(t => {
                    const txt = t.text.trim();
                    return txt !== "" && txt.toLowerCase() !== "untitled";
                })
                .map(t => ({
                    ...t,
                    children: t.children ? cleanTodosRecursive(t.children) : []
                }));
        };

        const cleanTodos = cleanTodosRecursive(todos);
        return todosToBlocks(cleanTodos);
    }, [todos]);

    const editor = useCreateBlockNote({
        initialContent: initialBlocks.length > 0 ? (initialBlocks as any) : undefined,
        schema: customSchema,
    });

    // Disable editing
    useEffect(() => {
        editor.isEditable = false;
    }, [editor]);

    // Force update content if todos change significantly
    useEffect(() => {
        const cleanTodosRecursive = (list: Todo[]): Todo[] => {
            return list
                .filter(t => {
                    const txt = t.text.trim();
                    return txt !== "" && txt.toLowerCase() !== "untitled";
                })
                .map(t => ({
                    ...t,
                    children: t.children ? cleanTodosRecursive(t.children) : []
                }));
        };
        const blocks = todosToBlocks(cleanTodosRecursive(todos));
        if (blocks.length > 0) {
            editor.replaceBlocks(editor.document, blocks as any);
        } else {
            // clear?
        }
    }, [todos, editor]);

    return (
        <BlockNoteView
            editor={editor}
            theme="dark" // Consistent Dark Theme

            className={cn(
                "min-h-[100px] pointer-events-none select-none journey-log-theme",
                settings?.showIndentationGuides === false && "hide-indent-guides"
            )}
            slashMenu={false}
            formattingToolbar={false}
        />
    );
}
