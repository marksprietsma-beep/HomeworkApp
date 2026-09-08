import assert from "node:assert/strict";
import test from "node:test";
import {
  generateTemporaryPassword,
  TEMPORARY_PASSWORD_WORD_LISTS,
} from "../lib/temporary-password";

function deterministicRandomInt(values: number[]) {
  let call = 0;
  return (maxExclusive: number) => {
    const value = values[call++];
    assert.ok(value >= 0 && value < maxExclusive);
    return value;
  };
}

test("temporary passwords have four readable words and a two-digit suffix", () => {
  const password = generateTemporaryPassword(deterministicRandomInt([12, 1, 10, 14, 78]));
  assert.equal(password, "HappyBearGreenMoon88");
  assert.match(password, /^[A-Z][a-z]+[A-Z][a-z]+[A-Z][a-z]+[A-Z][a-z]+\d{2}$/);
  assert.ok(password.length >= 8);
});

test("temporary password selections come from each curated list", () => {
  const lists = Object.values(TEMPORARY_PASSWORD_WORD_LISTS);

  for (const index of [0, 7, 15, 23, 31]) {
    const password = generateTemporaryPassword(deterministicRandomInt([index, index, index, index, index]));
    const expectedWords = lists.map((words) => words[index]).join("");
    assert.equal(password, `${expectedWords}${index + 10}`);
  }
});

test("temporary password suffix covers exactly 10 through 99", () => {
  const low = generateTemporaryPassword(deterministicRandomInt([0, 0, 0, 0, 0]));
  const high = generateTemporaryPassword(deterministicRandomInt([0, 0, 0, 0, 89]));
  assert.match(low, /10$/);
  assert.match(high, /99$/);
});
