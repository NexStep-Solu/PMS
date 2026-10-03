import { createContext, use, type ReactNode } from 'react'

import type { Crumb } from '@/components/shared/page-header'

/**
 * The project layout publishes its breadcrumbs here so the sticky topbar can
 * show "Projects / NextStep Website" without the layout and the header having
 * to know about each other.
 *
 * Kept in its own module so `app-shell` can import the hook without pulling in
 * the (lazy) project layout.
 */
const ProjectHeaderContext = createContext<Crumb[]>([])

export function ProjectHeaderProvider({ crumbs, children }: { crumbs: Crumb[]; children: ReactNode }) {
  return <ProjectHeaderContext value={crumbs}>{children}</ProjectHeaderContext>
}

export function useProjectHeader(): Crumb[] {
  return use(ProjectHeaderContext)
}
