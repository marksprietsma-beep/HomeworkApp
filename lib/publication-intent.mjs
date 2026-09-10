export const PublicationIntent = Object.freeze({
  DRAFT: "DRAFT",
  PUBLISH: "PUBLISH",
});

export function parsePublicationIntent(value) {
  return value === PublicationIntent.DRAFT || value === PublicationIntent.PUBLISH
    ? value
    : null;
}

export function statusForPublicationIntent(intent) {
  return intent === PublicationIntent.PUBLISH ? "PUBLISHED" : "DRAFT";
}
