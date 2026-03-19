📅 **Date:** 2026-03-07T12:44:40+09:00

*   🐛 **Bugfix:** Resolved an issue in **`TodoItem.tsx`** where the global "Hide All Images" toggle was not synchronizing correctly. Images now cleanly collapse and expand across the entire editor.
*   ✨ **Feature:** Designed and implemented a new **Plugin & Command Architecture** (`Command.ts`, `CommandManager.ts`) to standardize all editor actions!
*   ♻️ **Refactor:** Migrated existing scattered logic into dedicated, clean class commands: **`ToggleImageCollapseCommand`** and **`ClearUntitledTodosCommand`**.
*   🎨 **UI/UX:** Introduced a reusable **`ActionButton.tsx`** component that automatically handles command execution, toasts, and history tracking.
*   🔧 **System:** Integrated the new **`useCommandStore`** seamlessly into the global `Ctrl+Z` and `Ctrl+Y` keyboard shortcuts. Extensibility unlocked! 🚀
