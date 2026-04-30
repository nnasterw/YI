import type { BaziInput, Gender, NormalizedBaziInput } from "./types";

function assertInteger(name: string, value: number): void {
  if (!Number.isInteger(value)) {
    throw new Error(`${name} must be an integer`);
  }
}

function assertRange(name: string, value: number, min: number, max: number): void {
  if (value < min || value > max) {
    throw new Error(`${name} must be between ${min} and ${max}`);
  }
}

export function normalizeBaziInput(input: BaziInput): NormalizedBaziInput {
  const minute = input.minute ?? 0;
  const second = input.second ?? 0;
  const sect = input.sect ?? 2;
  const luckCycleCount = input.luckCycleCount ?? 8;
  const annualCycleCount = input.annualCycleCount ?? 10;

  const numericFields: Array<{ name: string; value: number }> = [
    { name: "year", value: input.year },
    { name: "month", value: input.month },
    { name: "day", value: input.day },
    { name: "hour", value: input.hour },
    { name: "minute", value: minute },
    { name: "second", value: second },
    { name: "luckCycleCount", value: luckCycleCount },
    { name: "annualCycleCount", value: annualCycleCount }
  ];

  numericFields.forEach(({ name, value }) => assertInteger(name, value));

  assertRange("month", input.month, 1, 12);
  assertRange("day", input.day, 1, 31);
  assertRange("hour", input.hour, 0, 23);
  assertRange("minute", minute, 0, 59);
  assertRange("second", second, 0, 59);
  assertRange("luckCycleCount", luckCycleCount, 1, 12);
  assertRange("annualCycleCount", annualCycleCount, 1, 12);

  if (sect !== 1 && sect !== 2) {
    throw new Error("sect must be 1 or 2");
  }

  if (input.luckSect !== undefined && input.luckSect !== 1 && input.luckSect !== 2) {
    throw new Error("luckSect must be 1 or 2");
  }

  if (input.calendarType !== "solar" && input.calendarType !== "lunar") {
    throw new Error("calendarType must be 'solar' or 'lunar'");
  }

  if (input.gender !== "male" && input.gender !== "female") {
    throw new Error("gender must be 'male' or 'female'");
  }

  return {
    calendarType: input.calendarType,
    year: input.year,
    month: input.month,
    day: input.day,
    hour: input.hour,
    minute,
    second,
    isLeapMonth: input.isLeapMonth ?? false,
    gender: input.gender,
    sect,
    luckSect: input.luckSect,
    luckCycleCount,
    annualCycleCount,
    metadata: input.metadata
  };
}

export function toGenderNumber(gender: Gender): 0 | 1 {
  return gender === "male" ? 1 : 0;
}
