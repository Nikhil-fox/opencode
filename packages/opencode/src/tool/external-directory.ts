import path from "path"
import { Effect } from "effect"
import * as EffectLogger from "@opencode-ai/core/effect/logger"
import { InstanceState } from "@/effect/instance-state"
import type * as Tool from "./tool"
import { containsPath } from "../project/instance-context"
import { AppFileSystem } from "@opencode-ai/core/filesystem"

type Kind = "file" | "directory"

type Options = {
  bypass?: boolean
  kind?: Kind
}

export const assertExternalDirectoryEffect = Effect.fn("Tool.assertExternalDirectory")(function* (
  ctx: Tool.Context,
  target?: string,
  options?: Options,
  additionalDirectories?: string[],
) {
  if (!target) return

  if (options?.bypass) return

  const ins = yield* InstanceState.context
  const resolved = path.resolve(target)
  const full = process.platform === "win32" ? AppFileSystem.normalizePath(resolved) : resolved
  if (containsPath(full, ins, additionalDirectories)) return

  const normalizedAdditionalDirs = additionalDirectories?.map((dir) =>
    process.platform === "win32" ? AppFileSystem.normalizePath(path.resolve(dir)) : path.resolve(dir),
  )

  if (normalizedAdditionalDirs) {
    for (const dir of normalizedAdditionalDirs) {
      if (AppFileSystem.contains(dir, full)) return
    }
  }

  const kind = options?.kind ?? "file"
  const dir = kind === "directory" ? full : path.dirname(full)
  const glob =
    process.platform === "win32"
      ? AppFileSystem.normalizePathPattern(path.join(dir, "*"))
      : path.join(dir, "*").replaceAll("\\", "/")

  yield* ctx.ask({
    permission: "external_directory",
    patterns: [glob],
    always: [glob],
    metadata: {
      filepath: full,
      parentDir: dir,
    },
  })
})

export async function assertExternalDirectory(
  ctx: Tool.Context,
  target?: string,
  options?: Options,
  additionalDirectories?: string[],
) {
  return Effect.runPromise(
    assertExternalDirectoryEffect(ctx, target, options, additionalDirectories).pipe(Effect.provide(EffectLogger.layer)),
  )
}
