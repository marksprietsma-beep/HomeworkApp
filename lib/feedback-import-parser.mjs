const FEEDBACK_FORMAT = "homework-feedback";
const FEEDBACK_VERSION = 1;
const SOURCE_EXPORT_FORMAT = "homework-assignment-responses-v2";
const SOURCE_EXPORT_VERSION = 2;
const FOLLOW_UP_ACTION_TYPES = new Set(["ACKNOWLEDGEMENT", "SHORT_REFLECTION", "ANSWER_FOLLOW_UP_QUESTION"]);
const FOLLOW_UP_ACTION_STATUS = "PENDING";

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}


function error(path, code, message) {
  return { path, code, message };
}

function unknownFieldMessage(path, field) {
  if (path === "$" && field === "participants") {
    return `${path} must not include unknown field "${field}". Use root-level participantFeedback, not participants.`;
  }
  if (path === "$.assignment" && field === "class") {
    return `${path} must not include unknown field "${field}". Use root-level class, not assignment.class.`;
  }
  return `${path} must not include unknown field "${field}"`;
}

function addUnknownFieldErrors(errors, path, value, allowedFields) {
  for (const field of Object.keys(value)) {
    if (!allowedFields.has(field)) {
      errors.push(error(`${path}.${field}`, "unknown_field", unknownFieldMessage(path, field)));
    }
  }
}

function optionalString(value, path, errors, { nullable = false } = {}) {
  if (value === undefined) return undefined;
  if (nullable && value === null) return null;
  if (typeof value !== "string") {
    errors.push(error(path, "invalid_type", `${path} must be a string${nullable ? " or null" : ""} when present`));
    return undefined;
  }
  return value.trim();
}

function requireInteger(value, path, errors) {
  if (!Number.isInteger(value)) {
    errors.push(error(path, "invalid_type", `${path} must be an integer`));
    return null;
  }
  return value;
}

function requireNonEmptyString(value, path, errors, message) {
  if (!isNonEmptyString(value)) {
    errors.push(error(path, "required", message ?? `${path} must be a non-empty string`));
    return "";
  }
  return value.trim();
}

function validateStringList(value, path, errors, { required }) {
  if (value === undefined && !required) return undefined;
  if (!Array.isArray(value) || (required && value.length === 0)) {
    errors.push(error(path, "required", `${path} must be a non-empty array of non-empty strings`));
    return [];
  }
  const normalized = [];
  value.forEach((item, index) => {
    const itemPath = `${path}[${index}]`;
    if (!isNonEmptyString(item)) {
      errors.push(error(itemPath, "required", `${itemPath} must be a non-empty string`));
      return;
    }
    normalized.push(item.trim());
  });
  return normalized;
}

