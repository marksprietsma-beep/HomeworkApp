export const PublicationIntent: Readonly<{
  DRAFT: "DRAFT";
  PUBLISH: "PUBLISH";
}>;

export type PublicationIntentValue = typeof PublicationIntent[keyof typeof PublicationIntent];

export function parsePublicationIntent(value: unknown): PublicationIntentValue | null;
export function statusForPublicationIntent(intent: PublicationIntentValue): "DRAFT" | "PUBLISHED";
