import type { GameWorld } from '../domain/game-world'

export interface WorldGenerationRequest {
  readonly seed: string
  readonly name: string
}

/** Adapter boundary for future world generators. No provider is selected in v0.1. */
export interface WorldGeneratorProvider {
  readonly id: string
  generate(request: WorldGenerationRequest): Promise<GameWorld>
}
