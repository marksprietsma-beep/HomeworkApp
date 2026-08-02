/** Persisted world data. Increment the version only with an accompanying migration. */
export interface GameWorld {
  readonly version: 1
  readonly id: string
  readonly name: string
}
