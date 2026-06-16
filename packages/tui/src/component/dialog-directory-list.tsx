import { useDialog } from "../ui/dialog"
import { DialogSelect } from "../ui/dialog-select"
import { useRoute } from "../context/route"
import { useTuiConfig } from "../config"
import { createMemo, createSignal, createResource, onMount } from "solid-js"
import { useSDK } from "../context/sdk"

export function DialogDirectoryList() {
  const dialog = useDialog()
  const route = useRoute()
  const tuiConfig = useTuiConfig()
  const sdk = useSDK()

  const sessionID = createMemo(() => (route.data.type === "session" ? route.data.sessionID : undefined))

  const [toDelete, setToDelete] = createSignal<string>()

  const [dirs, { refetch }] = createResource(sessionID, async (id) => {
    if (!id) return []
    const result = await sdk.client.session.directories({ sessionID: id })
    if (result.error) return []
    return (result.data as string[]) ?? []
  })

  const options = createMemo(() => {
    const list = dirs()
    if (list === undefined) {
      return [
        {
          title: "Loading directories...",
          value: "loading",
        },
      ]
    }

    if (list.length === 0) {
      return [
        {
          title: "No additional directories added to this session",
          value: "empty",
        },
      ]
    }

    return list.map((dir) => {
      const isDeleting = toDelete() === dir
      return {
        title: isDeleting ? "Press delete again to confirm" : dir,
        value: dir,
      }
    })
  })

  onMount(() => {
    dialog.setSize("large")
  })

  return (
    <DialogSelect
      title="Additional Directories"
      skipFilter={true}
      placeholder="Directories"
      options={options()}
      onMove={() => {
        setToDelete(undefined)
      }}
      onSelect={() => {}}
      actions={[
        {
          command: "dir.delete",
          title: "delete",
          disabled: dirs() === undefined || (dirs()?.length ?? 0) === 0,
          onTrigger: async (option) => {
            if (option.value === "loading" || option.value === "empty") return
            if (toDelete() === option.value) {
              const id = sessionID()
              if (!id) return
              await sdk.client.session.command({ sessionID: id, command: "remove-dir", arguments: option.value })
              setToDelete(undefined)
              refetch()
              dialog.clear()
              return
            }
            setToDelete(option.value)
          },
        },
      ]}
    />
  )
}
