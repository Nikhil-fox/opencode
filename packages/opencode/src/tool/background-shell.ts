import * as Tool from "./tool"
import DESCRIPTION from "./background-shell.txt"
import { BackgroundJob } from "@/background/job"
import { Config } from "@/config/config"
import { Session } from "@/session/session"
import { MessageV2 } from "../session/message-v2"
import type { TaskPromptOps } from "./task"
import { Shell } from "@opencode-ai/core/shell"
import { InstanceState } from "@/effect/instance-state"
import { Database } from "@opencode-ai/core/database/database"
import { Identifier } from "@/id/id"
import { Effect, Schema, Scope, Stream } from "effect"
import { ChildProcess } from "effect/unstable/process"
import { ChildProcessSpawner } from "effect/unstable/process/ChildProcessSpawner"
import { ShellID } from "./shell/id"
import { TRUNCATION_DIR } from "./truncation-dir"
import { FSUtil } from "@opencode-ai/core/fs-util"
import { createWriteStream } from "node:fs"
import path from "path"

const id = "background_shell"
const DEFAULT_TIMEOUT = 10 * 60 * 1000

export const Parameters = Schema.Struct({
  action: Schema.Literals(["start", "status", "cancel", "list"]).annotate({
    description:
      "Action to perform: start (run a command in background), status (check a job), cancel (stop a job), list (show all jobs)",
  }),
  command: Schema.optional(Schema.String).annotate({
    description: "The shell command to run in the background (required for 'start')",
  }),
  description: Schema.optional(Schema.String).annotate({
    description: "A short description of the command (for 'start')",
  }),
  workdir: Schema.optional(Schema.String).annotate({
    description: "Working directory for the command (for 'start')",
  }),
  timeout: Schema.optional(Schema.Number).annotate({
    description: `Timeout in milliseconds (default: ${DEFAULT_TIMEOUT})`,
  }),
  job_id: Schema.optional(Schema.String).annotate({
    description: "The job ID (required for 'status' and 'cancel')",
  }),
})

function cmd(shell: string, command: string, cwd: string, env: NodeJS.ProcessEnv) {
  if (process.platform === "win32" && Shell.ps(shell)) {
    return ChildProcess.make(shell, ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", command], {
      cwd,
      env,
      stdin: "ignore",
      detached: false,
    })
  }
  return ChildProcess.make(command, [], {
    shell,
    cwd,
    env,
    stdin: "ignore",
    detached: process.platform !== "win32",
  })
}

function renderResult(input: {
  jobId: string
  state: "completed" | "error" | "cancelled"
  command: string
  output?: string
  error?: string
}) {
  const lines = [
    `<background_shell job_id="${input.jobId}" state="${input.state}">`,
    `<command>${input.command}</command>`,
  ]
  if (input.error) lines.push(`<error>${input.error}</error>`)
  if (input.output) lines.push("<output>", input.output, "</output>")
  lines.push("</background_shell>")
  return lines.join("\n")
}

