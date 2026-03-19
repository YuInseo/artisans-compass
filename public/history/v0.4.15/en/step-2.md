📅 **Date:** 2026-03-08T16:45:00+09:00

### ♻️ Refactor: Flattened Core Command Payload Types

- **Modified Files:**
  - **`src/plugins/api/payloads.ts`**
  - **`src/core/commands/editor-commands.ts`**
  - **`src/core/commands/plan-commands.ts`**
  - **`src/core/commands/routine-commands.ts`**

- **Changes (Refactoring Details):**
  - Deprecated the deeply nested `namespace CommandPayload` structure (e.g., `CommandPayload.Todo.Add`) in favor of modern, flattened TypeScript `interface` exports such as **`TodoAddPayload`** and **`PlanSavePayload`**.
  - Improved type discoverability and developer experience for third-party plugin authors by organizing API payload contracts.
  - Refactored all internal **Core Command implementation files** (`editor-commands`, `plan-commands`, `routine-commands`) to seamlessly adopt the newly flattened interfaces.
  
- **🧹 Cleanup:**
  - Removed an unused **`PlannedSession`** import in **`routine-commands.ts`**, resolving any remaining TypeScript (TSC) linter warnings and arriving at a strict definition baseline.
