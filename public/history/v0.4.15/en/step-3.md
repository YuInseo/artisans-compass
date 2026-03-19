📅 **Date:** 2026-03-08T16:55:00+09:00

### ✨ Feature: Top Title Bar Plugin Extensibility (`<TitleBarItem>`)

- **Modified Files:**
  - **`src/plugins/api/ui.ts`**
  - **`src/plugins/api/components.tsx`**
  - **`src/plugins/api/index.ts`**
  - **`src/core/UIRegistry.ts`**
  - **`src/core/ArtisansCompassProvider.tsx`**
  - **`src/components/layout/AppTitleBarControls.tsx`**
  - **`plugins/test-plugin/test-plugin.tsx`**

- **Changes (Feature Details):**
  - Introduced the new **`<TitleBarItem>`** API component, allowing plugin developers to seamlessly inject custom functional buttons onto the right side of the topmost Title Bar area.
  - Added the `BaseTitleBarItem` abstract class and updated the internal registry methods within `src/plugins/api/ui.ts` to properly manage this new extension point.
  - Connected the `titleBarItems` array inside the `src/core/UIRegistry.ts` state model, and elegantly mapped it inside `src/components/layout/AppTitleBarControls.tsx` to render as uniform Ghost Buttons.
  - Successfully validated the implementation by injecting the new component directly from within the `test-plugin` environment.