export const BackgroundShellTool = Tool.define(
  id,
  Effect.gen(function* () {
    const background = yield* BackgroundJob.Service
    const config = yield* Config.Service
    const sessions = yield* Session.Service
    const scope = yield* Scope.Scope
    const database = yield* Database.Service
    const spawner = yield* ChildProcessSpawner
    const fs = yield* FSUtil.Service

    const execute = Effect.fn("BackgroundShell.execute")(function* (
      params: Schema.Schema.Type<typeof Parameters>,
      ctx: Tool.Context,
    ) {
      if (params.action !== "start") {
        if (params.action === "list") {
          const jobs = yield* background.list()
          if (!jobs.length) {
            return {
              title: "Background jobs",
              metadata: { action: "list", count: 0 },
              output: "No background jobs.",
            }
          }
          const lines = jobs.map((job, i) => {
            const parts = [`${i + 1}. ${job.id} - ${job.status}`]
            if (job.title) parts.push(`   "${job.title}"`)
            return parts.join(" ")
          })
          return {
            title: "Background jobs",
            metadata: { action: "list", count: jobs.length },
            output: ["Background jobs:", ...lines].join("\n"),
          }
        }

        if (!params.job_id) return yield* Effect.fail(new Error(`job_id is required for '${params.action}' action`))

        if (params.action === "status") {
          const job = yield* background.get(params.job_id)
          if (!job) return yield* Effect.fail(new Error(`No background job found with ID: ${params.job_id}`))

          const logFile = job.metadata?.logFile as string | undefined
          const lines = [`Job ID: ${job.id}`, `Status: ${job.status}`, `Title: ${job.title ?? "(none)"}`]
          if (logFile) lines.push(`Log file: ${logFile}`)

          if (job.status === "running") {
            lines.push("", "The command is still running. Read the log file to check intermediate output.")
          } else if (job.status === "completed") {
            lines.push("", "<output>", job.output ?? "(no output)", "</output>")
          } else if (job.status === "error") {
            lines.push("", `<error>${job.error ?? "Unknown error"}</error>`)
          } else if (job.status === "cancelled") {
            lines.push("", "Command was cancelled.")
          }

          return {
            title: `Status: ${job.id}`,
            metadata: { action: "status", jobId: job.id, status: job.status, logFile },
            output: lines.join("\n"),
          }
        }

        // cancel
        const job = yield* background.cancel(params.job_id)
        if (!job) return yield* Effect.fail(new Error(`No background job found with ID: ${params.job_id}`))
        return {
          title: `Cancel: ${job.id}`,
          metadata: { action: "cancel", jobId: job.id, status: job.status },
          output: `Job ${job.id} cancelled. Status: ${job.status}`,
        }
      }

      // --- start ---
      if (!params.command) return yield* Effect.fail(new Error("command is required for 'start' action"))

      const cfg = yield* config.get()
      const shell = Shell.acceptable(cfg.shell)
      const instanceCtx = yield* InstanceState.context
      const cwd = params.workdir ? path.resolve(instanceCtx.directory, params.workdir) : instanceCtx.directory
      const timeout = params.timeout ?? DEFAULT_TIMEOUT

      yield* ctx.ask({
        permission: ShellID.ToolID,
        patterns: [params.command],
        always: [params.command],
        metadata: { command: params.command, description: params.description },
      })

      const jobId = Identifier.ascending("job")
      const logFile = path.join(TRUNCATION_DIR, `bg_${jobId}.log`)
      yield* fs.ensureDir(TRUNCATION_DIR).pipe(Effect.orDie)

      const ops = ctx.extra?.promptOps as TaskPromptOps | undefined
      if (!ops) return yield* Effect.fail(new Error("BackgroundShell requires promptOps in ctx.extra"))

      const msg = yield* MessageV2.get({ sessionID: ctx.sessionID, messageID: ctx.messageID }).pipe(
        Effect.provideService(Database.Service, database),
        Effect.orDie,
      )
      if (msg.info.role !== "assistant") return yield* Effect.fail(new Error("Not an assistant message"))
      const variant = msg.info.variant

      const command = params.command
      yield* ctx.metadata({
        title: params.description ?? command,
        metadata: { action: "start", jobId, status: "running", command, logFile },
      })

      const runCommand = Effect.fn("BackgroundShell.runCommand")(function* () {
        let output = ""
        const sink = createWriteStream(logFile, { flags: "a" })

        const exitCode = yield* Effect.scoped(
          Effect.gen(function* () {
            const handle = yield* spawner.spawn(cmd(shell, command, cwd, process.env))

            yield* Effect.forkScoped(
              Stream.runForEach(Stream.decodeText(handle.all), (chunk) =>
                Effect.sync(() => {
                  output += chunk
                  sink.write(chunk)
                }),
              ),
            )

            const exit = yield* Effect.raceAll([
              handle.exitCode.pipe(Effect.map((code) => ({ kind: "exit" as const, code }))),
              Effect.sleep(`${timeout} millis`).pipe(
                Effect.map(() => ({ kind: "timeout" as const, code: null })),
              ),
            ])

            if (exit.kind === "timeout") {
              yield* handle.kill({ forceKillAfter: "3 seconds" }).pipe(Effect.orDie)
            }

            return exit.kind === "exit" ? exit.code : null
          }),
        ).pipe(Effect.orDie)

        yield* Effect.promise(
          () => new Promise<void>((resolve) => sink.end(() => resolve())),
        ).pipe(Effect.catch(() => Effect.void))

        const text = output || "(no output)"
        if (exitCode === null) {
          return `${text}\n\n<shell_metadata>\nCommand timed out after ${timeout} ms\n</shell_metadata>`
        }
        if (exitCode !== 0) {
          return `${text}\n\n<exit_code>${exitCode}</exit_code>`
        }
        return text
      })

      const inject = Effect.fn("BackgroundShell.inject")(function* (
        state: "completed" | "error" | "cancelled",
        text: string,
      ) {
        const currentParent = yield* sessions.get(ctx.sessionID)
        yield* ops
          .prompt({
            sessionID: ctx.sessionID,
            agent: currentParent.agent ?? ctx.agent,
            variant,
            parts: [
              {
                type: "text",
                synthetic: true,
                text: renderResult({
                  jobId,
                  state,
                  command,
                  output: state === "completed" ? text : undefined,
                  error: state === "error" ? text : undefined,
                }),
              },
            ],
          })
          .pipe(Effect.ignore, Effect.forkIn(scope, { startImmediately: true }))
      })

      const notify = Effect.fn("BackgroundShell.notify")(function* () {
        const result = yield* background.wait({ id: jobId })
        if (result.info?.status === "completed") return yield* inject("completed", result.info.output ?? "")
        if (result.info?.status === "error") return yield* inject("error", result.info.error ?? "")
        if (result.info?.status === "cancelled") return yield* inject("cancelled", "Command was cancelled")
      })

      yield* background.start({
        id: jobId,
        type: id,
        title: params.description ?? command,
        metadata: { command, logFile },
        run: runCommand(),
      })

      yield* notify().pipe(Effect.forkIn(scope, { startImmediately: true }))

      return {
        title: params.description ?? command,
        metadata: { action: "start", jobId, status: "running", command, logFile },
        output: [
          "Background command started.",
          `Job ID: ${jobId}`,
          `Log file: ${logFile}`,
          "The command is running in the background. You will be notified when it completes.",
          `Use action "status" with job_id "${jobId}" to check progress, or "cancel" to stop it.`,
        ].join("\n"),
      }
    })

    return {
      description: DESCRIPTION,
      parameters: Parameters,
      execute: (params: Schema.Schema.Type<typeof Parameters>, ctx: Tool.Context): Effect.Effect<Tool.ExecuteResult> =>
        execute(params, ctx).pipe(Effect.orDie),
    }
  }),
)
