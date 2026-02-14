---
trigger: user_message
glob: 
description: Automated deployment workflow rules
---

# AGENT BEHAVIOR PROTOCOL: /deploy
# Trigger: When user inputs "/deploy" or asks to deploy

## 1. ROLE & OBJECTIVE
You are a Senior DevOps Specialist responsible for the automated deployment of the "artisans-compass" project. When the user triggers the `/deploy` command, you MUST execute the specific workflow defined below without asking for unnecessary confirmations.

## 2. PRE-DEPLOYMENT CHECKS
- **Process**: Ensure `npm run dev` or other processes are not locking files if necessary (usually safe to run deploy alongside dev).
- **Version Increment**:
  - Read `package.json` to get current version (e.g., `0.2.6`).
  - Increment version (e.g., `0.2.6` -> `0.2.7`).
  - **Constraint**: The patch version (last number) max is 99 (e.g., `0.0.99` -> `0.1.0`).

## 3. FILE UPDATE WORKFLOW (Strict Order)

### STEP 1: Update Configuration Files
1. **`package.json`**: Update `version` field.
2. **`public/updates/index.json`**:
   - Add new entry to the *top* of the array.
   - **Format**:
     ```json
     {
       "version": "{new_version}",
       "date": "{YYYY-MM-DD}",
       "title": "Version {new_version}",
       "file": "v{new_version}.md" 
     }
     ```
     *Note: The `file` field usually refers to the root fallback file, which typically has a 'v' prefix.*

### STEP 2: Create Release Notes
You must create **4** markdown files in total.

#### A. Localized Files (NO 'v' PREFIX)
Path: `public/updates/{lang}/{version}.md` 
**CRITICAL**: The filename must be **EXACTLY** `{version}.md` (e.g., `0.2.7.md`). Do **NOT** add 'v' prefix here.

1. **Korean ([KO])**: `public/updates/ko/{version}.md`
   ```markdown
   # 업데이트 알림 (v{version})
   - **날짜**: {YYYY-MM-DD}
   - **내용**: {Korean_Description}
   ```
2. **Japanese ([JA])**: `public/updates/ja/{version}.md`
   ```markdown
   # アップデートのお知らせ (v{version})
   - **日付**: {YYYY-MM-DD}
   - **内容**: {Japanese_Description}
   ```
3. **English ([EN])**: `public/updates/en/{version}.md`
   ```markdown
   # Update Notice (v{version})
   - **Date**: {YYYY-MM-DD}
   - **Description**: {English_Description}
   ```

#### B. Root Fallback File (WITH 'v' PREFIX)
Path: `public/updates/v{version}.md`
**CRITICAL**: The filename must comprise 'v' + `{version}.md` (e.g., `v0.2.7.md`) to match `index.json`.

1. **Root ([Default])**: `public/updates/v{version}.md`
   - Content should be the **English** version.
   ```markdown
   # Update Notice (v{version})
   - **Date**: {YYYY-MM-DD}
   - **Description**: {English_Description}
   ```

### STEP 3: Execute Deployment
- **Command**: `npm run deploy`
- **Output**: Stream the output to the user.
- **Verification**: Ensure exit code is 0.

## 4. FINAL REPORTING
- If successful: "✅ Deployment Completed. (Files created in /public/updates/)"
- If failed: "❌ Deployment Failed. Check terminal output for details."
