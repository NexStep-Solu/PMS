import { useState } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { MemberSelect } from '@/components/shared/member-select'
import { ProjectSelect, StatusSelect } from '@/components/shared/task-form-fields'

/**
 * A Radix `Select` renders the selected option's text into the closed trigger by
 * copying its `ItemText` node. Hand-rolled item markup that omits `ItemText`
 * therefore selects a value but shows nothing — the project and assignee boxes
 * looked empty while holding the right data.
 *
 * These tests drive the real components and assert on the trigger's text.
 */

const MEMBERS = [
  { id: 'u-1', full_name: 'Ada Lovelace', avatar_url: null },
  { id: 'u-2', full_name: 'Grace Hopper', avatar_url: null },
]

const PROJECTS = [
  { id: 'p-1', name: 'Website Rewrite', key: 'WEB' },
  { id: 'p-2', name: 'Mobile App', key: 'APP' },
]

const STATUSES = [
  { id: 's-1', name: 'To do', category: 'todo', is_completed: false, is_default: true },
  { id: 's-2', name: 'In progress', category: 'in_progress', is_completed: false, is_default: false },
] as never

function trigger(name: string) {
  return screen.getByRole('combobox', { name })
}

async function openAndPick(name: string, optionText: string) {
  const user = userEvent.setup()
  await user.click(trigger(name))
  const listbox = await screen.findByRole('listbox')
  await user.click(within(listbox).getByText(optionText))
}

/** These selects are controlled, so the harness must own the value like a form does. */
function ControlledMember({ initial = null as string | null }) {
  const [value, setValue] = useState<string | null>(initial)
  return <MemberSelect members={MEMBERS} value={value} onChange={setValue} aria-label="Assignee" />
}

function ControlledProject({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial)
  return <ProjectSelect projects={PROJECTS} value={value} onChange={setValue} aria-label="Project" />
}

function ControlledStatus() {
  const [value, setValue] = useState('s-1')
  return <StatusSelect statuses={STATUSES} value={value} onChange={setValue} aria-label="Status" />
}

describe('MemberSelect shows the chosen member in the trigger', () => {
  it('renders the member name once an option is picked', async () => {
    render(<ControlledMember />)

    await openAndPick('Assignee', 'Grace Hopper')

    expect(trigger('Assignee')).toHaveTextContent('Grace Hopper')
  })

  it('renders the name for a value supplied by the form', () => {
    render(
      <MemberSelect members={MEMBERS} value="u-1" onChange={vi.fn()} aria-label="Assignee" />,
    )

    expect(trigger('Assignee')).toHaveTextContent('Ada Lovelace')
  })

  it('shows the unassigned label rather than a blank box', () => {
    render(<MemberSelect members={MEMBERS} value={null} onChange={vi.fn()} aria-label="Assignee" />)

    expect(trigger('Assignee')).toHaveTextContent('Unassigned')
  })

  it('treats an empty string as unassigned instead of rendering nothing', () => {
    render(<MemberSelect members={MEMBERS} value="" onChange={vi.fn()} aria-label="Assignee" />)

    expect(trigger('Assignee')).toHaveTextContent('Unassigned')
  })

  it('normalises a cleared selection back to unassigned', async () => {
    render(<ControlledMember initial="u-1" />)

    await openAndPick('Assignee', 'Unassigned')

    expect(trigger('Assignee')).toHaveTextContent('Unassigned')
    expect(trigger('Assignee')).not.toHaveTextContent('Ada Lovelace')
  })
})

describe('MemberSelect lays the trigger out horizontally', () => {
  /**
   * Radix re-wraps `ItemText` children in a bare inline <span> and discards the
   * ItemText's own className, so a row defined on ItemText silently collapsed to
   * a vertical stack. The row must therefore be declared on a child element.
   */
  it('puts the avatar and the name side by side in one flex row', () => {
    render(<ControlledMember initial="u-2" />)

    const row = trigger('Assignee').querySelector('.inline-flex')
    expect(row).not.toBeNull()

    const avatar = row?.querySelector('[data-slot="avatar"]')
    expect(avatar).not.toBeNull()
    expect(avatar?.getAttribute('title')).toBe('Grace Hopper')
    expect(row).toHaveTextContent('Grace Hopper')
  })

  it('keeps the row when the member has no name', () => {
    render(
      <MemberSelect
        members={[{ id: 'u-9', full_name: null, avatar_url: null }]}
        value="u-9"
        onChange={vi.fn()}
        aria-label="Assignee"
      />,
    )

    const row = trigger('Assignee').querySelector('.inline-flex')
    expect(row).not.toBeNull()
    expect(row).toHaveTextContent('Unknown')
  })
})

describe('ProjectSelect shows the chosen project in the trigger', () => {
  it('renders the project name once an option is picked', async () => {
    render(<ControlledProject />)

    await openAndPick('Project', 'Website Rewrite')

    expect(trigger('Project')).toHaveTextContent('Website Rewrite')
  })

  it('renders the name for a value supplied by the form', () => {
    render(
      <ProjectSelect projects={PROJECTS} value="p-2" onChange={vi.fn()} aria-label="Project" />,
    )

    expect(trigger('Project')).toHaveTextContent('Mobile App')
  })

  it('falls back to the placeholder when nothing is selected', () => {
    render(
      <ProjectSelect
        projects={PROJECTS}
        value=""
        onChange={vi.fn()}
        aria-label="Project"
        placeholder="Choose a project"
      />,
    )

    expect(trigger('Project')).toHaveTextContent('Choose a project')
  })
})

describe('StatusSelect keeps working alongside them', () => {
  it('renders the status name', async () => {
    render(<ControlledStatus />)

    await openAndPick('Status', 'In progress')

    expect(trigger('Status')).toHaveTextContent('In progress')
  })
})