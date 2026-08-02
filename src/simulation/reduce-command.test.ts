import { describe, expect, it } from 'vitest'
import type { GameState } from '../domain/game-state'
import { reduceCommand } from './reduce-command'

describe('reduceCommand', () => {
  it('returns a new state when advancing the day', () => {
    const state: GameState = {
      version: 1,
      day: 1,
      world: { version: 1, id: 'test-world', name: 'Test World' },
    }

    expect(reduceCommand(state, { type: 'advance-day' })).toEqual({ ...state, day: 2 })
    expect(state.day).toBe(1)
  })
})