function validateI18nText(value, path, errors) {
  if (value === undefined) return undefined;
  if (!isPlainObject(value)) {
    errors.push(error(path, "invalid_type", `${path} must be an object with optional en and zh string fields when present`));
    return undefined;
  }
  addUnknownFieldErrors(errors, path, value, new Set(["en", "zh"]));
  const normalized = {};
  for (const key of ["en", "zh"]) {
    if (value[key] === undefined) continue;
    if (typeof value[key] !== "string") {
      errors.push(error(`${path}.${key}`, "invalid_type", `${path}.${key} must be a string when present`));
      continue;
    }
    const trimmed = value[key].trim();
    if (trimmed) normalized[key] = trimmed;
  }
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function validateI18nStringList(value, path, errors) {
  if (value === undefined) return undefined;
  if (!isPlainObject(value)) {
    errors.push(error(path, "invalid_type", `${path} must be an object with optional en and zh string array fields when present`));
    return undefined;
  }
  addUnknownFieldErrors(errors, path, value, new Set(["en", "zh"]));
  const normalized = {};
  for (const key of ["en", "zh"]) {
    if (value[key] === undefined) continue;
    if (!Array.isArray(value[key])) {
      errors.push(error(`${path}.${key}`, "invalid_type", `${path}.${key} must be an array of strings when present`));
      continue;
    }
    const items = [];
    value[key].forEach((item, index) => {
      if (typeof item !== "string") {
        errors.push(error(`${path}.${key}[${index}]`, "invalid_type", `${path}.${key}[${index}] must be a string`));
        return;
      }
      const trimmed = item.trim();
      if (trimmed) items.push(trimmed);
    });
    if (items.length > 0) normalized[key] = items;
  }
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function buildContext(rawContext = {}) {
  const assignmentId = rawContext.assignmentId ?? rawContext.assignment?.id ?? null;
  const classId = rawContext.classId ?? rawContext.assignment?.class?.id ?? rawContext.class?.id ?? null;
  const questions = rawContext.questions ?? [];
  const participants = rawContext.participants ?? [];

  return {
    assignmentId,
    classId,
    questionIds: new Set(questions.map((question) => question.id)),
    participantsById: new Map(participants.map((participant) => [participant.id, participant])),
  };
}

function validateFollowUpActions(value, path, errors, seenActionIds) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    errors.push(error(path, "invalid_type", `${path} must be an array when present`));
    return [];
  }

  return value.map((action, index) => {
    const actionPath = `${path}[${index}]`;
    if (!isPlainObject(action)) {
      errors.push(error(actionPath, "invalid_type", `${actionPath} must be an object`));
      return null;
    }
    addUnknownFieldErrors(errors, actionPath, action, new Set(["id", "type", "prompt", "promptI18n", "required"]));

    const id = requireNonEmptyString(action.id, `${actionPath}.id`, errors, `${actionPath}.id must be a non-empty string. Each follow-up action must include a stable string id, for example pf1-q86-action1.`);
    if (id) {
      if (seenActionIds.has(id)) {
        errors.push(error(`${actionPath}.id`, "duplicate", `${actionPath}.id duplicates "${id}"`));
      } else {
        seenActionIds.add(id);
      }
    }
    if (!FOLLOW_UP_ACTION_TYPES.has(action.type)) {
      errors.push(error(`${actionPath}.type`, "invalid_value", `${actionPath}.type must be ACKNOWLEDGEMENT, SHORT_REFLECTION, or ANSWER_FOLLOW_UP_QUESTION`));
    }
    const prompt = requireNonEmptyString(action.prompt, `${actionPath}.prompt`, errors);
    if (action.required !== undefined && typeof action.required !== "boolean") {
      errors.push(error(`${actionPath}.required`, "invalid_type", `${actionPath}.required must be a boolean when present`));
    }

    return { id, type: action.type, prompt, promptI18n: validateI18nText(action.promptI18n, `${actionPath}.promptI18n`, errors), required: action.required ?? true, status: FOLLOW_UP_ACTION_STATUS };
  }).filter(Boolean);
}

function validateFeedbackObject(value, rawContext) {
  const errors = [];
  const context = buildContext(rawContext);
  const seenActionIds = new Set();

  if (!isPlainObject(value)) return { ok: false, feedback: null, errors: [error("$", "invalid_type", "Root value must be a JSON object")] };
  addUnknownFieldErrors(errors, "$", value, new Set(["feedbackFormat", "feedbackVersion", "sourceExport", "assignment", "class", "generatedBy", "generatedAt", "participantFeedback"]));

  if (value.feedbackFormat !== FEEDBACK_FORMAT) errors.push(error("$.feedbackFormat", "invalid_value", `feedbackFormat must be ${FEEDBACK_FORMAT}`));
  if (value.feedbackVersion !== FEEDBACK_VERSION) errors.push(error("$.feedbackVersion", "invalid_value", `feedbackVersion must be integer ${FEEDBACK_VERSION}`));

  const sourceExport = validateSourceExport(value.sourceExport, errors);
  const assignment = validateAssignment(value.assignment, errors, context.assignmentId);
  const klass = validateClass(value.class, errors, context.classId);
  const generatedBy = optionalString(value.generatedBy, "$.generatedBy", errors);
  const generatedAt = optionalString(value.generatedAt, "$.generatedAt", errors);

  if (!Array.isArray(value.participantFeedback) || value.participantFeedback.length === 0) {
    const participantsHint = Array.isArray(value.participants) ? " Use root-level participantFeedback, not participants." : "";
    errors.push(error("$.participantFeedback", "required", `participantFeedback must be a non-empty array.${participantsHint}`));
  }

  const seenParticipantIds = new Set();
  const participantFeedback = Array.isArray(value.participantFeedback)
    ? value.participantFeedback.map((item, index) => validateParticipantFeedback(item, `$.participantFeedback[${index}]`, errors, context, seenParticipantIds, seenActionIds)).filter(Boolean)
    : [];

  if (errors.length > 0) return { ok: false, feedback: null, errors };
  return { ok: true, errors: [], feedback: { feedbackFormat: FEEDBACK_FORMAT, feedbackVersion: FEEDBACK_VERSION, sourceExport, assignment, class: klass, generatedBy, generatedAt, participantFeedback } };
}

