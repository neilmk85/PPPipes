import { useEffect, useCallback } from 'react'

export function useUnsavedChanges(isDirty: boolean) {
  // Guard browser refresh / tab close
  useEffect(() => {
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  // useBlocker requires RouterProvider (DataRouterContext), not BrowserRouter — omitted
  const confirmLeave = useCallback(() => {}, [])
  const cancelLeave = useCallback(() => {}, [])

  return { isBlocked: false, confirmLeave, cancelLeave }
}
