import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import App from '@/App'
import { queryClient } from '@/app/query-client'
import { resetDbClient } from '@/lib/client'

/**
 * The timeline used to be one monotone row per task with nothing clickable:
 * single-colour bars, no today marker, and neither the bar nor the title opened
 * the task. These pin the redesign.
 */

beforeEach(() => {
  queryClient.clear()
  resetDbClient()
  window.history.pushState({}, '', '/login')
})

const TIMEOUT = 30000

async function openProjectTimeline() {
  render(<App />)
  const user = userEvent.setup()
  await user.type(await screen.findByLabelText('Email', undefined, { timeout: TIMEOUT }), 'arkarmin@pms.dev')
  await user.type(await screen.findByLabelText('Password', undefined, { timeout: TIMEOUT }), 'password123')
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
  await screen.findByRole('navigation', { name: 'Main' }, { timeout: TIMEOUT })

  window.history.pushState({}, '', '/app/projects/prj-web/timeline')
  window.dispatchEvent(new PopStateEvent('popstate'))
  const main = await screen.findByRole('main', {}, { timeout: TIMEOUT })
  await waitFor(() => expect(within(main).getByText(/scheduled/i)).toBeInTheDocument(), {
    timeout: TIMEOUT,
  })
  return { user, main }
}

/** Bars carry a date range; titles carry the task name. */
function barButtons(main: HTMLElement) {
  return [...main.querySelectorAll('button')].filter((button) =>
    /\d{1,2} \w{3} –/.test(button.textContent ?? ''),
  )
}

describe('timeline', () => {
  it('colours bars by status instead of rendering one flat colour', async () => {
    const { main } = await openProjectTimeline()

    const bars = barButtons(main)
    expect(bars.length).toBeGreaterThan(0)

    const classes = new Set(bars.flatMap((bar) => [...bar.classList]))
    expect([...classes].some((cls) => cls.startsWith('bg-status-'))).toBe(true)
  })

  it('opens the drawer when a bar is clicked', async () => {
    const { user, main } = await openProjectTimeline()

    const bars = barButtons(main)
    expect(bars.length).toBeGreaterThan(0)
    await user.click(bars[0] as HTMLElement)

    await waitFor(() => expect(window.location.search).toContain('task='), { timeout: TIMEOUT })
    const drawer = await screen.findByRole('dialog', {}, { timeout: TIMEOUT })
    await waitFor(() => expect(within(drawer).getByText('Checklist')).toBeInTheDocument(), {
      timeout: TIMEOUT,
    })
  })

  it('opens the drawer when a row title is clicked', async () => {
    const { user, main } = await openProjectTimeline()

    const title = within(main).getByText('Implement email + password sign in')
    await user.click(title)

    await waitFor(() => expect(window.location.search).toContain('task='), { timeout: TIMEOUT })
    await screen.findByRole('dialog', {}, { timeout: TIMEOUT })
  })
})
