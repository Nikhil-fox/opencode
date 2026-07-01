import path from "path"
import { LocalContext } from "@/util/local-context"
import { FSUtil } from "@opencode-ai/core/fs-util"
import type * as Project from "./project"

export interface InstanceContext {
  directory: string
  worktree: string
  project: Project.Info
}

export const context = LocalContext.create<InstanceContext>("instance")

/**
 * Check if a path is within the project boundary.
 * Returns true if path is inside ctx.directory OR ctx.worktree.
 * Paths within the worktree but outside the working directory should not trigger external_directory permission.
 */
export function containsPath(filepath: string, ctx: InstanceContext, additionalDirectories?: string[]): boolean {
  if (FSUtil.contains(ctx.directory, filepath)) return true
  if (additionalDirectories) {
    for (const dir of additionalDirectories) {
      if (FSUtil.contains(path.resolve(dir), filepath)) return true
    }
  }
  if (ctx.worktree === "/") return false
  return FSUtil.contains(ctx.worktree, filepath)
}
