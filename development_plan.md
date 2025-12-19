# 🧭 Artisan's Compass: 개발 로드맵 (Development Roadmap)

`context1.txt`와 `context2.txt`에 정의된 **최종 설계 문서**를 바탕으로 한 단계별 개발 계획입니다.  
프로젝트는 **Electron + React (TypeScript)** 환경을 기준으로 작성되었습니다.

---

## **Phase 1: 프로젝트 기초 공사 (Foundation)**
**목표:** 개발 환경 세팅 및 데이터 처리의 기반 마련

### 1-1. 환경 설정 (Setup)
- [ ] **Electron + Vite + React (TS) 초기화**: 프로젝트 스캐폴딩 생성.
- [ ] **CSS Framework**: TailwindCSS 설정 (빠른 UI 구현).
- [ ] **상태 관리**: Zustand 또는 Redux Toolkit 설정 (전역 상태 관리).
- [ ] **경로 별칭 (Path Aliases)**: `@/components`, `@/utils` 등 깔끔한 import 경로 설정.

### 1-2. 데이터 매니저 (Data Layer)
- [ ] **JSON 핸들러 구현**: `fs` 모듈을 이용한 로컬 파일 읽기/쓰기 유틸리티.
    - `settings.json`, `projects.json`, `daily_log_YYYY_MM.json` 스키마 정의 (TypeScript Interface).
- [ ] **초기 데이터 생성 로직**: 앱 최초 실행 시 기본 파일/폴더 구조 생성 기능.
- [ ] **IPC 통신 구조 설계**: Main(Node.js) <-> Renderer(React) 간 데이터 교환 채널 정의.

---

## **Phase 2: 핵심 백엔드 로직 (Core Systems - Electron Main)**
**목표:** UI 없이도 작동하는 '기록 및 측정' 엔진 완성

### 2-1. 타임 트래킹 엔진 (Time Tracker)
- [ ] **윈도우 포커스 감지**: 현재 활성화된 창의 프로세스 이름(.exe) 감지 모듈.
- [ ] **사용자 입력 감지 (Idle Detector)**: 마우스/키보드 후킹(또는 OS API)으로 유휴 상태 판별 (기본 10초).
- [ ] **트래킹 타이머**: '타겟 프로세스 활성' AND '입력 있음' 조건 만족 시 시간 누적 로직.
- [ ] **Midnight Logic**: 자정을 넘겨 작업 시 시작 시간 기준으로 날짜를 귀속시키는 로직 구현.

### 2-2. 스마트 캡처 시스템 (Smart Capture)
- [ ] **윈도우 캡처**: 전체 화면이 아닌 특정 타겟 프로세스 윈도우만 캡처하는 기능.
- [ ] **이미지 리사이징/압축**: 저장 용량 최적화를 위한 JPG 변환 및 리사이징.
- [ ] **파일 저장**: `YYYY-MM-DD/HH-mm-ss.jpg` 형태의 폴더링/네이밍 규칙 구현.

---

## **Phase 3: 메인 UI 구현 (Dashboard Frontend)**
**목표:** 사용자가 상호작용할 수 있는 시각적 인터페이스 구축

### 3-1. 레이아웃 구조 (App Shell)
- [ ] **3-Column Layout**: Calendar(좌) | Daily Panel(우) | Timeline(상단) 배치.
- [ ] **Theme System**: 다크 모드/라이트 모드 대응 (기본 다크 권장).

### 3-2. 프로젝트 타임라인 (Gantt Chart)
- [ ] **타임라인 렌더링**: `projects.json` 데이터를 기반으로 가로 바(Bar) 시각화.
- [ ] **테트리스 배치 알고리즘**: 기간이 겹치면 아래 줄로 내려가는 자동 정렬 로직.
- [ ] **인터랙션**: 
    - [ ] 드래그 앤 드롭 (날짜 이동).
    - [ ] 양끝 핸들 드래그 (기간 수정 - Resize).
    - [ ] 클릭 시 상세/수정 팝업.

### 3-3. 네비게이터 & 데일리 패널
- [ ] **Calendar**: 월간 달력 구현, 날짜별 상태(작업일, 휴식일) 색상 표시.
- [ ] **Daily Panel**:
    - [ ] **Idle State**: 명언 및 배지 표시.
    - [ ] **Active State**: 날짜 클릭 시 To-Do List 슬라이드 애니메이션.
    - [ ] **Hover Graph**: 패널 가장자리 호버 시 시간 그래프 오버레이.

---

## **Phase 4: 기능 통합 및 데이터 연동 (Integration)**
**목표:** 백엔드 로직과 프론트엔드 UI의 유기적 결합

### 4-1. 실시간 데이터 동기화
- [ ] **IPC Event Streaming**: 트래킹 엔진의 상태(녹화 중, 유휴 상태 등)를 React UI에 실시간 반영.
- [ ] **그래프 시각화**: 수집된 로그 데이터를 기반으로 Time Table 그래프 그리기 (Recharts 등 활용).

### 4-2. 마감 리추얼 (Closing Ritual) - 핵심 UX
- [ ] **End 버튼 플로우**: 
    - [ ] '종료' 클릭 시 배경 블러 처리.
    - [ ] **회고 모달**: 타임랩스 플레이어 (이미지 슬라이더) + 완료된 To-Do 확인.
    - [ ] **계획 모달**: 미완료 To-Do 이월(Carry-over) + 내일 할 일 작성.
    - [ ] **앱 종료 트리거**: 모든 과정 완료 시 Electron 앱 종료 (`app.quit()`).

### 4-3. 아카이브 뷰 (Archive)
- [ ] **과거 데이터 조회**: 캘린더 날짜 클릭 시 해당 날짜의 `json` 로드 및 오버레이 뷰 표시.
- [ ] **타임랩스 갤러리**: 해당 날짜의 스크린샷들을 연결하여 재생하는 플레이어 UI.

---

## **Phase 5: 보강 및 포장 (Polish & Distribution)**
**목표:** 상용 소프트웨어 수준의 완성도 확보

### 5-1. 온보딩 (Onboarding)
- [ ] **최초 실행 마법사**: 
    - [ ] 자주 쓰는 툴(`.exe`) 선택 파일 탐색기 연동.
    - [ ] 첫 프로젝트 생성 가이드.

### 5-2. 안전장치 (Safety)
- [ ] **자동 백업 시스템**: 설정된 경로로 파일 복사 로직 (종료 시 또는 주기적).
- [ ] **예외 처리**: 파일 깨짐 방지, 경로 없음 에러 핸들링.
- [ ] **창 위치 초기화**: 트레이 아이콘 메뉴 구현.

### 5-3. 최적화 및 빌드 (Optimize)
- [ ] **렌더링 최적화**: 많은 로그 데이터 표현 시 `React.memo`, `Virtualization` 적용.
- [ ] **패키징**: `electron-builder` 설정 (아이콘 적용, 설치 파일 생성).

---

## **Estimated Timeline (Rough)**
* **Phase 1:** 2~3 Days
* **Phase 2:** 4~5 Days (핵심 로직 검증 포함)
* **Phase 3:** 5~7 Days (UI 디테일 작업)
* **Phase 4:** 4~5 Days
* **Phase 5:** 3 Days
* **Total:** 약 3~4주 (개인 개발 기준)
