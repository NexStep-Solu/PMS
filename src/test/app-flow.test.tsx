import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import App from '@/App'
import { queryClient } from '@/app/query-client'
import { isDemoMode, resetDbClient } from '@/lib/client'

// Both the query cache and the data client are module singletons (as they are
// in the browser), so every test starts from a cold, signed-out state.
beforeEach(() => {
  queryClient.clear()
  resetDbClient()
})

/**
 * End-to-end smoke coverage: sign in, then visit every route in the shell.
 *
 * The goal is not to assert product behaviour (the feature tests do that) but
 * to prove each screen mounts, resolves its queries and renders without a
 * runtime error.
 */

async function signIn(email = 'arkarmin@pms.dev', password = 'password123') {
  const user = userEvent.setup()
  await user.type(await screen.findByLabelText('Email', undefined, { timeout: 8000 }), email)
  await user.type(await screen.findByLabelText('Password', undefined, { timeout: 8000 }), password)
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
  await screen.findByRole('navigation', { name: 'Main' }, { timeout: 8000 })
  return user
}

function shell() {
  return render(<App />)
}

describe('authentication flow', () => {
  it('runs in demo mode without Supabase credentials', () => {
    expect(isDemoMode).toBe(true)
  })

  it('redirects an anonymous visitor to sign in', async () => {
    window.history.pushState({}, '', '/app/dashboard')
    shell()
    expect(await screen.findByRole('heading', { name: /sign in/i })).toBeInTheDocument()
  })

  it('signs in and lands on the dashboard', async () => {
    window.history.pushState({}, '', '/login')
    shell()
    await signIn()

    const main = await screen.findByRole('main')
    await waitFor(() => expect(within(main).getByText(/my open tasks/i)).toBeInTheDocument(), {
      timeout: 8000,
    })
  })
})

describe('authenticated routes', () => {
  const routes: Array<[string, RegExp]> = [
    ['/app/dashboard', /good (morning|afternoon|evening)/i],
    ['/app/my-tasks', /my tasks/i],
    ['/app/calendar', /^calendar$/i],
    ['/app/inbox', /notifications/i],
    ['/app/teams', /teams/i],
    ['/app/members', /members/i],
    ['/app/reports', /reports/i],
    ['/app/time', /time tracking/i],
    ['/app/settings', /settings/i],
    ['/app/projects', /projects/i],
    ['/app/projects/prj-web/overview', /progress/i],
    ['/app/projects/prj-web/board', /in progress/i],
    ['/app/projects/prj-web/list', /Kanban board with drag and drop/i],
    ['/app/projects/prj-web/calendar', /^calendar$/i],
    ['/app/projects/prj-web/timeline', /task/i],
    ['/app/projects/prj-web/milestones', /milestones/i],
    ['/app/projects/prj-web/files', /files/i],
  ]

  for (const [path, expected] of routes) {
    it(`renders ${path}`, async () => {
      window.history.pushState({}, '', '/login')
      shell()
      await signIn()

      window.history.pushState({}, '', path)
      window.dispatchEvent(new PopStateEvent('popstate'))

      const main = await screen.findByRole('main', {}, { timeout: 8000 })
      await waitFor(
        () => expect(within(main).queryAllByText(expected).length).toBeGreaterThan(0),
        { timeout: 8000 },
      )
    })
  }
})

describe('workspace switching', () => {
  it('offers a switcher when the user belongs to more than one workspace', async () => {
    window.history.pushState({}, '', '/login')
    shell()
    await signIn()

    const trigger = await screen.findByRole('button', { name: /workspace: /i }, { timeout: 8000 })
    await userEvent.setup().click(trigger)

    const menu = await screen.findByRole('menu')
    expect(within(menu).getByRole('menuitem', { name: /NextStep/ })).toBeInTheDocument()
    expect(within(menu).getByRole('menuitem', { name: /Artificium/ })).toBeInTheDocument()
    expect(within(menu).getByRole('menuitem', { name: /create workspace/i })).toBeInTheDocument()
  })

  it('hides the switcher for a single-workspace member', async () => {
    window.history.pushState({}, '', '/login')
    shell()
    await signIn('elle@pms.dev')

    await screen.findByRole('navigation', { name: 'Main' }, { timeout: 8000 })
    await waitFor(() => expect(screen.queryByRole('button', { name: /workspace: /i })).not.toBeInTheDocument(), {
      timeout: 8000,
    })
  })
})

describe('task drawer', () => {
  it('opens from the board, shows the full task detail, and closes again', async () => {
    window.history.pushState({}, '', '/login')
    shell()
    await signIn()

    window.history.pushState({}, '', '/app/projects/prj-web/board')
    window.dispatchEvent(new PopStateEvent('popstate'))

    const card = await screen.findByRole(
      'button',
      { name: /Kanban board with drag and drop/i },
      { timeout: 8000 },
    )

    const user = userEvent.setup()
    await user.click(card)

    const drawer = await screen.findByRole('dialog', {}, { timeout: 8000 })
    await waitFor(() => expect(within(drawer).getByText('Checklist')).toBeInTheDocument(), {
      timeout: 8000,
    })
    expect(within(drawer).getByText('Comments')).toBeInTheDocument()
    expect(within(drawer).getByText('Attachments')).toBeInTheDocument()
    expect(within(drawer).getByText('Assignee')).toBeInTheDocument()

    // The drawer is URL-driven, so closing must clear `?task`.
    await user.keyboard('{Escape}')
    await waitFor(() => expect(window.location.search).toBe(''), { timeout: 8000 })
  })
})

describe('permissions', () => {
  it('hides destructive actions for a viewer', async () => {
    window.history.pushState({}, '', '/login')
    shell()
    await signIn('sam@pms.dev')

    await waitFor(() => expect(screen.queryByRole('button', { name: 'New task' })).not.toBeInTheDocument(), {
      timeout: 8000,
    })
  })
})