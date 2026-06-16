import { useDialog } from "../ui/dialog"
import { DialogSelect } from "../ui/dialog-select"
import { useRoute } from "../context/route"
import { useSync } from "../context/sync"
import { useProject } from "../context/project"
import { createEffect, createMemo, createSignal, onMount } from "solid-js"
import { useSDK } from "../context/sdk"
import { useToast } from "../ui/toast"
import { useCommandShortcut } from "../keymap"
import { openWorkspaceSelect, type WorkspaceSelection } from "./dialog-workspace-create"
import { DialogSessionList } from "./dialog-session-list"

export function DialogWorkspaceList() {
  const dialog = useDialog()
  const project = useProject()
  const route = useRoute()
  const sync = useSync()
  const sdk = useSDK()
  const toast = useToast()
  const deleteShortcut = useCommandShortcut("session.delete")
  const [toDelete, setToDelete] = createSignal<string>()
  const [counts, setCounts] = createSignal<Record<string, number | null | undefined>>({})

  const open = async (_workspaceID: string, _forceCreate?: boolean) => {
    await openWorkspaceSelect({
      dialog,
      sdk,
      sync,
      project,
      toast,
      onSelect: async (selection: WorkspaceSelection) => {
        if (selection.type === "none") return
        if (selection.type === "new" || selection.type === "existing") {
          project.workspace.set(selection.type === "existing" ? selection.workspaceID : undefined)
        }
      },
    })
  }

  const selectWorkspace = async (workspaceID: string | null) => {
    if (workspaceID == null) {
      project.workspace.set(undefined)
      dialog.replace(() => <DialogSessionList />)
      return
    }
    const count = counts()[workspaceID]
    if (count && count > 0) {
      project.workspace.set(workspaceID)
      dialog.replace(() => <DialogSessionList />)
      return
    }

    if (count === 0) {
      await open(workspaceID)
      return
    }
    const listed = await sdk.client.session
      .list({ workspace: workspaceID, roots: true, limit: 1 })
      .catch(() => undefined)
    if (listed?.data?.length) {
      project.workspace.set(workspaceID)
      dialog.replace(() => <DialogSessionList />)
      return
    }
    await open(workspaceID)
  }

  const currentWorkspaceID = createMemo(() => project.workspace.current())

  const localCount = createMemo(
    () => sync.data.session.filter((session) => !session.workspaceID && !session.parentID).length,
  )

  let run = 0
  createEffect(() => {
    const workspaces = project.workspace.list()
    const next = ++run
    if (!workspaces.length) {
      setCounts({})
      return
    }
    setCounts(Object.fromEntries(workspaces.map((workspace) => [workspace.id, undefined])))
    void Promise.all(
      workspaces.map(async (workspace) => {
        const result = await sdk.client.session.list({ workspace: workspace.id, roots: true }).catch(() => undefined)
        return [workspace.id, result ? (result.data?.length ?? 0) : null] as const
      }),
    ).then((entries) => {
      if (run !== next) return
      setCounts(Object.fromEntries(entries))
    })
  })

  const options = createMemo(() => [
    {
      title: "Local",
      value: null as string | null,
      category: "Workspace",
      description: "Use the local machine",
      footer: `${localCount()} session${localCount() === 1 ? "" : "s"}`,
    },
    ...project.workspace.list().map((workspace) => {
      const count = counts()[workspace.id]
      return {
        title:
          toDelete() === workspace.id
            ? `Delete ${workspace.id}? Press ${deleteShortcut()} again`
            : workspace.id,
        value: workspace.id as string | null,
        category: workspace.type,
        description: workspace.branch ? `Branch ${workspace.branch}` : undefined,
        footer:
          count === undefined
            ? "Loading sessions..."
            : count === null
              ? "Sessions unavailable"
              : `${count} session${count === 1 ? "" : "s"}`,
      }
    }),
    {
      title: "+ New workspace",
      value: "__create__" as string | null,
      category: "Actions",
      description: "Create a new workspace",
    },
  ])

  onMount(() => {
    dialog.setSize("large")
    void sdk.client.experimental.workspace.syncList().catch(() => undefined)
    void project.workspace.sync()
  })

  return (
    <DialogSelect
      title="Workspaces"
      skipFilter={true}
      options={options()}
      current={currentWorkspaceID()}
      onMove={() => {
        setToDelete(undefined)
      }}
      onSelect={(option) => {
        setToDelete(undefined)
        if (option.value === "__create__") {
          dialog.replace(() => <DialogWorkspaceCreate onSelect={(workspaceID: string) => open(workspaceID, true)} />)
          return
        }
        void selectWorkspace(option.value)
      }}
      actions={[
        {
          command: "session.delete",
          title: "delete",
          onTrigger: async (option) => {
            if (option.value === "__create__" || option.value === null) return
            if (toDelete() !== option.value) {
              setToDelete(option.value as string)
              return
            }
            const result = await sdk.client.experimental.workspace
              .remove({ id: option.value as string })
              .catch(() => undefined)
            setToDelete(undefined)
            if (result?.error) {
              toast.show({
                message: "Failed to delete workspace",
                variant: "error",
              })
              return
            }
            if (currentWorkspaceID() === option.value) {
              project.workspace.set(undefined)
              route.navigate({ type: "home" })
            }
            await project.workspace.sync()
          },
        },
      ]}
    />
  )
}
