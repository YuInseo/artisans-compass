
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import { todosToBlocks, customSchema } from "@/utils/blocknote-utils";
import { Todo } from "@/types";
import { useEffect, useMemo } from "react";
import "@blocknote/shadcn/style.css";

interface ArchiveBlockNoteProps {
    todos: Todo[];
}

export function ArchiveBlockNote({ todos }: ArchiveBlockNoteProps) {
    const initialBlocks = useMemo(() => {
        return todosToBlocks(todos);
    }, [todos]); // Re-compute if todos reference changes (deep check might be better but ref is std)

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
        const blocks = todosToBlocks(todos);
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
            className="min-h-[100px] pointer-events-none select-none journey-log-theme" // Scoped class
            slashMenu={false}
            formattingToolbar={false}
        />
    );
}
