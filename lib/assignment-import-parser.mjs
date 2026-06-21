const FORMAT_VERSION = "assignment-import-v1";
const ALLOWED_STATUSES = new Set(["DRAFT", "PUBLISHED"]);
const ALLOWED_QUESTION_TYPES = new Set(["OPEN_TEXT", "LONG_TEXT", "MULTIPLE_CHOICE"]);

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

    addUnknownFieldErrors(errors, optionPath, option, new Set(["id", "text"]));

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

    normalizedOptions.push({ id: trimmed(option.id), text: trimmed(option.text) });
  });

  return normalizedOptions;
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
  addUnknownFieldErrors(errors, "$.assignment", assignment, new Set(["title", "instructions", "dueDate", "status", "questions"]));

  if (!isNonEmptyString(assignment.title)) {
    errors.push(error("$.assignment.title", "required", "assignment.title must be a non-empty string"));
  }
  if (!isNonEmptyString(assignment.instructions)) {
    errors.push(error("$.assignment.instructions", "required", "assignment.instructions must be a non-empty string"));
  }
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

    addUnknownFieldErrors(errors, questionPath, question, new Set(["id", "order", "type", "prompt", "points", "options", "image"]));

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
      errors.push(error(`${questionPath}.type`, "invalid_value", `${questionPath}.type must be OPEN_TEXT, LONG_TEXT, or MULTIPLE_CHOICE`));
    }
    if (!isNonEmptyString(question.prompt)) {
      errors.push(error(`${questionPath}.prompt`, "required", `${questionPath}.prompt must be a non-empty string`));
    }
    if (question.points !== undefined && (!Number.isInteger(question.points) || question.points < 1)) {
      errors.push(error(`${questionPath}.points`, "invalid_value", `${questionPath}.points must be a positive integer when present`));
    }

    const options = validateOptions(question, questionPath, errors);
    const image = validateImage(question.image, `${questionPath}.image`, errors);

    normalizedQuestions.push({
      id: trimmed(question.id),
      order: question.order,
      type: question.type,
      prompt: trimmed(question.prompt),
      points: question.points ?? null,
      options: options ?? [],
      image,
    });
  });

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
      instructions: assignment.instructions.trim(),
      dueDate: assignment.dueDate ?? null,
      status: assignment.status,
      questions: normalizedQuestions.sort((left, right) => left.order - right.order),
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

export { FORMAT_VERSION, ALLOWED_STATUSES, ALLOWED_QUESTION_TYPES };
