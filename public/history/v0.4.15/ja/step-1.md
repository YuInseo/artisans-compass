📅 **Date:** 2026-03-07T18:56:00+09:00

### ✨ Plugin UI Extensibility Architecture

*   **🔧 Interface Design:** `src/plugins/api.ts` を追加し、`IArtisansCompassPlugin`、`IUIExtensionRegistry`、および `IPluginContext` を公開して、クリーンで分離された UI 拡張機能を作成できるようにしました。
*   **🏗️ Core Registry Implementation:** `UIRegistry.ts` と `PluginManager.ts` を `src/core/` 内に作成し、内部の Zustand 状態をリークすることなく安全にプラグインを管理・インスタンス化します。
*   **🔌 Provider Integration:** `ArtisansCompassProvider.tsx` を更新して `PluginManager` と `UIRegistry` を初期化し、動的インジェクトを消費するための `useUIExtensions()` フックを追加しました。
*   **🧩 Settings Modal Extensibility:** `SettingsModal.tsx` をリファクタリングして、組み込みのタブの上にプラグインによって追加された設定タブを動的にレンダリングするようにしました。
*   **🚀 Sidebar Extensibility:** `AppSidebarRail.tsx` を更新して、`ISidebarItem` 経由で登録された動的サイドバーボタンを表示できるようにしました。
*   **🐛 Bugfix (React Context):** React のクラッシュエラー (`useArtisansCompass must be used within an ArtisansCompassProvider`) を解決しました。`App` 全体を適切にラップするために、`ArtisansCompassProvider` を `main.tsx` に引き上げました。
*   **✅ Manual Verification:** UIの動的挿入機能を確認するためにモックの `TestPlugin` を作成し、カスタム設定タブと 🧩 ボタンが正常にレンダリングされることを確認しました。
