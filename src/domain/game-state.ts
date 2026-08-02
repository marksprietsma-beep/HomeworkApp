import type { GameWorld } from './game-world'

export interface GameState {
  readonly version: 1
  readonly world: GameWorld
  readonly day: number
}

export type GameCommand = { readonly type: 'advance-day' }
