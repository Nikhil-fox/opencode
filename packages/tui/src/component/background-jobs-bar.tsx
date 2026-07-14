import { Show, For, createMemo, createSignal, onCleanup, onMount } from "solid-js"
import type { JSX } from "@opentui/solid"
import { useTheme } from "../context/theme"
import { useSDK } from "../context/sdk"
import { useSync } from "../context/sync"
import { useProject } from "../context/project"
import { useDialog, type DialogContext } from "../ui/dialog"
import { SPINNER_FRAMES } from "./spinner"
import { TextAttributes } from "@opentui/core"
import type { BackgroundJobInfo } from "@opencode-ai/sdk/v2"

function formatDuration(startedAt: number, now: number): string {
  const seconds = Math.max(0, Math.floor((now - Number(startedAt)) / 1000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remaining = seconds % 60
  return `${minutes}m${remaining.toString().padStart(2, "0")}s`
}

async function readLogFile(logFile: string | undefined): Promise<string> {
  if (!logFile) return ""
  try {
    const text = await Bun.file(logFile).text()
    return text.trim()
  } catch {
    return ""
  }
}

// Single shared clock so header + dialog stay in lockstep, even while a modal is open.
const [sharedNow, setSharedNow] = createSignal(Date.now())
let sharedClockUsers = 0
let sharedClockTimer: ReturnType<typeof setInterval> | undefined

function useSharedNow() {
  onMount(() => {
    sharedClockUsers += 1
    if (!sharedClockTimer) {
      setSharedNow(Date.now())
      sharedClockTimer = setInterval(() => setSharedNow(Date.now()), 1000)
    }
  })
  onCleanup(() => {
    sharedClockUsers -= 1
    if (sharedClockUsers <= 0 && sharedClockTimer) {
      clearInterval(sharedClockTimer)
      sharedClockTimer = undefined
      sharedClockUsers = 0
    }
  })
  return sharedNow
}

function JobLogDialog(props: { job: BackgroundJobInfo }) {
  const { theme } = useTheme()
  const dialog = useDialog()
  const now = useSharedNow()
  const [logs, setLogs] = createSignal("")
  const [loading, setLoading] = createSignal(true)

  const command = createMemo(
    () => (props.job.metadata?.command as string) ?? props.job.title ?? props.job.id,
  )
  const title = createMemo(() => props.job.title ?? command())
  const logFile = createMemo(() => props.job.metadata?.logFile as string | undefined)

  const refreshLogs = async () => {
    const text = await readLogFile(logFile())
    setLogs(text)
    setLoading(false)
  }

  void refreshLogs()
  const logTimer = setInterval(() => void refreshLogs(), 1000)
  onCleanup(() => clearInterval(logTimer))

  const body = createMemo(() => {
    if (loading()) return "loading..."
    const text = logs()
    if (text) return text
    return "No output yet — the command is still running or has not produced any output."
  })

  return (
    <box flexDirection="column" paddingTop={1} paddingBottom={1} paddingLeft={2} paddingRight={2} gap={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text attributes={TextAttributes.BOLD} fg={theme.text}>
          {title()}
        </text>
        <text fg={theme.textMuted} onMouseUp={() => dialog.clear()}>
          esc
        </text>
      </box>
      <box flexDirection="row" gap={1}>
        <text fg={theme.success}>$</text>
        <text fg={theme.primary} attributes={TextAttributes.BOLD}>
          {command()}
        </text>
      </box>
      <box flexDirection="row" gap={1}>
        <text fg={theme.textMuted}>status</text>
        <text fg={theme.text}>{props.job.status}</text>
        <text fg={theme.textMuted}>·</text>
        <text fg={theme.primary} attributes={TextAttributes.BOLD}>
          {formatDuration(Number(props.job.started_at), now())}
        </text>
        <text fg={theme.textMuted}>·</text>
        <text fg={theme.textMuted}>{props.job.id}</text>
      </box>
      <box border={["top"]} borderColor={theme.border} paddingTop={1}>
        <scrollbox maxHeight={20} flexGrow={1}>
          <text fg={logs() ? theme.text : theme.warning} wrapMode="word">
            {body()}
          </text>
        </scrollbox>
      </box>
    </box>
  )
}

function openJobLog(dialog: DialogContext, job: BackgroundJobInfo) {
  dialog.replace(() => <JobLogDialog job={job} />)
  dialog.setSize("large")
}

function JobRow(props: {
  job: BackgroundJobInfo
  now: number
  onCancel: (id: string) => void
  onOpen: (job: BackgroundJobInfo) => void
}) {
  const { theme } = useTheme()
  const isShell = createMemo(() => props.job.type === "background_shell")
  const iconColor = createMemo(() => (isShell() ? theme.success : theme.accent))
  const title = createMemo(() => props.job.title ?? (props.job.metadata?.command as string) ?? props.job.id)

  return (
    <box flexDirection="row" paddingLeft={2} height={1}>
      <box width={2} flexShrink={0}>
        <spinner frames={SPINNER_FRAMES} interval={80} color={theme.primary} />
      </box>
      <text fg={iconColor()} flexShrink={0} width={1}>
        {isShell() ? "$" : "↳"}
      </text>
      <text fg={theme.text} wrapMode="none" flexShrink={1} onMouseUp={() => props.onOpen(props.job)}>
        {" "}
        {title()}
      </text>
      <box flexGrow={1} />
      <text fg={theme.textMuted}>{formatDuration(Number(props.job.started_at), props.now)}</text>
      <text fg={theme.textMuted} onMouseUp={() => props.onOpen(props.job)}>
        {"  view"}
      </text>
      <text fg={theme.error} onMouseUp={() => props.onCancel(props.job.id)}>
        {"  ✕"}
      </text>
    </box>
  )
}

export function BackgroundJobsBar(props: { width: number }): JSX.Element {
  const { theme } = useTheme()
  const sdk = useSDK()
  const sync = useSync()
  const project = useProject()
  const dialog = useDialog()
  const [jobs, setJobs] = createSignal<BackgroundJobInfo[]>([])
  const now = useSharedNow()

  const running = createMemo(() => jobs().filter((job) => job.status === "running"))

  const fetchJobs = async () => {
    if (!sync.data.capabilities.experimentalBackgroundSubagents) return
    try {
      const workspace = project.workspace.current()
      const response = await sdk.client.experimental.backgroundJobs.list({ workspace })
      setJobs(response.data ?? [])
    } catch {
      // swallow
    }
  }

  let pollTimer: ReturnType<typeof setInterval> | undefined
  onMount(() => {
    void fetchJobs()
    pollTimer = setInterval(fetchJobs, 2000)
  })
  onCleanup(() => {
    if (pollTimer) clearInterval(pollTimer)
  })

  const cancel = async (jobId: string) => {
    try {
      const workspace = project.workspace.current()
      await sdk.client.experimental.backgroundJobs.cancel({ jobId, workspace })
      await fetchJobs()
    } catch {
      // swallow
    }
  }

  return (
    <Show when={running().length > 0}>
      <box
        backgroundColor={theme.backgroundPanel}
        border={["bottom"]}
        borderColor={theme.border}
        flexDirection="column"
        flexShrink={0}
        marginLeft={2}
        marginRight={2}
      >
        <box flexDirection="row" height={1}>
          <text fg={theme.primary} attributes={TextAttributes.BOLD}>
            {"⏵ Background Tasks"}
          </text>
          <text fg={theme.textMuted}>
            {" ("}
            {running().length}
            {")"}
          </text>
        </box>
        <For each={running()}>
          {(job) => (
            <JobRow
              job={job}
              now={now()}
              onCancel={(id) => void cancel(id)}
              onOpen={(item) => openJobLog(dialog, item)}
            />
          )}
        </For>
      </box>
    </Show>
  )
}
