📅 **Date:** 2026-03-08T16:45:00+09:00

### ♻️ Refactor: コアコマンドのペイロード型の平坦化

- **対象ファイル:**
  - **`src/plugins/api/payloads.ts`**
  - **`src/core/commands/editor-commands.ts`**
  - **`src/core/commands/plan-commands.ts`**
  - **`src/core/commands/routine-commands.ts`**

- **変更内容 (Refactoring Details):**
  - **`CommandPayload.Todo.Add`** のような深くネストされた `namespace` 構造を廃止し、最新のTypeScriptの手法であるフラットな `interface` (**`TodoAddPayload`**, **`PlanSavePayload`** など)の直接エクスポートへ移行しました。
  - プラグイン開発者がAPIペイロードの構造を直感的に発見・再利用しやすくなるよう、API設計をクリーンアップしました。
  - 新しい型宣言を使うように、既存のすべての**コアコマンド実装ファイル** (`editor-commands`, `plan-commands`, `routine-commands`) の依存関係を更新しました。
  
- **🧹 Cleanup:**
  - **`routine-commands.ts`** 内で使用されていなかった **`PlannedSession`** のインポートを削除し、TypeScript (TSC) のリンター警告が完全に発生しない状態まで整理しました。
