📅 **Date:** 2026-03-07T12:44:40+09:00

*   🐛 **Bugfix:** **`TodoItem.tsx`**에서 "모든 이미지 숨기기" 버튼이 제대로 동기화되지 않던 문제를 해결했습니다. 이제 전체 에디터에서 이미지가 깔끔하게 접히고 펼쳐집니다!
*   ✨ **Feature:** 에디터의 모든 액션을 표준화하기 위해 새로운 **플러그인 및 커맨드 아키텍처**(`Command.ts`, `CommandManager.ts`)를 설계하고 구현했습니다!
*   ♻️ **Refactor:** 흩어져 있던 기존 로직들을 깔끔한 독립적인 클래스 커맨드인 **`ToggleImageCollapseCommand`**와 **`ClearUntitledTodosCommand`**로 마이그레이션했습니다.
*   🎨 **UI/UX:** 커맨드 실행, 토스트 알림, 그리고 히스토리 추적을 자동으로 처리해주는 재사용 가능한 **`ActionButton.tsx`** 컴포넌트를 도입했습니다.
*   🔧 **System:** 새로운 **`useCommandStore`**를 전역 `Ctrl+Z` 및 `Ctrl+Y` 단축키에 완벽하게 통합했습니다. 확장성 잠금 해제! 🚀
