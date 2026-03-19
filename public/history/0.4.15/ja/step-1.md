📅 **Date:** 2026-03-07T12:44:40+09:00

*   🐛 **Bugfix:** **`TodoItem.tsx`**での「すべての画像を隠す」トグルの同期問題を解決しました。画像全体が綺麗に折りたたまれるようになりました！
*   ✨ **Feature:** エディターのすべてのアクションを標準化するための新しい**プラグイン＆コマンドアーキテクチャ**（`Command.ts`, `CommandManager.ts`）を設計・実装しました！
*   ♻️ **Refactor:** 分散していた既存のロジックを、独立したクリーンなクラスコマンド（**`ToggleImageCollapseCommand`**, **`ClearUntitledTodosCommand`**）に移行しました。
*   🎨 **UI/UX:** コマンド実行、トースト通知、履歴の追跡を自動的に処理する再利用可能な**`ActionButton.tsx`**コンポーネントを導入しました。
*   🔧 **System:** 新しい**`useCommandStore`**をグローバルな`Ctrl+Z`と`Ctrl+Y`のキーボードショートカットにシームレスに統合しました。拡張機能解放！🚀
