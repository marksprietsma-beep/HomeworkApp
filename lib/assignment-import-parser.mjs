const FORMAT_VERSION = "assignment-import-v1";
const FORMAT_VERSION_V2 = "assignment-import-v2";
const ALLOWED_STATUSES = new Set(["DRAFT", "PUBLISHED"]);
const ALLOWED_QUESTION_TYPES = new Set(["OPEN_TEXT", "MULTIPLE_CHOICE"]);
const ALLOWED_RESPONSE_MODES = new Set(["TEXT", "PSEUDOCODE", "STRUCTURED"]);
const ID_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const ALLOWED_PSEUDOCODE_DIALECTS = new Set(["CAMBRIDGE_9618_2026"]);
const MAX_IMPORT_BYTES = 1_000_000;
const GLOSSARY_FIELDS = new Set(["englishTerm", "chineseTerm", "englishDefinition", "chineseDefinition", "termI18n", "definitionI18n", "category", "questionIds"]);

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function trimmed(value) {
  return typeof value === "string" ? value.trim() : value;
}

function error(path, code, message) {
  return { path, code, message };
}

function addUnknownFieldErrors(errors, path, value, allowedFields) {
  for (const field of Object.keys(value)) {
    if (!allowedFields.has(field)) {
      errors.push(error(`${path}.${field}`, "unknown_field", `${path} must not include unknown field \"${field}\"`));
    }
  }
}

function validateI18nText(value, path, errors) {
  if (value === undefined || value === null) {
    return null;
  }

  if (!isPlainObject(value)) {
    errors.push(error(path, "invalid_type", `${path} must be an object with optional en and zh string fields`));
    return null;
  }

  addUnknownFieldErrors(errors, path, value, new Set(["en", "zh"]));

  for (const field of ["en", "zh"]) {
    if (field in value && typeof value[field] !== "string") {
      errors.push(error(`${path}.${field}`, "invalid_type", `${path}.${field} must be a string when present`));
    }
  }

  return {
    en: typeof value.en === "string" ? value.en.trim() : "",
    zh: typeof value.zh === "string" ? value.zh.trim() : "",
  };
}

function isValidLocalDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function validateImage(image, path, errors) {
  if (image === undefined || image === null) {
    return null;
  }

  if (!isPlainObject(image)) {
    errors.push(error(path, "invalid_type", `${path} must be an object or null`));
    return null;
  }

  addUnknownFieldErrors(errors, path, image, new Set(["path", "caption", "altText"]));

  if (!isNonEmptyString(image.path)) {
    errors.push(error(`${path}.path`, "required", `${path}.path must be a non-empty string`));
  }

  for (const optionalField of ["caption", "altText"]) {
    if (optionalField in image && typeof image[optionalField] !== "string") {
      errors.push(error(`${path}.${optionalField}`, "invalid_type", `${path}.${optionalField} must be a string when present`));
    }
  }

  if (errors.some((item) => item.path === path || item.path.startsWith(`${path}.`))) {
    return null;
  }

  return {
    path: image.path.trim(),
    caption: typeof image.caption === "string" ? image.caption.trim() : "",
    altText: typeof image.altText === "string" ? image.altText.trim() : "",
  };
}

