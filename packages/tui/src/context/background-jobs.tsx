import { createSimpleContext } from "./helper"
import { useSDK } from "./sdk"
import { useSync } from "./sync"
import { useProject } from "./project"
import { createSignal, createEffect, onCleanup, onMount, createMemo } from "solid-js"
import type { BackgroundJobInfo } from "@opencode-ai/sdk/v2"

export type BackgroundJobsContext = {
  jobs: () => BackgroundJobInfo[]
  running: () => BackgroundJobInfo[]
  cancel: (jobId: string) => Promise<void>
}

export const { use: useBackgroundJobs, provider: BackgroundJobsProvider } = createSimpleContext({
  name: "BackgroundJobs",
  init: () => {
    const sdk = useSDK()
    const sync = useSync()
    const project = useProject()
    const [jobs, setJobs] = createSignal<BackgroundJobInfo[]>([])

    const enabled = createMemo(() => sync.data.capabilities.experimentalBackgroundSubagents)
    const running = createMemo(() => jobs().filter((job) => job.status === "running"))

    const fetchJobs = async () => {
      if (!enabled()) return
      try {
        const workspace = project.workspace.current()
        const response = await sdk.client.experimental.backgroundJobs.list({ workspace })
        setJobs(response.data ?? [])
      } catch {
        // ignore polling errors
      }
    }

    let timer: ReturnType<typeof setInterval> | undefined

    const startPolling = () => {
      if (timer) return
      timer = setInterval(fetchJobs, 2000)
    }

    const stopPolling = () => {
      if (!timer) return
      clearInterval(timer)
      timer = undefined
    }

    const cancel = async (jobId: string) => {
      try {
        const workspace = project.workspace.current()
        await sdk.client.experimental.backgroundJobs.cancel({ jobId, workspace })
        await fetchJobs()
      } catch {
        // ignore cancel errors
      }
    }

    onMount(() => {
      void fetchJobs()
    })

    // Start/stop polling based on whether there are running jobs
    createEffect(() => {
      if (running().length > 0) {
        startPolling()
      } else {
        stopPolling()
      }
    })

    onCleanup(() => stopPolling())

    return { jobs, running, cancel, ready: true }
  },
})
