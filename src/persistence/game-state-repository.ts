import type { GameState } from '../domain/game-state'

/** Port implemented by browser storage adapters; domain code never accesses storage directly. */
export interface GameStateRepository {
  load(campaignId: string): Promise<GameState | null>
  save(campaignId: string, state: GameState): Promise<void>
}
