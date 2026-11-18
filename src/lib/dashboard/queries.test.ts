import { describe, expect, it } from 'vitest'

import { validateSelect } from '@/lib/data/validate'
import type { SharedDb } from '@/lib/db/types'
import { loadActivity } from './queries'

/**
 * loadActivity runs in the browser through the data API, which rejects
 * any embed not listed in src/lib/data/registry.ts (400 "Embedding X is
 * not allowed"). This fake records every query and runs its select
 * through the API's own validator, so a disallowed embed fails here
 * instead of silently emptying the Home feed.
 */
interface Call {
  table: string
  select: string
  filters: [string, string, unknown][]
}

function fakeDb(rows: Record<string, unknown[]>) {
  const calls: Call[] = []
  const db = {
    from(table: string) {
      const call: Call = { table, select: '*', filters: [] }
      calls.push(call)
      const builder = {
        select(sel: string) {
          call.select = sel
          return builder
        },
        eq(col: string, val: unknown) {
          call.filters.push(['eq', col, val])
          return builder
        },
        in(col: string, val: unknown) {
          call.filters.push(['in', col, val])
          return builder
        },
        order: () => builder,
        limit: () => builder,
        then(resolve: (r: { data: unknown[]; error: null }) => unknown) {
          let data = rows[table] ?? []
          const ids = call.filters.find(([op, col]) => op === 'in' && col === 'id')?.[2] as string[] | undefined
          if (ids) data = data.filter((r) => ids.includes((r as { id: string }).id))
          return Promise.resolve({ data, error: null }).then(resolve)
        },
      }
      return builder
    },
  }
  return { db: db as unknown as SharedDb, calls }
}

const now = Date.now()
const at = (minAgo: number) => new Date(now - minAgo * 60_000).toISOString()

describe('loadActivity', () => {
  it('only issues selects the data API allows', async () => {
    const { db, calls } = fakeDb({
      messages: [{ id: 'm1', created_at: at(1), conversation_id: 'c1' }],
      automation_logs: [
        { id: 'l1', trigger_event: 'message_received', status: 'success', created_at: at(2), automation_id: 'a1', contact: null },
      ],
      conversations: [{ id: 'c1', contacts: { name: 'Ananya', phone: '+91' } }],
      automations: [{ id: 'a1', name: 'Welcome' }],
    })
    await loadActivity(db, 20)
    expect(calls.map((c) => c.table).sort()).toEqual(
      ['automation_logs', 'automations', 'broadcasts', 'contacts', 'conversations', 'deals', 'messages'],
    )
    for (const c of calls) {
      expect(() => validateSelect(c.table, c.select), `${c.table}: ${c.select}`).not.toThrow()
    }
  })

  it('names the contact on message items and the automation on automation items', async () => {
    const { db, calls } = fakeDb({
      messages: [
        { id: 'm1', created_at: at(1), conversation_id: 'c1' },
        { id: 'm2', created_at: at(3), conversation_id: 'c2' },
      ],
      conversations: [
        { id: 'c1', contacts: { name: 'Ananya Iyer', phone: '+919845010731' } },
        { id: 'c2', contacts: [{ name: null, phone: '+919845011462' }] },
      ],
      automation_logs: [
        {
          id: 'l1',
          trigger_event: 'message_received',
          status: 'failed',
          created_at: at(2),
          automation_id: 'a1',
          contact: { name: 'Rohan Mehta', phone: '+91' },
        },
      ],
      automations: [{ id: 'a1', name: 'Welcome reply' }],
    })

    const items = await loadActivity(db, 20)
    const text = items.map((i) => i.text).join('\n')
    expect(text).toContain('Ananya Iyer')
    expect(text).toContain('+919845011462') // no name → phone
    expect(text).toContain('Welcome reply')
    expect(text).toContain('Rohan Mehta')
    expect(items.find((i) => i.kind === 'message')?.href).toBe('/inbox?c=c1')

    // One batched lookup each, with the distinct ids.
    const conv = calls.find((c) => c.table === 'conversations')
    expect(conv?.filters).toEqual([['in', 'id', ['c1', 'c2']]])
    const auto = calls.find((c) => c.table === 'automations')
    expect(auto?.filters).toEqual([['in', 'id', ['a1']]])
  })

  it('skips the lookups when there is nothing to look up', async () => {
    const { db, calls } = fakeDb({})
    expect(await loadActivity(db, 20)).toEqual([])
    expect(calls.some((c) => c.table === 'conversations' || c.table === 'automations')).toBe(false)
  })
})