function validateOptions(question, questionPath, errors) {
  if (question.type !== "MULTIPLE_CHOICE") {
    if ("options" in question) {
      errors.push(error(`${questionPath}.options`, "unexpected_options", `${questionPath}.options must be omitted unless type is MULTIPLE_CHOICE`));
    }
    return undefined;
  }

  if (!Array.isArray(question.options) || question.options.length < 2) {
    errors.push(error(`${questionPath}.options`, "required", `${questionPath}.options must contain at least two options`));
    return [];
  }

  const seenOptionIds = new Set();
  const normalizedOptions = [];

  question.options.forEach((option, index) => {
    const optionPath = `${questionPath}.options[${index}]`;
    if (!isPlainObject(option)) {
      errors.push(error(optionPath, "invalid_type", `${optionPath} must be an object`));
      return;
    }

    addUnknownFieldErrors(errors, optionPath, option, new Set(["id", "text", "textI18n"]));

    if (!isNonEmptyString(option.id)) {
      errors.push(error(`${optionPath}.id`, "required", `${optionPath}.id must be a non-empty string`));
    } else if (seenOptionIds.has(option.id.trim())) {
      errors.push(error(`${optionPath}.id`, "duplicate", `${optionPath}.id duplicates \"${option.id.trim()}\"`));
    } else {
      seenOptionIds.add(option.id.trim());
    }

    if (!isNonEmptyString(option.text)) {
      errors.push(error(`${optionPath}.text`, "required", `${optionPath}.text must be a non-empty string`));
    }
    const textI18n = validateI18nText(option.textI18n, `${optionPath}.textI18n`, errors);

    normalizedOptions.push({ id: trimmed(option.id), text: trimmed(option.text), textI18n });
  });

  return normalizedOptions;
}

function validateGlossary(value, path, errors, questionIds) {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    errors.push(error(path, "invalid_type", `${path} must be an array when present`));
    return [];
  }

  const normalized = [];

  value.forEach((item, index) => {
    const itemPath = `${path}[${index}]`;
    if (!isPlainObject(item)) {
      errors.push(error(itemPath, "invalid_type", `${itemPath} must be an object`));
      return;
    }

    addUnknownFieldErrors(errors, itemPath, item, GLOSSARY_FIELDS);

    const termI18n = validateI18nText(item.termI18n, `${itemPath}.termI18n`, errors);
    const definitionI18n = validateI18nText(item.definitionI18n, `${itemPath}.definitionI18n`, errors);

    for (const field of ["englishTerm", "englishDefinition"]) {
      if (!isNonEmptyString(item[field])) {
        errors.push(error(`${itemPath}.${field}`, "required", `${itemPath}.${field} must be a non-empty string`));
      }
    }
    for (const field of ["chineseTerm", "chineseDefinition"]) {
      if (field in item && typeof item[field] !== "string") {
        errors.push(error(`${itemPath}.${field}`, "invalid_type", `${itemPath}.${field} must be a string when present`));
      }
    }

    if (item.category !== undefined && item.category !== null && typeof item.category !== "string") {
      errors.push(error(`${itemPath}.category`, "invalid_type", `${itemPath}.category must be a string, null, or omitted`));
    }

    const normalizedQuestionIds = [];
    if (item.questionIds !== undefined) {
      if (!Array.isArray(item.questionIds)) {
        errors.push(error(`${itemPath}.questionIds`, "invalid_type", `${itemPath}.questionIds must be an array of question id strings when present`));
      } else {
        const seenLinkedIds = new Set();
        item.questionIds.forEach((questionId, questionIdIndex) => {
          const questionIdPath = `${itemPath}.questionIds[${questionIdIndex}]`;
          if (!isNonEmptyString(questionId)) {
            errors.push(error(questionIdPath, "invalid_type", `${questionIdPath} must be a non-empty string`));
            return;
          }
          const trimmedQuestionId = questionId.trim();
          if (seenLinkedIds.has(trimmedQuestionId)) {
            errors.push(error(questionIdPath, "duplicate", `${questionIdPath} duplicates "${trimmedQuestionId}"`));
            return;
          }
          seenLinkedIds.add(trimmedQuestionId);
          if (!questionIds.has(trimmedQuestionId)) {
            errors.push(error(questionIdPath, "unknown_reference", `${questionIdPath} must match an assignment question id`));
            return;
          }
          normalizedQuestionIds.push(trimmedQuestionId);
        });
      }
    }

    normalized.push({
      englishTerm: trimmed(item.englishTerm),
      chineseTerm: typeof item.chineseTerm === "string" ? item.chineseTerm.trim() : termI18n?.zh ?? "",
      englishDefinition: trimmed(item.englishDefinition),
      chineseDefinition: typeof item.chineseDefinition === "string" ? item.chineseDefinition.trim() : definitionI18n?.zh ?? "",
      termI18n,
      definitionI18n,
      category: isNonEmptyString(item.category) ? item.category.trim() : null,
      questionIds: normalizedQuestionIds,
    });
  });

  return normalized;
}

