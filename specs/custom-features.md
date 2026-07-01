# Custom Features (opencode/additional-features branch)

This branch carries custom features on top of upstream `anomalyco/opencode` dev.
Use this as a reference when merging upstream changes.

---

## 1. Additional Directories (add-dir / remove-dir)

Session-scoped additional directory support. Users can add/remove directories
to a session, file search includes them, and all tools respect permissions
across added directories.

### Core (packages/opencode)
- `src/session/prompt.ts` — addDir / removeDir path resolution (relative paths + `~` expansion against context directory)
- `src/session/index.ts` — session directory storage and retrieval
- `src/session/session.sql.ts` — schema for session directories
- `src/session/system.ts` — system prompt mentions added directories
- `src/command/index.ts` — add-dir / remove-dir command definitions
- `src/command/template/add-dir.txt` — add-dir command prompt
- `src/command/template/remove-dir.txt` — remove-dir command prompt
- `src/project/instance.ts` — directory management on project instance
- `src/file/index.ts` — file search includes additional directories
- `src/server/routes/file.ts` — file routes for additional directories
- `src/server/routes/session.ts` — session directory API routes (add/remove/list)

### Tools (packages/opencode/src/tool)
Permission bypass for additional directories across all tools:
- `bash.ts`, `edit.ts`, `external-directory.ts`, `glob.ts`, `grep.ts`
- `read.ts`, `write.ts`, `apply_patch.ts`, `ls.ts`, `lsp.ts`

### TUI (packages/tui)
- `src/app.tsx` — directory.add command, app_exit binding
- `src/component/dialog-directory-list.tsx` — directory management dialog
- `src/component/prompt/autocomplete.tsx` — autocomplete for directory paths

### SDK (packages/sdk/js)
- `src/v2/gen/sdk.gen.ts` — generated SDK methods for directory commands
- `src/v2/gen/types.gen.ts` — generated types

---

## 2. Auto-Accept

Automatically accept tool permissions when enabled.

### Core (packages/opencode)
- `src/config/config.ts` — auto_accept config option
- `src/session/index.ts` — session-level auto-accept state

### TUI (packages/tui)
- `src/context/auto-accept.tsx` — auto-accept context provider
- `src/app.tsx` — auto-accept UI binding
- `src/routes/session/index.tsx` — session view integration
- `src/routes/session/footer.tsx` — footer indicator

---

## 3. Permission Rejection UX

Tab to provide feedback on tool rejection, direct SDK reject on escape,
and continue loop after deny for all sessions.

### Core (packages/opencode)
- `src/session/processor.ts` — continue_loop_on_deny default (loop continues unless explicitly false)

### TUI (packages/tui)
- `src/routes/session/permission.tsx` — tab-to-feedback UI, escape-to-reject

---

## 4. Tokens-per-Second + Cache Token Display

Show t/s and cache read/write (down/up arrows) in usage bars.

### TUI (packages/tui)
- `src/component/prompt/index.tsx` — t/s + cache display in prompt usage bar
- `src/routes/session/subagent-footer.tsx` — t/s + cache display in subagent footer
- `src/feature-plugins/sidebar/context.tsx` — t/s display in sidebar

---

## 5. Architect Agent Prompt

Architect agent system prompt. Runtime machinery was removed (df6746e1f);
only the prompt file remains. The agent is registered in agent.ts.

### Core (packages/opencode)
- `src/agent/prompt/architect.txt` — architect agent system prompt
- `src/agent/agent.ts` — architect agent registration

---

## 6. App Exit Binding (Ctrl+C)

Guarded ctrl+c exit binding for the TUI.

### TUI (packages/tui)
- `src/app.tsx` — app_exit keybind with enabled guard

---

## Path Migration Notes

Upstream dev moved TUI code from `packages/opencode/src/cli/cmd/tui/` to
`packages/tui/src/`. When applying feature changes, map old paths to new:

| Old path (feature commits)                              | New path (upstream)                          |
|---------------------------------------------------------|----------------------------------------------|
| `packages/opencode/src/cli/cmd/tui/app.tsx`             | `packages/tui/src/app.tsx`                   |
| `packages/opencode/src/cli/cmd/tui/component/prompt/`   | `packages/tui/src/component/prompt/`          |
| `packages/opencode/src/cli/cmd/tui/component/dialog-*`  | `packages/tui/src/component/dialog-*`        |
| `packages/opencode/src/cli/cmd/tui/context/auto-accept` | `packages/tui/src/context/auto-accept.tsx`   |
| `packages/opencode/src/cli/cmd/tui/routes/session/`     | `packages/tui/src/routes/session/`           |
| `packages/opencode/src/cli/cmd/tui/feature-plugins/`    | `packages/tui/src/feature-plugins/`          |
| `packages/opencode/src/cli/cmd/tui/util/provider-origin`| `packages/tui/src/util/provider-origin.ts`  |

## Feature Commits (non-merge)

- `aaaa4e39a` Add auto-accept and architect agent features
- `c0aeb7ac9` feat: add session-scoped additional directories support
- `2db78f5b8` feat: include additional directories in file search results
- `e5c4fefd0` Fix path handling for additional directories in file search
- `0ff435324` Fix additional directories permission bypass across all tools
- `bee0812de` Add tokens-per-second (t/s) display in prompt bar, sidebar, and subagent footer
- `66cebb35f` Improve permission rejection UX: tab to provide feedback, direct SDK reject on escape
- `0cdefd211` Allow feedback on tool rejection for all sessions and continue loop after deny
- `f4e23c406` Fix continue_loop_on_deny default: loop continues unless explicitly set to false
- `e74f6717a` Add /remove-dir command, directory management dialog, and session directory API routes
- `df6746e1f` refactor: remove architect mode runtime machinery
- `ac9609e45` fix(tui): restore app_exit binding with enabled guard for ctrl+c exit
- `0ae0e1eeb` feat: improve directory path resolution, add cache token display, and update architect prompt