function validateSourceExport(value, errors) {
  if (!isPlainObject(value)) {
    errors.push(error("$.sourceExport", "required", "sourceExport must be an object"));
    return null;
  }
  addUnknownFieldErrors(errors, "$.sourceExport", value, new Set(["exportFormat", "exportVersion", "generatedAt"]));
  if (value.exportFormat !== SOURCE_EXPORT_FORMAT) errors.push(error("$.sourceExport.exportFormat", "invalid_value", `sourceExport.exportFormat must be ${SOURCE_EXPORT_FORMAT}`));
  if (value.exportVersion !== SOURCE_EXPORT_VERSION) errors.push(error("$.sourceExport.exportVersion", "invalid_value", `sourceExport.exportVersion must be integer ${SOURCE_EXPORT_VERSION}`));
  return { exportFormat: SOURCE_EXPORT_FORMAT, exportVersion: SOURCE_EXPORT_VERSION, generatedAt: optionalString(value.generatedAt, "$.sourceExport.generatedAt", errors) };
}

function validateAssignment(value, errors, expectedId) {
  if (!isPlainObject(value)) { errors.push(error("$.assignment", "required", "assignment must be an object")); return null; }
  addUnknownFieldErrors(errors, "$.assignment", value, new Set(["id", "title"]));
  const id = requireInteger(value.id, "$.assignment.id", errors);
  if (expectedId !== null && id !== null && id !== expectedId) errors.push(error("$.assignment.id", "mismatch", `assignment.id must match current assignment ${expectedId}`));
  return { id, title: optionalString(value.title, "$.assignment.title", errors) };
}

function validateClass(value, errors, expectedId) {
  if (!isPlainObject(value)) { errors.push(error("$.class", "required", "class must be an object")); return null; }
  addUnknownFieldErrors(errors, "$.class", value, new Set(["id", "name"]));
  const id = requireInteger(value.id, "$.class.id", errors);
  if (expectedId !== null && id !== null && id !== expectedId) errors.push(error("$.class.id", "mismatch", `class.id must match current class ${expectedId}`));
  return { id, name: optionalString(value.name, "$.class.name", errors) };
}

function validateParticipantFeedback(item, path, errors, context, seenParticipantIds, seenActionIds) {
  if (!isPlainObject(item)) { errors.push(error(path, "invalid_type", `${path} must be an object`)); return null; }
  addUnknownFieldErrors(errors, path, item, new Set(["participant", "submission", "overallFeedback", "overallFeedbackI18n", "strengths", "strengthsI18n", "targets", "targetsI18n", "teacherNotes", "questionFeedback", "followUpActions"]));
  if (!isPlainObject(item.participant)) errors.push(error(`${path}.participant`, "required", `${path}.participant must be an object`));
  const participant = isPlainObject(item.participant) ? validateParticipant(item.participant, `${path}.participant`, errors, context, seenParticipantIds) : null;
  const exportedParticipant = participant ? context.participantsById.get(participant.id) : null;
  const submission = validateSubmission(item.submission, `${path}.submission`, errors, exportedParticipant);
  const questionFeedback = validateQuestionFeedback(item.questionFeedback, `${path}.questionFeedback`, errors, context, exportedParticipant, seenActionIds);
  return {
    participant,
    submission,
    overallFeedback: requireNonEmptyString(item.overallFeedback, `${path}.overallFeedback`, errors),
    overallFeedbackI18n: validateI18nText(item.overallFeedbackI18n, `${path}.overallFeedbackI18n`, errors),
    strengths: validateStringList(item.strengths, `${path}.strengths`, errors, { required: true }),
    strengthsI18n: validateI18nStringList(item.strengthsI18n, `${path}.strengthsI18n`, errors),
    targets: validateStringList(item.targets, `${path}.targets`, errors, { required: true }),
    targetsI18n: validateI18nStringList(item.targetsI18n, `${path}.targetsI18n`, errors),
    teacherNotes: optionalString(item.teacherNotes, `${path}.teacherNotes`, errors),
    questionFeedback,
    followUpActions: validateFollowUpActions(item.followUpActions, `${path}.followUpActions`, errors, seenActionIds),
  };
}

function validateParticipant(value, path, errors, context, seenParticipantIds) {
  addUnknownFieldErrors(errors, path, value, new Set(["id", "name", "email"]));
  const id = requireInteger(value.id, `${path}.id`, errors);
  if (id !== null) {
    if (seenParticipantIds.has(id)) errors.push(error(`${path}.id`, "duplicate", `${path}.id duplicates ${id}`));
    seenParticipantIds.add(id);
    if (context.participantsById.size > 0 && !context.participantsById.has(id)) errors.push(error(`${path}.id`, "unknown_reference", `${path}.id must match an exported participant`));
  }
  return { id, name: optionalString(value.name, `${path}.name`, errors), email: optionalString(value.email, `${path}.email`, errors, { nullable: true }) };
}

