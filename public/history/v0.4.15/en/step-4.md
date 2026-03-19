📅 **Date:** 2026-03-08T16:55:20+09:00

### ✨ Feature: `<TitleBarItem>` View-Specific Visibility Filtering (`showOnViews`)

- **Modified Files:**
  - **`src/plugins/api/ui.ts`**
  - **`src/plugins/api/components.tsx`**
  - **`src/components/layout/AppTitleBarControls.tsx`**
  - **`plugins/test-plugin/test-plugin.tsx`**

- **Changes (Feature Details):**
  - Introduced the `showOnViews?: string[]` property to the `<TitleBarItem>` API, allowing developers to restrict a plugin's title bar button visibility to specific active views.
  - Added real-time filtering logic within `src/components/layout/AppTitleBarControls.tsx` that evaluates the incoming plugin items against the current `dashboardView` state before rendering.
  - Passing an array like `['daily', 'my-custom-view']` guarantees the button only appears on those screens. Omitting the prop defaults the button to being universally visible.
