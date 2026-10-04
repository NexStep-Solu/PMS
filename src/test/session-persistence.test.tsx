import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import App from '@/App'
import { queryClient } from '@/app/query-client'
import { resetDbClient } from '@/lib/client'
import { safeRedirectPath } from '@/lib/redirects'
import { createDemoClient } from '@/lib/db/mock/client'
import { isDemoMode } from '@/lib/client'

beforeEach(() => {
  queryClient.clear()
  resetDbClient()
})

async function signIn(email = 'arkarmin@pms.dev') {
  const user = userEvent.setup()
  await user.type(await screen.findByLabelText('Email', undefined, { timeout: 8000 }), email)
  await user.type(screen.getByLabelText('Password'), 'password123')
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
  await screen.findByRole('navigation', { name: 'Main' }, { timeout: 9000 })
  return user
}

describe('safeRedirectPath', () => {
  it('keeps in-app paths', () => {
    expect(safeRedirectPath('/app/projects/abc/board')).toBe('/app/projects/abc/board')
    expect(safeRedirectPath('/app/my-tasks?filter=overdue')).toBe('/app/my-tasks?filter=overdue')
  })

  it('refuses to leave the app', () => {
    expect(safeRedirectPath('https://evil.example')).toBe('/app/dashboard')
    expect(safeRedirectPath('//evil.example')).toBe('/app/dashboard')
    expect(safeRedirectPath('/\\evil.example')).toBe('/app/dashboard')
    expect(safeRedirectPath('/settings')).toBe('/app/dashboard')
  })

  it('never bounces back to the auth screens', () => {
    expect(safeRedirectPath('/login')).toBe('/app/dashboard')
    expect(safeRedirectPath('/register')).toBe('/app/dashboard')
    expect(safeRedirectPath(null)).toBe('/app/dashboard')
  })
})

describe('hermetic test environment', () => {
  it('ignores a local .env.local so tests never touch a real project', () => {
    expect(isDemoMode).toBe(true)
  })
})

describe('session persistence', () => {
  it('survives a full page load', async () => {
    window.history.pushState({}, '', '/login')
    const first = render(<App />)
    await signIn()

    // A refresh rebuilds every module-level singleton — including the client.
    queryClient.clear()
    resetDbClient()
    first.unmount()
    const second = render(<App />)

    await within(second.container).findByRole('navigation', { name: 'Main' }, { timeout: 8000 })
    expect(within(second.container).queryByLabelText('Email')).not.toBeInTheDocument()
  })

  it('keeps a deep link after a reload, without signing in again', async () => {
    window.history.pushState({}, '', '/login')
    const first = render(<App />)
    await signIn()

    queryClient.clear()
    resetDbClient()
    window.history.pushState({}, '', '/app/projects/prj-web/board')
    // A reload wipes every module singleton; the first tree is unmounted by
    // `cleanup`, but we query the new one explicitly to be safe.
    first.unmount()
    const second = render(<App />)

    await waitFor(() => expect(within(second.container).getByRole('main')).toBeInTheDocument(), {
      timeout: 8000,
    })
    await waitFor(
      () => expect(within(second.container).getByRole('main').textContent).toMatch(/in progress/i),
      { timeout: 8000 },
    )
    expect(within(second.container).queryByLabelText('Email')).not.toBeInTheDocument()
  })

  it('signs out for real', async () => {
    const client = createDemoClient()
    await client.auth.signInWithPassword({ email: 'min@pms.dev', password: 'password123' })
    expect(window.localStorage.getItem('pms-demo-session')).toBe('u-min')

    await client.auth.signOut()
    expect(window.localStorage.getItem('pms-demo-session')).toBeNull()

    const restored = createDemoClient()
    expect((await restored.auth.getSession()).data).toBeNull()
  })
})

describe('returning to the page you were on', () => {
  it('redirects to /login?next=… and lands back there after signing in', async () => {
    window.history.pushState({}, '', '/app/projects/prj-web/list')
    render(<App />)

    // Anonymous → the guard keeps the requested path in `next`.
    const emailField = await screen.findByLabelText('Email', undefined, { timeout: 8000 })
    expect(emailField).toBeInTheDocument()
    expect(window.location.pathname).toBe('/login')
    expect(window.location.search).toBe('?next=%2Fapp%2Fprojects%2Fprj-web%2Flist')

    const user = userEvent.setup()
    await user.type(emailField, 'arkarmin@pms.dev')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    await screen.findByRole('navigation', { name: 'Main' }, { timeout: 9000 })
    await waitFor(() => expect(window.location.pathname).toBe('/app/projects/prj-web/list'))
  })

  it('ignores a hostile next parameter', async () => {
    window.history.pushState({}, '', '/login?next=https%3A%2F%2Fevil.example')
    render(<App />)

    const user = userEvent.setup()
    await user.type(await screen.findByLabelText('Email', undefined, { timeout: 8000 }), 'arkarmin@pms.dev')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    await screen.findByRole('navigation', { name: 'Main' }, { timeout: 9000 })
    expect(window.location.pathname).toBe('/app/dashboard')
  })
})
