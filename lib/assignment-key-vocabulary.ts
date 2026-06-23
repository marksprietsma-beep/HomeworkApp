export type AssignmentKeyVocabularyItem = {
  englishTerm: string;
  chineseTerm: string;
  englishDefinition: string;
  chineseDefinition: string;
  category: string | null;
  questionIds: string[];
};

export function normalizeAssignmentKeyVocabulary(value: unknown): AssignmentKeyVocabularyItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null && !Array.isArray(item))
    .map((item) => ({
      englishTerm: typeof item.englishTerm === "string" ? item.englishTerm : "",
      chineseTerm: typeof item.chineseTerm === "string" ? item.chineseTerm : "",
      englishDefinition: typeof item.englishDefinition === "string" ? item.englishDefinition : "",
      chineseDefinition: typeof item.chineseDefinition === "string" ? item.chineseDefinition : "",
      category: typeof item.category === "string" ? item.category : null,
      questionIds: Array.isArray(item.questionIds) ? item.questionIds.filter((id): id is string => typeof id === "string") : [],
    }))
    .filter((item) => item.englishTerm && item.chineseTerm && item.englishDefinition && item.chineseDefinition);
}