function validateStructuredSchema(value, path, errors) {
  if (!isPlainObject(value)) {
    errors.push(error(path, "invalid_type", `${path} must be an object`));
    return null;
  }
  addUnknownFieldErrors(errors, path, value, new Set(["schemaVersion", "kind", "instructions", "title", "columns", "rows", "entries"]));
  if (value.schemaVersion !== 1) errors.push(error(`${path}.schemaVersion`, "invalid_value", `${path}.schemaVersion must be 1`));
  if (value.instructions !== undefined && typeof value.instructions !== "string") errors.push(error(`${path}.instructions`, "invalid_type", `${path}.instructions must be a string`));
  const validId = (id, idPath, seen) => {
    if (typeof id !== "string" || !ID_PATTERN.test(id)) errors.push(error(idPath, "invalid_value", `${idPath} must be a stable ID starting with a letter`));
    else if (seen.has(id)) errors.push(error(idPath, "duplicate", `${idPath} duplicates "${id}"`));
    else seen.add(id);
  };
  const validateCell = (cell, cellPath) => {
    if (!isPlainObject(cell)) { errors.push(error(cellPath, "invalid_type", `${cellPath} must be an object`)); return; }
    addUnknownFieldErrors(errors, cellPath, cell, new Set(["editable", "inputType", "value", "blank"]));
    if (cell.editable !== undefined && typeof cell.editable !== "boolean") errors.push(error(`${cellPath}.editable`, "invalid_type", `${cellPath}.editable must be boolean`));
    if (cell.inputType !== undefined && !["text", "number", "currency"].includes(cell.inputType)) errors.push(error(`${cellPath}.inputType`, "invalid_value", `${cellPath}.inputType must be text, number, or currency`));
    if (cell.value !== undefined && typeof cell.value !== "string") errors.push(error(`${cellPath}.value`, "invalid_type", `${cellPath}.value must be a string`));
    if (cell.blank !== undefined && typeof cell.blank !== "boolean") errors.push(error(`${cellPath}.blank`, "invalid_type", `${cellPath}.blank must be boolean`));
    if (cell.editable && (cell.blank || cell.value !== undefined)) errors.push(error(cellPath, "invalid_value", `${cellPath} cannot be editable and static/blank`));
  };
  const fieldIds = new Set();
  if (value.kind === "table") {
    if (!Array.isArray(value.columns) || value.columns.length < 2 || value.columns.length > 12) errors.push(error(`${path}.columns`, "invalid_value", `${path}.columns must contain 2 to 12 columns`));
    if (!Array.isArray(value.rows) || value.rows.length < 1 || value.rows.length > 200) errors.push(error(`${path}.rows`, "invalid_value", `${path}.rows must contain 1 to 200 rows`));
    const columns = new Set();
    (Array.isArray(value.columns) ? value.columns : []).forEach((column, index) => { const p = `${path}.columns[${index}]`; if (!isPlainObject(column)) { errors.push(error(p, "invalid_type", `${p} must be an object`)); return; } addUnknownFieldErrors(errors, p, column, new Set(["id", "label", "align", "width"])); validId(column.id, `${p}.id`, columns); if (typeof column.label !== "string") errors.push(error(`${p}.label`, "invalid_type", `${p}.label must be a string`)); if (column.align !== undefined && !["left", "center", "right"].includes(column.align)) errors.push(error(`${p}.align`, "invalid_value", `${p}.align is invalid`)); if (column.width !== undefined && !["label", "narrow", "normal", "wide"].includes(column.width)) errors.push(error(`${p}.width`, "invalid_value", `${p}.width is invalid`)); });
    const rows = new Set();
    (Array.isArray(value.rows) ? value.rows : []).forEach((row, index) => { const p = `${path}.rows[${index}]`; if (!isPlainObject(row)) { errors.push(error(p, "invalid_type", `${p} must be an object`)); return; } addUnknownFieldErrors(errors, p, row, new Set(["id", "label", "style", "cells"])); validId(row.id, `${p}.id`, rows); if (typeof row.label !== "string") errors.push(error(`${p}.label`, "invalid_type", `${p}.label must be a string`)); if (row.style !== undefined && !["normal", "section_header", "subtotal", "total", "spacer"].includes(row.style)) errors.push(error(`${p}.style`, "invalid_value", `${p}.style is invalid`)); if (row.cells !== undefined && !isPlainObject(row.cells)) errors.push(error(`${p}.cells`, "invalid_type", `${p}.cells must be an object`)); else Object.entries(row.cells ?? {}).forEach(([columnId, cell]) => { const cp = `${p}.cells.${columnId}`; if (!columns.has(columnId)) errors.push(error(cp, "unknown_reference", `${cp} refers to an unknown column`)); validateCell(cell, cp); if (cell?.editable) { const id = `${row.id}.${columnId}`; if (fieldIds.has(id)) errors.push(error(cp, "duplicate", `editable field ${id} is duplicated`)); fieldIds.add(id); } }); });
  } else if (value.kind === "t_account") {
    if (!isNonEmptyString(value.title)) errors.push(error(`${path}.title`, "required", `${path}.title must be a non-empty string`));
    if (!Array.isArray(value.entries) || value.entries.length < 1 || value.entries.length > 200) errors.push(error(`${path}.entries`, "invalid_value", `${path}.entries must contain 1 to 200 entries`));
    const entries = new Set();
    (Array.isArray(value.entries) ? value.entries : []).forEach((entry, index) => { const p = `${path}.entries[${index}]`; if (!isPlainObject(entry)) { errors.push(error(p, "invalid_type", `${p} must be an object`)); return; } addUnknownFieldErrors(errors, p, entry, new Set(["id", "side", "label", "detail", "amount"])); validId(entry.id, `${p}.id`, entries); if (!["debit", "credit"].includes(entry.side)) errors.push(error(`${p}.side`, "invalid_value", `${p}.side must be debit or credit`)); if (!isNonEmptyString(entry.label)) errors.push(error(`${p}.label`, "required", `${p}.label must be a non-empty string`)); for (const key of ["detail", "amount"]) if (entry[key] !== undefined) { validateCell(entry[key], `${p}.${key}`); if (entry[key]?.editable) fieldIds.add(`${entry.id}.${key}`); } });
  } else errors.push(error(`${path}.kind`, "invalid_value", `${path}.kind must be table or t_account`));
  if (fieldIds.size < 1) errors.push(error(path, "required", `${path} must define at least one editable field`));
  if (fieldIds.size > 300) errors.push(error(path, "too_many_fields", `${path} has too many editable fields; the maximum is 300`));
  return value;
}

