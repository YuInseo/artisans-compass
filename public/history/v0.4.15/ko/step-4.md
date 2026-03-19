📅 **Date:** 2026-03-08T16:55:20+09:00

### ✨ Feature: `<TitleBarItem>` 특정 뷰(View) 노출 필터링 기능 추가 (`showOnViews`)

- **대상 파일:**
  - **`src/plugins/api/ui.ts`**
  - **`src/plugins/api/components.tsx`**
  - **`src/components/layout/AppTitleBarControls.tsx`**
  - **`plugins/test-plugin/test-plugin.tsx`**

- **작업 내용 (Feature Details):**
  - `<TitleBarItem>` 컴포넌트가 모든 화면에서 강제로 노출되는 것을 방지하기 위해, 특정 화면(View)에서만 보이도록 제어하는 `showOnViews?: string[]` 속성을 추가했습니다.
  - `src/components/layout/AppTitleBarControls.tsx` 렌더링 파트에서 현재 활성화된 `dashboardView` 상태값을 기반으로 아이템을 맵핑 전 필터링 처리하도록 로직을 구현했습니다.
  - 플러그인 개발자가 위 옵션을 배열 형태로 전달하면 (예: `['daily', 'test-main-view']`) 해당 뷰에서만 버튼이 노출되며, 값이 없거나 빈 배열일 경우 기본적으로 항상 보이도록 fallback 처리되었습니다.
