📅 **Date:** 2026-03-08T16:55:20+09:00

### ✨ Feature: `<TitleBarItem>` 特定ビューでの表示制御機能を追加 (`showOnViews`)

- **対象ファイル:**
  - **`src/plugins/api/ui.ts`**
  - **`src/plugins/api/components.tsx`**
  - **`src/components/layout/AppTitleBarControls.tsx`**
  - **`plugins/test-plugin/test-plugin.tsx`**

- **作業内容 (Feature Details):**
  - `<TitleBarItem>` プラグインボタンが全ての画面で強制的に表示されないよう、特定のビューでのみ表示させるための `showOnViews?: string[]` プロパティを追加しました。
  - `src/components/layout/AppTitleBarControls.tsx` のレンダリング処理内で、現在アクティブな `dashboardView` の状態に基づいてアイテムをフィルタリングするロジックを実装しました。
  - `['daily', 'test-main-view']` のように配列を渡すことで、ボタンが特定の画面でのみ表示されます。プロパティが省略された場合は、デフォルトで常に表示されるように処理されています。