function validateParsedJson(value) {
  const errors = [];

  if (!isPlainObject(value)) {
    return { ok: false, assignment: null, errors: [error("$", "invalid_type", "Root value must be a JSON object")] };
  }

  addUnknownFieldErrors(errors, "$", value, new Set(["formatVersion", "assignment"]));

  const isV2 = value.formatVersion === FORMAT_VERSION_V2;
  if (value.formatVersion !== FORMAT_VERSION && !isV2) {
    errors.push(error("$.formatVersion", "invalid_value", `formatVersion must be ${FORMAT_VERSION} or ${FORMAT_VERSION_V2}`));
  }

  if (!isPlainObject(value.assignment)) {
    errors.push(error("$.assignment", "required", "assignment must be an object"));
    return { ok: false, assignment: null, errors };
  }

  const assignment = value.assignment;
  addUnknownFieldErrors(errors, "$.assignment", assignment, new Set(["title", "titleI18n", "instructions", "instructionsI18n", "dueDate", "status", "questions", "keyVocabulary", "glossary"]));

  if (assignment.keyVocabulary !== undefined && assignment.glossary !== undefined) {
    errors.push(error("$.assignment.glossary", "duplicate", "assignment must use either keyVocabulary or glossary, not both"));
  }

  if (!isNonEmptyString(assignment.title)) {
    errors.push(error("$.assignment.title", "required", "assignment.title must be a non-empty string"));
  }
  if (!isNonEmptyString(assignment.instructions)) {
    errors.push(error("$.assignment.instructions", "required", "assignment.instructions must be a non-empty string"));
  }
  const titleI18n = validateI18nText(assignment.titleI18n, "$.assignment.titleI18n", errors);
  const instructionsI18n = validateI18nText(assignment.instructionsI18n, "$.assignment.instructionsI18n", errors);
  if (assignment.dueDate !== undefined && assignment.dueDate !== null && !isValidLocalDate(assignment.dueDate)) {
    errors.push(error("$.assignment.dueDate", "invalid_value", "assignment.dueDate must be a real YYYY-MM-DD date, null, or omitted"));
  }
  if (!ALLOWED_STATUSES.has(assignment.status)) {
    errors.push(error("$.assignment.status", "invalid_value", "assignment.status must be DRAFT or PUBLISHED"));
  }
  if (!Array.isArray(assignment.questions) || assignment.questions.length === 0) {
    errors.push(error("$.assignment.questions", "required", "assignment.questions must be a non-empty array"));
    return { ok: false, assignment: null, errors };
  }

  const seenQuestionIds = new Set();
  const seenOrders = new Set();
  const normalizedQuestions = [];

  assignment.questions.forEach((question, index) => {
    const questionPath = `$.assignment.questions[${index}]`;
    if (!isPlainObject(question)) {
      errors.push(error(questionPath, "invalid_type", `${questionPath} must be an object`));
      return;
    }

    addUnknownFieldErrors(errors, questionPath, question, new Set(["id", "order", "type", "prompt", "text", "textI18n", "points", "options", "image", "responseMode", "pseudocodeDialect", ...(isV2 ? ["responseSchema"] : [])]));

    if (!isNonEmptyString(question.id)) {
      errors.push(error(`${questionPath}.id`, "required", `${questionPath}.id must be a non-empty string`));
    } else if (seenQuestionIds.has(question.id.trim())) {
      errors.push(error(`${questionPath}.id`, "duplicate", `${questionPath}.id duplicates \"${question.id.trim()}\"`));
    } else {
      seenQuestionIds.add(question.id.trim());
    }

    if (!Number.isInteger(question.order) || question.order < 1) {
      errors.push(error(`${questionPath}.order`, "invalid_value", `${questionPath}.order must be a positive integer`));
    } else if (seenOrders.has(question.order)) {
      errors.push(error(`${questionPath}.order`, "duplicate", `${questionPath}.order duplicates ${question.order}`));
    } else {
      seenOrders.add(question.order);
    }

    if (!ALLOWED_QUESTION_TYPES.has(question.type)) {
      errors.push(error(`${questionPath}.type`, "invalid_value", `${questionPath}.type must be OPEN_TEXT or MULTIPLE_CHOICE`));
    }
    const questionPrompt = isNonEmptyString(question.prompt) ? question.prompt : question.text;
    if (!isNonEmptyString(questionPrompt)) {
      errors.push(error(`${questionPath}.prompt`, "required", `${questionPath}.prompt must be a non-empty string`));
    }
    const textI18n = validateI18nText(question.textI18n, `${questionPath}.textI18n`, errors);
    if (question.points !== undefined && (!Number.isInteger(question.points) || question.points < 1)) {
      errors.push(error(`${questionPath}.points`, "invalid_value", `${questionPath}.points must be a positive integer when present`));
    }

    if (question.responseMode !== undefined && !ALLOWED_RESPONSE_MODES.has(question.responseMode)) {
      errors.push(error(`${questionPath}.responseMode`, "invalid_value", `${questionPath}.responseMode must be TEXT, PSEUDOCODE, or STRUCTURED when present`));
    }
    if (question.pseudocodeDialect !== undefined && !ALLOWED_PSEUDOCODE_DIALECTS.has(question.pseudocodeDialect)) {
      errors.push(error(`${questionPath}.pseudocodeDialect`, "invalid_value", `${questionPath}.pseudocodeDialect must be CAMBRIDGE_9618_2026 when present`));
    }

    if (!isV2 && question.responseMode === "STRUCTURED") errors.push(error(`${questionPath}.responseMode`, "invalid_value", "STRUCTURED requires assignment-import-v2"));
    if (question.responseMode === "STRUCTURED" && question.type !== "OPEN_TEXT") errors.push(error(`${questionPath}.responseMode`, "invalid_value", "STRUCTURED responses must use type OPEN_TEXT"));
    if (question.responseMode === "STRUCTURED" && question.responseSchema === undefined) errors.push(error(`${questionPath}.responseSchema`, "required", `${questionPath}.responseSchema is required for STRUCTURED responses`));
    if (question.responseMode !== "STRUCTURED" && question.responseSchema !== undefined) errors.push(error(`${questionPath}.responseSchema`, "unexpected", `${questionPath}.responseSchema is only allowed for STRUCTURED responses`));
    const responseSchema = question.responseMode === "STRUCTURED" ? validateStructuredSchema(question.responseSchema, `${questionPath}.responseSchema`, errors) : null;

    const options = validateOptions(question, questionPath, errors);
    const image = validateImage(question.image, `${questionPath}.image`, errors);

    normalizedQuestions.push({
      id: trimmed(question.id),
      order: question.order,
      type: question.type,
      responseMode: question.responseMode ?? "TEXT",
      pseudocodeDialect: question.responseMode === "PSEUDOCODE" ? question.pseudocodeDialect ?? "CAMBRIDGE_9618_2026" : question.pseudocodeDialect ?? null,
      prompt: trimmed(questionPrompt),
      textI18n,
      points: question.points ?? null,
      options: options ?? [],
      image,
      responseSchema,
    });
  });

  const glossarySource = assignment.keyVocabulary !== undefined ? assignment.keyVocabulary : assignment.glossary;
  const normalizedKeyVocabulary = validateGlossary(glossarySource, assignment.keyVocabulary !== undefined ? "$.assignment.keyVocabulary" : "$.assignment.glossary", errors, seenQuestionIds);

  for (let expectedOrder = 1; expectedOrder <= assignment.questions.length; expectedOrder += 1) {
    if (!seenOrders.has(expectedOrder)) {
      errors.push(error("$.assignment.questions", "invalid_order", `question orders must be sequential; missing ${expectedOrder}`));
    }
  }

  if (errors.length > 0) {
    return { ok: false, assignment: null, errors };
  }

  return {
    ok: true,
    errors: [],
    assignment: {
      title: assignment.title.trim(),
      titleI18n,
      instructions: assignment.instructions.trim(),
      instructionsI18n,
      dueDate: assignment.dueDate ?? null,
      status: assignment.status,
      questions: normalizedQuestions.sort((left, right) => left.order - right.order),
      keyVocabulary: normalizedKeyVocabulary,
    },
  };
}

