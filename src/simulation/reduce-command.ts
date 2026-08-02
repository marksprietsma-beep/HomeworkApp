import type { GameCommand, GameState } from '../domain/game-state'

/** Pure state transition: no React, browser APIs, I/O, clocks, or ambient randomness. */
export function reduceCommand(state: GameState, command: GameCommand): GameState {
  switch (command.type) {
    case 'advance-day':
      return { ...state, day: state.day + 1 }
  }
}
