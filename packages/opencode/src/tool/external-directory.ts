import path from "path"
import { Effect } from "effect"
import type { Tool } from "./tool"
import { Instance } from "../project/instance"
import { AppFileSystem } from "../filesystem"

type Kind = "file" | "directory"

type Options = {
  bypass?: boolean
  kind?: Kind
}

export async function assertExternalDirectory(
  ctx: Tool.Context,
  target?: string,
  options?: Options,
  additionalDirectories?: string[],
) {
  if (!target) return

  if (options?.bypass) return

  // Resolve to absolute path and normalize for comparison
  const resolved = path.resolve(target)
  const full = process.platform === "win32" ? AppFileSystem.normalizePath(resolved) : resolved
  
  // Normalize additional directories for comparison
  const normalizedAdditionalDirs = additionalDirectories?.map(dir => 
    process.platform === "win32" ? AppFileSystem.normalizePath(path.resolve(dir)) : path.resolve(dir)
  )
  
  if (Instance.containsPath(full, normalizedAdditionalDirs)) return

  const kind = options?.kind ?? "file"
  const dir = kind === "directory" ? full : path.dirname(full)
  const glob =
    process.platform === "win32"
      ? AppFileSystem.normalizePathPattern(path.join(dir, "*"))
      : path.join(dir, "*").replaceAll("\\", "/")

  await ctx.ask({
    permission: "external_directory",
    patterns: [glob],
    always: [glob],
    metadata: {
      filepath: full,
      parentDir: dir,
    },
  })
}

export const assertExternalDirectoryEffect = Effect.fn("Tool.assertExternalDirectory")(function* (
  ctx: Tool.Context,
  target?: string,
  options?: Options,
  additionalDirectories?: string[],
) {
  yield* Effect.promise(() => assertExternalDirectory(ctx, target, options, additionalDirectories))
})
