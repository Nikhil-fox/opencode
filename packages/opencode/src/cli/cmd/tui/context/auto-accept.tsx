import { createSimpleContext } from "./helper"
import { createSignal } from "solid-js"

export const { use: useAutoAccept, provider: AutoAcceptProvider } = createSimpleContext({
  name: "AutoAccept",
  init: () => {
    const [autoaccept, setAutoaccept] = createSignal<"none" | "edit">("none")

    return {
      autoaccept,
      setAutoaccept,
    }
  },
})
