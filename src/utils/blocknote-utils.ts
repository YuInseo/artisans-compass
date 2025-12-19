import { Block, PartialBlock, BlockNoteSchema, defaultBlockSpecs } from "@blocknote/core";
import { Todo } from "@/types";
// import { v4 as uuidv4 } from "uuid";

// Custom schema with NO inline styles (bold, italic, etc.)
// AND restricted blocks (ONLY checkListItem)

export const customSchema = BlockNoteSchema.create({
    blockSpecs: {
        paragraph: defaultBlockSpecs.paragraph,
        checkListItem: defaultBlockSpecs.checkListItem,
    },
    // Disable all inline styles (bold, italic, underline, strike, code, colors)
    styleSpecs: {},
});

// CheckListItem Block Structure (Partial)
// {
//   id: "...",
//   type: "checkListItem",
//   props: {
//      textColor: "default",
//      backgroundColor: "default",
//      textAlignment: "left",
//      checked: boolean
//   },
//   content: [{ type: "text", text: "...", styles: {} }],
//   children: []
// }

export const todosToBlocks = (todos: Todo[]): PartialBlock[] => {
    return todos.map(todo => ({
        id: todo.id,
        type: "checkListItem",
        props: {
            checked: todo.completed
        },
        content: todo.text,
        children: todo.children ? todosToBlocks(todo.children) : []
    }));
};

// Simplified parser: Extracts text and checked state, ignores styling/formatting for now to fit Todo model
export const blocksToTodos = (blocks: Block[]): Todo[] => {
    return blocks.map(block => {
        const textContent = Array.isArray(block.content)
            ? block.content.map(c => c.type === 'text' ? c.text : '').join('')
            : '';

        // Handle both "checkListItem" and our aliased "paragraph" (which is effectively a checkbox now)
        // Note: For "paragraph" (aliased), the props might not default to unchecked if not set,
        // but since we aligned the spec, it should have the 'checked' prop.
        // Standard check
        const header = block.type === "checkListItem";
        const isChecked = header && (block.props as any).checked === true;

        return {
            id: block.id,
            text: textContent || "", // Fallback for empty blocks
            completed: isChecked,
            children: block.children ? blocksToTodos(block.children) : [],
            isCollapsed: false // BlockNote handles collapse visually in UI, but we default to open in data
        };
    });
};
