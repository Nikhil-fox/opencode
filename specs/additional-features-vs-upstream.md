# Additional Features — vs `upstream/dev`

Generated: 2026-06-11

18 commits unique to `origin/opencode/additional-features` that are **not** in `upstream/dev`.

---

## Overview

| Area | Files Changed | Insertions |
|------|------|------|
| Additional Directories | ~18 files | ~1,151 |
| Architect Agent | 2 files | 138 |
| Auto-Accept | 2 files | 49 |
| Permission Rejection UX | 2 files | 48 |
| Tokens-Per-Second Display | 5 files | 28 |
| Upstream Fixes | 3 files | 51 |

**Total:** ~41 files changed, ~1,481 insertions, ~46 deletions

---

## 1. Additional Directories Support

**Commits:**
- `c0aeb7ac9` — feat: add session-scoped additional directories support
- `2db78f5b8` — feat: include additional directories in file search results
- `e5c4fefd0` — Fix path handling for additional directories in file search
- `0ff435324` — Fix additional directories permission bypass across all tools
- `e74f6717a` — Add `/remove-dir` command, directory management dialog, and session directory API routes

**Files changed:**

| File | Change |
|------|--------|
| `src/tool/ls.ts` | **New** — directory listing tool (128 lines) |
| `src/tool/external-directory.ts` | Permission checks for additional dirs |
| `src/tool/glob.ts` | Scoped to additional dirs |
| `src/tool/grep.ts` | Scoped to additional dirs |
| `src/tool/read.ts` | Scoped to additional dirs |
| `src/tool/write.ts` | Scoped to additional dirs |
| `src/tool/edit.ts` | Scoped to additional dirs |
| `src/tool/apply_patch.ts` | Scoped to additional dirs |
| `src/tool/shell.ts` | Scoped to additional dirs |
| `src/tool/lsp.ts` | Scoped to additional dirs |
| `src/file/index.ts` | File search includes additional dirs |
| `src/command/index.ts` | `/add-dir`, `/remove-dir` commands |
| `src/command/template/add-dir.txt` | **New** — command template |
| `src/command/template/remove-dir.txt` | **New** — command template |
| `src/cli/cmd/tui/component/dialog-directory-list.tsx` | **New** — directory management dialog (90 lines) |
| `src/cli/cmd/tui/component/dialog-workspace-list.tsx` | **New** — workspace list dialog (188 lines) |
| `src/server/routes/instance/httpapi/groups/session.ts` | Session directory API routes |
| `src/server/routes/instance/httpapi/handlers/session.ts` | Session directory API handlers |
| `src/server/routes/instance/httpapi/groups/file.ts` | Additional directory route |
| `src/server/routes/instance/httpapi/handlers/file.ts` | Additional directory handler |

---

## 2. Architect Agent

**Commits:**
- `aaaa4e39a` — Add auto-accept and architect agent features
- `df6746e1f` — refactor: remove architect mode runtime machinery

**Files changed:**

| File | Change |
|------|--------|
| `src/agent/prompt/architect.txt` | **New** — Architect agent system prompt (120 lines) |
| `src/agent/agent.ts` | Registered architect agent type (+18 lines) |

---

## 3. Auto-Accept

**Commits:**
- `aaaa4e39a` — Add auto-accept and architect agent features

**Files changed:**

| File | Change |
|------|--------|
| `src/cli/cmd/tui/context/auto-accept.tsx` | **New** — auto-accept context (14 lines) |
| `src/cli/cmd/tui/app.tsx` | Auto-accept wiring |

---

## 4. Permission Rejection UX

**Commits:**
- `0cdefd211` — Allow feedback on tool rejection for all sessions and continue loop after deny
- `66cebb35f` — Improve permission rejection UX: tab to provide feedback, direct SDK reject on escape
- `f4e23c406` — Fix continue_loop_on_deny default: loop continues unless explicitly set to false

**Files changed:**

| File | Change |
|------|--------|
| `src/cli/cmd/tui/routes/session/permission.tsx` | Tab-to-feedback, escape-to-reject UX |
| `src/session/prompt.ts` | `continue_loop_on_deny` defaults to `true` |
| `src/cli/cmd/tui/routes/session/index.tsx` | Permission UX integration |

---

## 5. Tokens-Per-Second Display

**Commits:**
- `bee0812de` — Add tokens-per-second display in prompt bar, sidebar, and subagent footer

**Files changed:**

| File | Change |
|------|--------|
| `src/cli/cmd/tui/util/provider-origin.ts` | t/s metadata |
| `src/cli/cmd/tui/routes/session/footer.tsx` | t/s display in session footer |
| `src/cli/cmd/tui/routes/session/subagent-footer.tsx` | t/s display in subagent footer |
| `src/cli/cmd/tui/feature-plugins/sidebar/context.tsx` | t/s display in sidebar |
| `src/cli/cmd/tui/component/prompt/index.tsx` | t/s display in prompt bar |

---

## 6. Upstream Fixes

**Commits:**
- `fdd8cff99` — fix: protect bash tool outputs from silent pruning
- `b00d09869` — fix: resolve type errors after merging origin/dev into temp-merge-dev
- `ac9609e45` — fix(tui): restore app_exit binding with enabled guard for ctrl+c exit

---

## Merge Commits

These kept the branch in sync with upstream during development:

- `9205c5bdb` — Merge origin/dev into temp-merge-dev with custom features preserved
- `ba85599d8` — Merge origin/dev v1.4.0 while preserving custom console features
- `aead4c7d5` — Merge branch 'origin/dev' into temp-merge-test
- `c04b5f106` — Merge additional-features into latest dev (the final merge into current branch)
