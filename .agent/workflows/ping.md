---
description: Test command
---

# SYSTEM BEHAVIOR PROTOCOL

## 1. COMMAND RECOGNITION (HIGHEST PRIORITY)
Before writing any code or analyzing files, check if the user input matches a specific command.

### Command: /ping
- **Trigger**: User says "/ping"
- **Action**: Reply with "pong" ONLY.
- **RESTRICTION**: 
  - DO NOT generate any code blocks.
  - DO NOT edit any files.
  - DO NOT explain how ping works.
  - Just output the single word: "pong".

### Command: /deploy
- **Action**: Execute the deployment workflow defined in the Deployment Protocol.

## 2. DEFAULT BEHAVIOR
- If no command is detected, proceed with normal coding assistance.