function parseErrorPosition(parseError) {
  const match = /position (\d+)/i.exec(parseError.message);
  return match ? Number(match[1]) : null;
}

function removeTrailingCommas(text) {
  let result = "";
  let inString = false;
  let escaped = false;
  let changed = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (inString) {
      result += character;
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    if (character === ",") {
      let next = index + 1;
      while (/\s/.test(text[next] ?? "")) next += 1;
      if (text[next] === "}" || text[next] === "]") {
        changed = true;
        continue;
      }
    }
    result += character;
  }
  return changed ? result : text;
}

function initialRecoveryCandidate(text) {
  let candidate = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(candidate);
  if (fenced) candidate = fenced[1].trim();
  const firstBrace = candidate.indexOf("{");
  const lastBrace = candidate.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) candidate = candidate.slice(firstBrace, lastBrace + 1);
  return removeTrailingCommas(candidate);
}

function repairOneUnescapedQuote(text, parseError, hasOpenRepair) {
  const followsPrematureStringEnd = /Expected ',' or '}' after property value|Unexpected non-whitespace character after JSON/i.test(parseError.message);
  const commaFollowedByStringContent = hasOpenRepair && /Expected double-quoted property name/i.test(parseError.message);
  if (!followsPrematureStringEnd && !commaFollowedByStringContent) return null;
  const position = parseErrorPosition(parseError);
  if (position === null || position <= 0) return null;
  let quote = position - 1;
  while (quote >= 0 && text[quote] !== '"') quote -= 1;
  if (quote < 0) return null;
  let slashes = 0;
  for (let cursor = quote - 1; cursor >= 0 && text[cursor] === "\\"; cursor -= 1) slashes += 1;
  if (slashes % 2 === 1) return null;
  const intervening = text.slice(quote + 1, position);
  const startsUnexpectedText = position === quote + 1 && /[\p{L}\p{N}]/u.test(text[position] ?? "");
  if (!hasOpenRepair && !/\S/.test(intervening) && !startsUnexpectedText) return null;
  return `${text.slice(0, quote)}\\"${text.slice(quote + 1)}`;
}

