import { randomInt } from "node:crypto";

/** Curated, student-friendly words used in temporary credentials. */
export const TEMPORARY_PASSWORD_WORD_LISTS = {
  adjectives: [
    "Able", "Bright", "Calm", "Clever", "Cool", "Eager", "Fair", "Fast",
    "Friendly", "Funny", "Gentle", "Glad", "Happy", "Helpful", "Jolly", "Kind",
    "Lively", "Lucky", "Merry", "Neat", "Nice", "Nimble", "Patient", "Proud",
    "Quick", "Quiet", "Ready", "Safe", "Smart", "Super", "Swift", "Wise",
  ],
  animals: [
    "Badger", "Bear", "Beaver", "Bison", "Camel", "Cat", "Cobra", "Deer",
    "Dolphin", "Eagle", "Falcon", "Fox", "Gecko", "Goat", "Heron", "Horse",
    "Koala", "Lion", "Llama", "Otter", "Owl", "Panda", "Parrot", "Penguin",
    "Rabbit", "Robin", "Seal", "Swan", "Tiger", "Turtle", "Whale", "Zebra",
  ],
  colours: [
    "Amber", "Aqua", "Azure", "Blue", "Bronze", "Coral", "Cream", "Cyan",
    "Gold", "Golden", "Green", "Indigo", "Ivory", "Jade", "Lilac", "Lime",
    "Mint", "Navy", "Olive", "Orange", "Peach", "Pink", "Purple", "Red",
    "Rose", "Ruby", "Silver", "Sky", "Teal", "Violet", "White", "Yellow",
  ],
  things: [
    "Apple", "Beach", "Brook", "Cloud", "Comet", "Dawn", "Field", "Forest",
    "Garden", "Hill", "Island", "Lake", "Leaf", "Meadow", "Moon", "Ocean",
    "Orchid", "Pebble", "Planet", "Pond", "Rainbow", "River", "Shell", "Star",
    "Stone", "Sun", "Tree", "Valley", "Wave", "Willow", "Wind", "Wood",
  ],
} as const;

export type TemporaryPasswordRandomInt = (maxExclusive: number) => number;

function selectWord(words: readonly string[], getRandomInt: TemporaryPasswordRandomInt) {
  return words[getRandomInt(words.length)];
}

/**
 * Creates a readable one-time password using cryptographically secure randomness.
 *
 * Four independent selections from 32-word lists plus a value from the 90 possible
 * two-digit suffixes provide log2(32^4 * 90), or about 26.5 bits of entropy. These
 * credentials are only displayed once and must be replaced after the first login.
 * Supplying getRandomInt is intended only to make selection deterministic in tests.
 */
export function generateTemporaryPassword(getRandomInt: TemporaryPasswordRandomInt = randomInt) {
  const { adjectives, animals, colours, things } = TEMPORARY_PASSWORD_WORD_LISTS;
  const words = [adjectives, animals, colours, things]
    .map((wordList) => selectWord(wordList, getRandomInt))
    .join("");
  const suffix = getRandomInt(90) + 10;
  return `${words}${suffix}`;
}
