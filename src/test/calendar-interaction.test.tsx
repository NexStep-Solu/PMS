import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import App from '@/App'
import { queryClient } from '@/app/query-client'
import { resetDbClient } from '@/lib/client'

/**
 * Month-view clicks used to do nothing. The grid rendered one task <button>
 * inside each day-cell <button>, which is invalid HTML that browsers handle
 * unpredictably, and the "+N more" row plus empty days had no action at all.
 */

beforeEach(() => {
  queryClient.clear()
  resetDbClient()
  window.history.pushState({}, '', '/login')
})

const TIMEOUT = 30000

async function openProjectCalendar() {
  render(<App />)
  const user = userEvent.setup()
  await user.type(await screen.findByLabelText('Email', undefined, { timeout: TIMEOUT }), 'arkarmin@pms.dev')
  await user.type(await screen.findByLabelText('Password', undefined, { timeout: TIMEOUT }), 'password123')
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
  await screen.findByRole('navigation', { name: 'Main' }, { timeout: TIMEOUT })

  window.history.pushState({}, '', '/app/projects/prj-web/calendar')
  window.dispatchEvent(new PopStateEvent('popstate'))
  const main = await screen.findByRole('main', {}, { timeout: TIMEOUT })
  // Wait for tasks to render into the grid.
  await waitFor(() => expect(within(main).getByText(/scheduled tasks/i)).toBeInTheDocument(), {
    timeout: TIMEOUT,
  })
  return { user, main }
}

describe('calendar month view', () => {
  it('never nests a button inside another button', async () => {
    const { main } = await openProjectCalendar()

    expect(main.querySelectorAll('button button')).toHaveLength(0)
  })

  it('opens the task drawer when a task chip is clicked', async () => {
    const { user, main } = await openProjectCalendar()

    // The chip is the only button carrying a task title; the day cell carries
    // the day number plus its tasks.
    const chip = [...main.querySelectorAll('button')].find((button) =>
      /^Implement email \+ password sign in$/.test(button.textContent ?? ''),
    )
    expect(chip).toBeDefined()

    await user.click(chip as HTMLElement)

    await waitFor(() => expect(window.location.search).toContain('task='), { timeout: TIMEOUT })
    const drawer = await screen.findByRole('dialog', {}, { timeout: TIMEOUT })
    await waitFor(() => expect(within(drawer).getByText('Checklist')).toBeInTheDocument(), {
      timeout: TIMEOUT,
    })
  })

  it('drops into the day agenda when a day cell is clicked', async () => {
    const { user, main } = await openProjectCalendar()

    const dayCell = main.querySelector('[role="button"][aria-label="30 October 2026"]')
    expect(dayCell).not.toBeNull()
    await user.click(dayCell as HTMLElement)

    // The agenda replaces the month grid; the Day toggle is pressed. A single-select
    // toggle group exposes radio roles, not buttons.
    await waitFor(
      () => expect(screen.getByRole('radio', { name: 'Day' })).toHaveAttribute('data-state', 'on'),
      { timeout: TIMEOUT },
    )
    expect(within(screen.getByRole('main')).getByText('30 October 2026')).toBeInTheDocument()
  })
})