function recoverJson(text) {
  let candidate = initialRecoveryCandidate(text);
  let hasOpenRepair = false;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      const parsed = JSON.parse(candidate);
      return hasOpenRepair ? null : { parsed, repairedJson: candidate };
    } catch (parseError) {
      const repaired = repairOneUnescapedQuote(candidate, parseError, hasOpenRepair);
      if (!repaired || repaired === candidate) return null;
      candidate = repaired;
      hasOpenRepair = !hasOpenRepair;
    }
  }
  return null;
}

function invalidJsonError(rawJsonText, parseError) {
  const position = parseErrorPosition(parseError);
  const line = position === null ? null : rawJsonText.slice(0, position).split("\n").length;
  const before = position === null ? rawJsonText : rawJsonText.slice(0, position);
  const questionMatches = [...before.matchAll(/"id"\s*:\s*"([^"]+)"/g)];
  const questionId = questionMatches.at(-1)?.[1] ?? null;
  const location = questionId ? ` near question ${questionId}` : line ? ` near line ${line}` : "";
  return error("$", "invalid_json", `We couldn't read this assignment because the JSON formatting is broken${location}. A quotation mark or comma may be missing or unescaped. Paste a corrected version, or use the ChatGPT assignment prompt again. Technical details: ${parseError.message}`);
}

export function parseAssignmentImportJson(rawJsonText) {
  if (typeof rawJsonText !== "string") {
    return { ok: false, assignment: null, errors: [error("$", "invalid_type", "Input must be raw JSON text as a string")] };
  }
  if (new TextEncoder().encode(rawJsonText).length > MAX_IMPORT_BYTES) {
    return { ok: false, assignment: null, errors: [error("$", "too_large", "This assignment JSON is too large to import. Keep it under 1 MB.")] };
  }

  let parsed;
  let repairedJson = null;
  try {
    parsed = JSON.parse(rawJsonText);
  } catch (parseError) {
    const recovered = recoverJson(rawJsonText);
    if (!recovered) return { ok: false, assignment: null, errors: [invalidJsonError(rawJsonText, parseError)] };
    parsed = recovered.parsed;
    repairedJson = recovered.repairedJson;
  }

  const validation = validateParsedJson(parsed);
  if (!validation.ok || repairedJson === null) return validation;
  return { ...validation, repaired: true, repairedJson };
}

export { FORMAT_VERSION, FORMAT_VERSION_V2, ALLOWED_STATUSES, ALLOWED_QUESTION_TYPES, ALLOWED_RESPONSE_MODES, ALLOWED_PSEUDOCODE_DIALECTS };
