📅 **Date:** 2026-03-08T16:45:00+09:00

### ♻️ Refactor: 코어 커맨드 페이로드 타입 평탄화 구조 개편

- **대상 파일:**
  - **`src/plugins/api/payloads.ts`**
  - **`src/core/commands/editor-commands.ts`**
  - **`src/core/commands/plan-commands.ts`**
  - **`src/core/commands/routine-commands.ts`**

- **작업 내용 (Refactoring Details):**
  - **`CommandPayload.Todo.Add`** 와 같이 계층화된 `namespace` 구문을 모두 제거하고 최신 TypeScript 방식인 **`TodoAddPayload`**, **`PlanSavePayload`** 등의 직관적인 **Flat Interface** 형태로 개편했습니다.
  - 플러그인 개발자들이 타입 구조를 훨씬 쉽게 발견하고 재사용할 수 있도록 `payloads.ts` API를 깔끔하게 다듬었습니다.
  - 새롭게 변경된 타입을 사용하도록 기존의 모든 **Core Command 파일들**(`editor-commands`, `plan-commands`, `routine-commands`)을 업데이트했습니다.
  
- **🧹 Cleanup:**
  - **`routine-commands.ts`** 내 사용하지 않는 **`PlannedSession`** 임포트 구문을 정리하여 타입스크립트(TSC) 무결성 검증 시 단 하나의 에러도 없도록 클린업을 마쳤습니다.
