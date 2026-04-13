
// Simplified use-toast hooked for feedback
import * as React from "react"

const listeners: Array<(state: any) => void> = []
let memoryState = { toasts: [] as any[] }

function dispatch(action: any) {
    memoryState = { ...memoryState, toasts: [...memoryState.toasts, { ...action.toast, id: Math.random() }] }
    listeners.forEach((listener) => listener(memoryState))
}

export function useToast() {
    const [state, setState] = React.useState(memoryState)

    React.useEffect(() => {
        listeners.push(setState)
        return () => {
            const index = listeners.indexOf(setState)
            if (index > -1) {
                listeners.splice(index, 1)
            }
        }
    }, [state])

    return {
        ...state,
        toast: (props: any) => {
            dispatch({ type: "ADD_TOAST", toast: props })
            // Consolog as fallback
            console.log("TOAST:", props.title, props.description)
            // Auto dismiss simple
            setTimeout(() => {
                // Logic to remove... typically handled by Toaster component
            }, 3000)
        },
        dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId }),
    }
}
