📅 **Date:** 2026-03-08T16:55:00+09:00

### ✨ Feature: 最上部のタイトルバープラグイン拡張機能を追加 (`<TitleBarItem>`)

- **対象ファイル:**
  - **`src/plugins/api/ui.ts`**
  - **`src/plugins/api/components.tsx`**
  - **`src/plugins/api/index.ts`**
  - **`src/core/UIRegistry.ts`**
  - **`src/core/ArtisansCompassProvider.tsx`**
  - **`src/components/layout/AppTitleBarControls.tsx`**
  - **`plugins/test-plugin/test-plugin.tsx`**

- **作業内容 (Feature Details):**
  - プラグイン開発者がアプリの最上部タイトルツールバー（Title Bar）領域の右側にカスタムボタンを簡単に追加できるよう、**`<TitleBarItem>`** API を新規導入しました。
  - そのため `src/plugins/api/ui.ts` 内に `BaseTitleBarItem` 抽象クラスと関連するレジストリ・メソッドを追加しました。
  - `src/core/UIRegistry.ts` の状態モデルに `titleBarItems` 配列を連携し、`src/components/layout/AppTitleBarControls.tsx` ファイル内にマッピングコードを挿入して、透明ボタン(Ghost Button)スタイルを一貫して適用しました。
  - `test-plugin` 内で直接 `TitleBarItem` を使った注入テストを安全に完了しました。
