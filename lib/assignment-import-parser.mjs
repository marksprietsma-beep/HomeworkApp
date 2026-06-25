const FORMAT_VERSION = "assignment-import-v1";
const ALLOWED_STATUSES = new Set(["DRAFT", "PUBLISHED"]);
const ALLOWED_QUESTION_TYPES = new Set(["OPEN_TEXT", "MULTIPLE_CHOICE"]);
const ALLOWED_RESPONSE_MODES = new Set(["TEXT", "PSEUDOCODE"]);
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

function validateParsedJson(value) {
  const errors = [];

  if (!isPlainObject(value)) {
    return { ok: false, assignment: null, errors: [error("$", "invalid_type", "Root value must be a JSON object")] };
  }

  addUnknownFieldErrors(errors, "$", value, new Set(["formatVersion", "assignment"]));

  if (value.formatVersion !== FORMAT_VERSION) {
    errors.push(error("$.formatVersion", "invalid_value", `formatVersion must be ${FORMAT_VERSION}`));
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

    addUnknownFieldErrors(errors, questionPath, question, new Set(["id", "order", "type", "prompt", "text", "textI18n", "points", "options", "image", "responseMode"]));

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
      errors.push(error(`${questionPath}.responseMode`, "invalid_value", `${questionPath}.responseMode must be TEXT or PSEUDOCODE when present`));
    }

    const options = validateOptions(question, questionPath, errors);
    const image = validateImage(question.image, `${questionPath}.image`, errors);

    normalizedQuestions.push({
      id: trimmed(question.id),
      order: question.order,
      type: question.type,
      responseMode: question.responseMode ?? "TEXT",
      prompt: trimmed(questionPrompt),
      textI18n,
      points: question.points ?? null,
      options: options ?? [],
      image,
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

export function parseAssignmentImportJson(rawJsonText) {
  if (typeof rawJsonText !== "string") {
    return { ok: false, assignment: null, errors: [error("$", "invalid_type", "Input must be raw JSON text as a string")] };
  }

  let parsed;
  try {
    parsed = JSON.parse(rawJsonText);
  } catch (parseError) {
    return {
      ok: false,
      assignment: null,
      errors: [error("$", "invalid_json", `Input is not valid JSON: ${parseError.message}`)],
    };
  }

  return validateParsedJson(parsed);
}

export { FORMAT_VERSION, ALLOWED_STATUSES, ALLOWED_QUESTION_TYPES, ALLOWED_RESPONSE_MODES };