function validateSubmission(value, path, errors, exportedParticipant) {
  if (value === undefined || value === null) {
    return null;
  }
  if (!isPlainObject(value)) { errors.push(error(path, "invalid_type", `${path} must be an object or null when present`)); return null; }
  addUnknownFieldErrors(errors, path, value, new Set(["id", "status"]));
  const id = requireInteger(value.id, `${path}.id`, errors);
  if (exportedParticipant && exportedParticipant.submission === null) errors.push(error(path, "mismatch", `${path} must be null because the exported participant has no submission`));
  if (exportedParticipant?.submission && id !== null && id !== exportedParticipant.submission.id) errors.push(error(`${path}.id`, "mismatch", `${path}.id must match the exported participant submission ${exportedParticipant.submission.id}`));
  return { id, status: optionalString(value.status, `${path}.status`, errors) };
}

function validateQuestionFeedback(value, path, errors, context, exportedParticipant, seenActionIds) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) { errors.push(error(path, "invalid_type", `${path} must be an array when present`)); return []; }
  const seenQuestionIds = new Set();
  return value.map((question, index) => {
    const questionPath = `${path}[${index}]`;
    if (!isPlainObject(question)) { errors.push(error(questionPath, "invalid_type", `${questionPath} must be an object`)); return null; }
    addUnknownFieldErrors(errors, questionPath, question, new Set(["questionId", "questionOrder", "feedback", "feedbackI18n", "strengths", "strengthsI18n", "targets", "targetsI18n", "teacherNotes", "pseudocodeNotes", "syntaxGuidance", "formattingGuidance", "followUpActions"]));
    const questionId = requireInteger(question.questionId, `${questionPath}.questionId`, errors);
    if (questionId !== null) {
      if (seenQuestionIds.has(questionId)) errors.push(error(`${questionPath}.questionId`, "duplicate", `${questionPath}.questionId duplicates ${questionId}`));
      seenQuestionIds.add(questionId);
      if (context.questionIds.size > 0 && !context.questionIds.has(questionId)) errors.push(error(`${questionPath}.questionId`, "unknown_reference", `${questionPath}.questionId must match an exported assignment question`));
      if (exportedParticipant?.submission === null) errors.push(error(questionPath, "no_submission", `${questionPath} must be omitted because the exported participant has no submission`));
      if (exportedParticipant?.submission?.responsesByQuestionId && !(String(questionId) in exportedParticipant.submission.responsesByQuestionId)) errors.push(error(`${questionPath}.questionId`, "unknown_response", `${questionPath}.questionId must match a response for the exported participant submission`));
    }
    if (question.questionOrder !== undefined && !Number.isInteger(question.questionOrder)) errors.push(error(`${questionPath}.questionOrder`, "invalid_type", `${questionPath}.questionOrder must be an integer when present`));
    return {
      questionId,
      questionOrder: question.questionOrder ?? null,
      feedback: requireNonEmptyString(question.feedback, `${questionPath}.feedback`, errors),
      feedbackI18n: validateI18nText(question.feedbackI18n, `${questionPath}.feedbackI18n`, errors),
      strengths: validateStringList(question.strengths, `${questionPath}.strengths`, errors, { required: false }) ?? [],
      strengthsI18n: validateI18nStringList(question.strengthsI18n, `${questionPath}.strengthsI18n`, errors),
      targets: validateStringList(question.targets, `${questionPath}.targets`, errors, { required: false }) ?? [],
      targetsI18n: validateI18nStringList(question.targetsI18n, `${questionPath}.targetsI18n`, errors),
      teacherNotes: optionalString(question.teacherNotes, `${questionPath}.teacherNotes`, errors),
      pseudocodeNotes: optionalString(question.pseudocodeNotes, `${questionPath}.pseudocodeNotes`, errors),
      syntaxGuidance: optionalString(question.syntaxGuidance, `${questionPath}.syntaxGuidance`, errors),
      formattingGuidance: optionalString(question.formattingGuidance, `${questionPath}.formattingGuidance`, errors),
      followUpActions: validateFollowUpActions(question.followUpActions, `${questionPath}.followUpActions`, errors, seenActionIds),
    };
  }).filter(Boolean);
}

export function parseFeedbackImportJson(rawJsonText, context = {}) {
  if (typeof rawJsonText !== "string") return { ok: false, feedback: null, errors: [error("$", "invalid_type", "Input must be raw JSON text as a string")] };
  let parsed;
  try { parsed = JSON.parse(rawJsonText); } catch (parseError) { return { ok: false, feedback: null, errors: [error("$", "invalid_json", `Input is not valid JSON: ${parseError.message}`)] }; }
  return validateFeedbackObject(parsed, context);
}

export { FEEDBACK_FORMAT, FEEDBACK_VERSION, SOURCE_EXPORT_FORMAT, SOURCE_EXPORT_VERSION, FOLLOW_UP_ACTION_TYPES, FOLLOW_UP_ACTION_STATUS };
