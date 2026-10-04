import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import App from '@/App'
import { queryClient } from '@/app/query-client'
import { resetDbClient } from '@/lib/client'

/**
 * Core journey coverage, driven through the real UI against the demo backend.
 *
 * These assert product behaviour — the route smoke tests only prove a screen
 * mounts. Two real defects were found this way:
 *   - the demo backend scoped `organization_members` to the caller, so assignee
 *     pickers listed one person;
 *   - the quick-create button left the project unset, so new tasks landed in the
 *     first project of the workspace instead of the one being viewed.
 */

beforeEach(() => {
  queryClient.clear()
  resetDbClient()
  window.history.pushState({}, '', '/login')
})

/**
 * Generous on purpose: the demo backend injects artificial latency, and this file
 * runs alongside the rest of the suite in parallel, so queries can take several
 * seconds under load. A short timeout shows up as flaky failures, not bugs.
 */
const TIMEOUT = 30000
const PROJECT = 'NextStep Website'
const ASSIGNEE = 'Joe Park'

async function signIn(email = 'arkarmin@pms.dev', password = 'password123') {
  render(<App />)
  const user = userEvent.setup()
  await user.type(await screen.findByLabelText('Email', undefined, { timeout: TIMEOUT }), email)
  await user.type(await screen.findByLabelText('Password', undefined, { timeout: TIMEOUT }), password)
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
  await screen.findByRole('navigation', { name: 'Main' }, { timeout: TIMEOUT })
  return user
}

async function goto(path: string) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
  await screen.findByRole('main', {}, { timeout: TIMEOUT })

  if (path.includes('/projects/')) {
    // The project sub-nav only exists once the project route has rendered, which
    // is also when the top bar knows which project it is scoping quick-create to.
    // Clicking earlier races the router and silently creates the task elsewhere.
    await screen.findByRole('link', { name: /^board$/i }, { timeout: TIMEOUT })
  }
}

/** Opens quick-create from the top bar, the same entry point the header uses. */
async function openQuickCreate() {
  const topbar = screen.getAllByRole('banner')[0]!
  const button = await within(topbar).findByRole('button', { name: /new task/i }, { timeout: TIMEOUT })
  await userEvent.setup().click(button)
  const dialog = (await screen.findByRole('dialog', {}, { timeout: TIMEOUT }))!
  // Readiness = the submit button is live. It stays disabled until projects,
  // statuses and members have loaded *and* a project is resolved, which is the
  // dead dialog state this guards against.
  await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Create task' })).toBeEnabled(), {
    timeout: TIMEOUT,
  })
  return dialog
}

async function pickOption(triggerName: string, optionText: string) {
  const user = userEvent.setup()
  const control = await screen.findByRole('combobox', { name: triggerName })
  await user.click(control)
  const listbox = (await screen.findByRole('listbox'))!
  await user.click(within(listbox).getByText(optionText))
  await waitFor(() => expect(control).toHaveTextContent(optionText), { timeout: TIMEOUT })
}

async function createTask(title: string, opts: { assignee?: string } = {}) {
  const user = userEvent.setup()
  const dialog = await openQuickCreate()
  await user.type(within(dialog).getByLabelText(/title/i), title)
  if (opts.assignee) await pickOption('Assignee', opts.assignee)
  await user.click(within(dialog).getByRole('button', { name: 'Create task' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), { timeout: TIMEOUT })
}

describe('core journey', () => {
  it('creates a project and lists it', async () => {
    const user = await signIn()
    await goto('/app/projects')

    await user.click(await screen.findByRole('button', { name: /new project/i }, { timeout: TIMEOUT }))
    const dialog = (await screen.findByRole('dialog'))!
    await user.type(within(dialog).getByLabelText(/name/i), 'Payments Revamp')
    await user.type(within(dialog).getByLabelText(/key/i), 'PAY')
    await user.click(within(dialog).getByRole('button', { name: 'Create project' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), { timeout: TIMEOUT })
    await waitFor(
      () => expect(within(screen.getByRole('main')).getByText('Payments Revamp')).toBeInTheDocument(),
      { timeout: TIMEOUT },
    )
  })

  it('defaults quick-create to the project being viewed', async () => {
    await signIn()
    await goto('/app/projects/prj-web/list')

    const dialog = await openQuickCreate()
    const project = within(dialog).getByRole('combobox', { name: 'Project' })
    expect(project).toHaveTextContent(PROJECT)
    // A ready dialog never shows the placeholder.
    expect(project).not.toHaveTextContent('Choose a project')
  })

  it('creates a task in the current project and shows its assignee', async () => {
    await signIn()
    await goto('/app/projects/prj-web/list')

    await createTask('Audit the gateway logs', { assignee: ASSIGNEE })

    const cell = await screen.findByText('Audit the gateway logs', {}, { timeout: TIMEOUT })
    const row = cell.closest('tr')
    expect(row).not.toBeNull()
    expect(within(row!).getByText(ASSIGNEE)).toBeInTheDocument()
  })

  it('keeps the project list and the overview roll-up in step', async () => {
    await signIn()
    await goto('/app/projects/prj-web/list')

    await screen.findByRole('table', {}, { timeout: TIMEOUT })
    const rowsBefore = within(screen.getByRole('table')).getAllByRole('row').length

    await createTask('Rollup probe')

    await waitFor(
      () =>
        expect(within(screen.getByRole('table')).getAllByRole('row').length).toBe(rowsBefore + 1),
      { timeout: TIMEOUT },
    )

    await goto('/app/projects/prj-web/overview')
    const tasksStat = await screen.findByText('Tasks', {}, { timeout: TIMEOUT })
    expect(Number(tasksStat.parentElement?.textContent?.replace(/[^0-9]/g, ''))).toBeGreaterThan(0)
  })

  it('offers every workspace member as an assignee, not just the signed-in user', async () => {
    await signIn()
    await goto('/app/projects/prj-web/list')

    const dialog = await openQuickCreate()
    await userEvent.setup().click(within(dialog).getByRole('combobox', { name: 'Assignee' }))
    const listbox = (await screen.findByRole('listbox'))!

    for (const name of ['Arkar Min', 'Min Thiha', 'Dana Lim', 'Joe Park', 'Sam Rivera']) {
      expect(within(listbox).getByText(name)).toBeInTheDocument()
    }
  })
})