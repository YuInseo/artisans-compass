📅 **Date:** 2026-03-08T16:55:00+09:00

### ✨ Feature: 최상단 타이틀 바 플러그인 확장 기능 추가 (`<TitleBarItem>`)

- **대상 파일:**
  - **`src/plugins/api/ui.ts`**
  - **`src/plugins/api/components.tsx`**
  - **`src/plugins/api/index.ts`**
  - **`src/core/UIRegistry.ts`**
  - **`src/core/ArtisansCompassProvider.tsx`**
  - **`src/components/layout/AppTitleBarControls.tsx`**
  - **`plugins/test-plugin/test-plugin.tsx`**

- **작업 내용 (Feature Details):**
  - 플러그인 개발자가 앱 최상단의 제목 툴바(Title Bar) 영역 우측에 커스텀 버튼을 쉽게 추가할 수 있도록 **`<TitleBarItem>`** API 컴포넌트를 신규 도입했습니다.
  - 이를 위해 `src/plugins/api/ui.ts`내에 `BaseTitleBarItem` 추상 클래스와 관련 레지스트리 메서드들을 추가했습니다.
  - `src/core/UIRegistry.ts` 상태 모델 안에 `titleBarItems` 배열을 연결하고, `src/components/layout/AppTitleBarControls.tsx` 파일 내에 JSX 맵핑 코드를 삽입하여 투명 버튼(Ghost Button) 스타일을 일관되게 적용했습니다.
  - `test-plugin` 내에서 `TitleBarItem`을 직접 사용하여 테스트를 성공적으로 완료했습니다.
