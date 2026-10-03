import { QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { BrowserRouter } from 'react-router-dom'

import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ThemeProvider } from '@/hooks/use-theme'
import { WorkspaceProvider } from '@/features/organizations/workspace-context'
import { useWorkspaces } from '@/features/auth/queries'

import { queryClient } from './query-client'

/**
 * Provider order matters:
 *   Theme → Router → Query client → Tooltips → Toasts → Workspaces.
 * Workspaces sit closest to the app so routes can read the active
 * organisation synchronously.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  const [client] = useState(() => queryClient)

  return (
    <ThemeProvider>
      <BrowserRouter>
        <QueryClientProvider client={client}>
          <TooltipProvider delayDuration={200} skipDelayDuration={400}>
            <WorkspaceBoundary>{children}</WorkspaceBoundary>
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      </BrowserRouter>
    </ThemeProvider>
  )
}

function WorkspaceBoundary({ children }: { children: ReactNode }) {
  const { data: workspaces } = useWorkspaces()

  return <WorkspaceProvider workspaces={workspaces}>{children}</WorkspaceProvider>
}