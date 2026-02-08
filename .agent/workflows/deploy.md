---
description: Deploy with the command
---

# AGENT BEHAVIOR PROTOCOL: /deploy
# Trigger: When user inputs "/deploy"

## 1. ROLE & OBJECTIVE
You are a Senior DevOps Specialist responsible for the automated deployment of the "artisans-compass" project. When the user triggers the `/deploy` command, you MUST execute the specific workflow defined below without asking for unnecessary confirmations.

## 2. CONTEXT & PATHS
- **Project Root**: D:\artisans-compass
- **Update Logs Root**: D:\artisans-compass\public\updates
- **Package File**: ./package.json
- **Deploy Command**: `npm run deploy`

## 3. EXECUTION WORKFLOW (Strict Order)

### STEP 1: Analyze Version
- Read `package.json` from the root directory.
- Extract the current `version` string (e.g., "1.1.0").
- The Last number's maximum value is 99 if the value is over it it should like 0.1.0 

### STEP 2: Gather Update Logs (Multilingual)
- Analyze recent file changes or git diffs to summarize the update.
- Generate content in three languages: **Korean (ko)**, **Japanese (ja)**, **English (en)**.
- If analysis is impossible, prompt the user: "업데이트 제목과 내용을 입력해 주세요."

### STEP 3: Create Multilingual Markdown Files
- **Action**: Create (or overwrite) individual `.md` files for each language.
- **Encoding**: UTF-8
- **File Paths & Content Structure**:

  1. **[KO]** `D:\artisans-compass\public\updates\ko\{version}.md`
     ```markdown
     # 업데이트 알림 (v{version})
     - **날짜**: {YYYY-MM-DD}
     - **내용**: {Korean_Description}
     ```
  2. **[JA]** `D:\artisans-compass\public\updates\ja\{version}.md`
     ```markdown
     # アップデートのお知らせ (v{version})
     - **日付**: {YYYY-MM-DD}
     - **内容**: {Japanese_Description}
     ```
  3. **[EN]** `D:\artisans-compass\public\updates\en\{version}.md`
     ```markdown
     # Update Notice (v{version})
     - **Date**: {YYYY-MM-DD}
     - **Description**: {English_Description}
     ```

### STEP 4: Execute Shell Command
- **Condition**: Proceed ONLY after all 3 Markdown files are successfully created.
- **Command**: `npm run deploy`
- **Action**: Execute in the terminal immediately and stream output.

## 4. FINAL REPORTING
- If successful: "✅ Deployment Completed. (Files created in /public/updates/)"
- If failed: "❌ Deployment Failed. Check terminal output for details."