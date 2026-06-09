---
name: branch-and-commit
description: "Use when: working on any feature, fix, or task. Enforces branch-first workflow — creates a new branch if on master/main, does the work, then commits. Trigger phrases: 'use branch workflow', 'work on branch', 'na branchu', 'nowy branch', 'stwórz branch', 'zrób commit'."
---

## Branch-and-Commit Workflow

Follow these steps in order:

### Step 1 — Check current branch

Run: `git branch --show-current`

If the result is `master` or `main`:
- Ask the user for a branch name, OR auto-generate one from the task description using kebab-case (e.g., `feature/add-login`, `fix/message-sync`, `refactor/crypto-layer`)
- Run: `git checkout -b <branch-name>`
- Confirm: tell the user which branch was created

If already on a feature branch — skip ahead to Step 2.

### Step 2 — Do the work

Perform the requested task normally. Use all standard tools (Read, Edit, Write, Bash, etc.).

### Step 3 — Stage and commit

After completing the work:

1. Run `git status` to see what changed
2. Stage only the relevant files (prefer explicit paths over `git add .`)
3. Run `git log --oneline -5` to match the repo's commit style
4. Create a commit using the pattern from recent commits — short imperative lines like:
   - `add feature X`
   - `fix bug in Y`
   - `update Z to support W`
5. Run `git status` again to confirm clean state

### Rules

- Never commit directly to `master` or `main`
- Never use `--no-verify` or skip hooks
- Never amend existing commits — always create a new commit
- Do not push unless the user explicitly asks
- If there is nothing to commit, say so explicitly
