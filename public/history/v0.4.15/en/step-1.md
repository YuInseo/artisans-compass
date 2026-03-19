📅 **Date:** 2026-03-07T18:56:00+09:00

### ✨ Plugin UI Extensibility Architecture

*   **🔧 Interface Design:** Added `src/plugins/api.ts` exposing `IArtisansCompassPlugin`, `IUIExtensionRegistry`, and `IPluginContext` to allow for clean, isolated UI extensions.
*   **🏗️ Core Registry Implementation:** Created `UIRegistry.ts` and `PluginManager.ts` inside `src/core/` to securely manage and instantiate plugins without leaking internal Zustand states.
*   **🔌 Provider Integration:** Updated `ArtisansCompassProvider.tsx` to initialize `PluginManager` and `UIRegistry`, and added `useUIExtensions()` hook for consuming dynamic injectables.
*   **🧩 Settings Modal Extensibility:** Refactored `SettingsModal.tsx` to dynamically render settings tabs injected by plugins on top of the built-in tabs.
*   **🚀 Sidebar Extensibility:** Updated `AppSidebarRail.tsx` to map over dynamic sidebar buttons registered via `ISidebarItem`.
*   **🐛 Bugfix (React Context):** Resolved a React crash (`useArtisansCompass must be used within an ArtisansCompassProvider`) by properly lifting `ArtisansCompassProvider` into `main.tsx` to wrap the entire `App` component graph.
*   **✅ Manual Verification:** Created a mock `TestPlugin` to verify dynamic injection capabilities, which successfully renders injected 🧩 buttons and settings views.
