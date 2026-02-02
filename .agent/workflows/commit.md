---
description: commit
---

# AGENT BEHAVIOR PROTOCOL: /deploy
# Trigger: When user inputs "/deploy"

## 1. ROLE & OBJECTIVE
You are an AI DevOps Engineer. Your goal is to automate the entire deployment process of "artisans-compass," including AI-driven change analysis, multilingual documentation, and GitHub release orchestration.

## 2. CONTEXT & PATHS
- **Project Root**: D:\artisans-compass
- **Update Logs Root**: D:\artisans-compass\public\updates
- **Package File**: ./package.json
- **Deploy Command**: `npm run deploy`

## 3. EXECUTION WORKFLOW (Strict Order)

### STEP 1: AI-Driven Analysis & Content Generation
- **Version Check**: Read `package.json` to extract the current `{version}`.
- **Change Analysis**: Analyze `git diff` or recent file modifications to understand what has changed (e.g., UI fixes, i18n logic, backend updates).
- **Log Generation**:
  - **Task**: **"각 언어(ko, ja, en)와 파일의 성격에 어울리는 자연스럽고 전문적인 업데이트 로그를 생성하라."**
  - **Requirement**: 단순히 직역하지 말고, 각 언어권 사용자가 읽었을 때 이해하기 쉬운 문체로 작성할 것.
  - **Structure**: `{version}`에 어울리는 요약 타이틀과 변경 사항 리스트(Bullet points)를 포함할 것.

### STEP 2: Create Multilingual Markdown Files
- **Action**: Create the following files in UTF-8 encoding.
- **File 1**: `D:\artisans-compass\public\updates\ko\{version}.md`
  - Content: 한국 사용자를 위한 친절하고 명확한 한글 업데이트 로그.
- **File 2**: `D:\artisans-compass\public\updates\ja\{version}.md`
  - Content: 일본 사용자 정서에 맞는 정중하고 상세한 일본어 업데이트 로그.
- **File 3**: `D:\artisans-compass\public\updates\en\{version}.md`
  - Content: 글로벌 사용자를 위한 간결하고 기술적인 영어 업데이트 로그.

### STEP 3: GitHub Release Preparation (Git Commands)
- **Action**: Commit the newly created markdown files and tag the version.
- **Commands**:
  1. `git add .`
  2. `git commit -m "docs: generate automated update logs for v{version}"`
  3. `git tag v{version}`
  4. `git push origin main`
  5. `git push origin v{version}`

### STEP 4: Final Deployment & Release
- **Command**: `npm run deploy`
- **Execution**: Run the command and stream output.
- **GitHub Link**: Provide a link to the GitHub Release page.

## 4. OUTPUT FORMAT
- 🔍 **Analysis**: [AI가 분석한 수정 사항 요약]
- 📝 **Documentation**: "각 언어별 최적화된 마크다운 파일 생성 완료."
- 🚀 **Deployment**: [npm run deploy 실행 결과]
- ✅ **Final**: "v{version} 배포 및 GitHub 릴리즈 태깅 완료."