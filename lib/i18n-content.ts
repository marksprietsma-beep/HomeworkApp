export type LanguageMode = "en" | "zh" | "bilingual";

export type I18nText = {
  en?: string;
  zh?: string;
};

export function normalizeI18nText(value: unknown): I18nText | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const source = value as Record<string, unknown>;
  const en = typeof source.en === "string" ? source.en.trim() : "";
  const zh = typeof source.zh === "string" ? source.zh.trim() : "";

  return en || zh ? { en, zh } : null;
}

export function getLocalizedText(fallback: string, i18n: unknown, mode: Exclude<LanguageMode, "bilingual">) {
  const normalized = normalizeI18nText(i18n);
  if (mode === "zh") {
    return normalized?.zh || normalized?.en || fallback;
  }

  return normalized?.en || fallback;
}

export function getBilingualTextParts(fallback: string, i18n: unknown) {
  const normalized = normalizeI18nText(i18n);
  const english = normalized?.en || fallback;
  const chinese = normalized?.zh || "";

  if (!chinese || chinese === english) {
    return [english].filter(Boolean);
  }

  return [english, chinese].filter(Boolean);
}
