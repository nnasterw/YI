#!/usr/bin/env node
import { parseArgs } from "node:util";
import { generateBaziProfile } from "./bazi";
import type { BaziInput } from "./types";

type ArgValue = string | boolean | Array<string | boolean> | undefined;

function printHelp(): void {
  process.stdout.write(`Usage:
  bazi-core --calendar <solar|lunar> --year <n> --month <n> --day <n> --hour <n> --gender <male|female> [options]

Options:
  --minute <n>        Minute, default 0
  --second <n>        Second, default 0
  --sect <1|2>        Early/late zi-hour rule, default 2
  --luck-sect <1|2>   Luck-cycle section algorithm
  --leap-month        Mark lunar month as leap month
  --pretty            Pretty-print JSON
  --help              Show this help
`);
}

function normalizeArg(value: ArgValue): string | boolean | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function requireString(value: ArgValue, name: string): string {
  const normalized = normalizeArg(value);
  if (typeof normalized !== "string" || normalized.length === 0) {
    throw new Error(`Missing required option: --${name}`);
  }
  return normalized;
}

function toNumber(value: ArgValue, name: string): number | undefined {
  const normalized = normalizeArg(value);
  if (normalized === undefined || typeof normalized === "boolean") {
    return undefined;
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    throw new Error(`--${name} must be a number`);
  }
  return parsed;
}

function buildInput(argv: ReturnType<typeof parseArgs>["values"]): BaziInput {
  return {
    calendarType: requireString(argv.calendar, "calendar") as BaziInput["calendarType"],
    year: toNumber(argv.year, "year")!,
    month: toNumber(argv.month, "month")!,
    day: toNumber(argv.day, "day")!,
    hour: toNumber(argv.hour, "hour")!,
    minute: toNumber(argv.minute, "minute"),
    second: toNumber(argv.second, "second"),
    gender: requireString(argv.gender, "gender") as BaziInput["gender"],
    sect: toNumber(argv.sect, "sect") as 1 | 2 | undefined,
    luckSect: toNumber(argv["luck-sect"], "luck-sect") as 1 | 2 | undefined,
    isLeapMonth: Boolean(argv["leap-month"])
  };
}

function main(): void {
  const { values } = parseArgs({
    options: {
      calendar: { type: "string" },
      year: { type: "string" },
      month: { type: "string" },
      day: { type: "string" },
      hour: { type: "string" },
      minute: { type: "string" },
      second: { type: "string" },
      gender: { type: "string" },
      sect: { type: "string" },
      "luck-sect": { type: "string" },
      "leap-month": { type: "boolean" },
      pretty: { type: "boolean" },
      help: { type: "boolean", short: "h" }
    },
    allowPositionals: false
  });

  if (values.help) {
    printHelp();
    return;
  }

  const input = buildInput(values);
  const profile = generateBaziProfile(input);
  const spacing = values.pretty ? 2 : 0;
  process.stdout.write(`${JSON.stringify(profile, null, spacing)}\n`);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
