import { Lunar, Solar } from "lunar-javascript";
import { buildElementBalance, buildFlowAnalysis, buildNarrativeAnalysis, buildTenGodDistribution } from "./analysis";
import { BRANCH_META, STEM_META, computeTenGod } from "./constants";
import { normalizeBaziInput, toGenderNumber } from "./input";
import { determinePattern } from "./pattern";
import { analyzeNatalRelations } from "./relations";
import { assessStrength, computeStrength } from "./scoring";
import { calculateShenSha, calculateXunKong } from "./shensha";
import { assessYongShen } from "./yongshen";
import type {
  AnnualCycle,
  BaziInput,
  BaziProfile,
  Gender,
  HiddenStemDetails,
  PillarDetails,
  StemDetails
} from "./types";
import type {
  DaYunInstance,
  EightCharInstance,
  LiuNianInstance,
  LunarInstance,
  SolarInstance,
  YunInstance
} from "lunar-javascript";

function pad(value: number): string {
  return `${value}`.padStart(2, "0");
}

function toStringArray(value: string[] | string): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => `${item}`);
  }
  return `${value}`
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildStemDetails(stem: string, tenGod: string): StemDetails {
  return {
    value: stem,
    element: STEM_META[stem].element,
    yinYang: STEM_META[stem].yinYang,
    tenGod
  };
}

function buildHiddenStemDetails(dayStem: string, hiddenStems: string[], tenGods: string[]): HiddenStemDetails[] {
  return hiddenStems.map((stem, index) => ({
    value: stem,
    element: STEM_META[stem].element,
    yinYang: STEM_META[stem].yinYang,
    tenGod: tenGods[index] ?? computeTenGod(dayStem, stem)
  }));
}

function buildPillar(args: {
  key: PillarDetails["key"];
  ganZhi: string;
  stem: string;
  branch: string;
  hiddenStems: string[];
  stemTenGod: string;
  branchTenGods: string[];
  naYin: string;
  diShi: string;
  xun: string;
  xunKong: string;
  dayStem: string;
}): PillarDetails {
  const hiddenStemDetails = buildHiddenStemDetails(
    args.dayStem,
    args.hiddenStems,
    args.branchTenGods
  );

  return {
    key: args.key,
    ganZhi: args.ganZhi,
    stem: buildStemDetails(args.stem, args.stemTenGod),
    branch: {
      value: args.branch,
      element: BRANCH_META[args.branch].element,
      yinYang: BRANCH_META[args.branch].yinYang,
      hiddenStems: hiddenStemDetails,
      tenGods: hiddenStemDetails.map((item) => item.tenGod)
    },
    naYin: args.naYin,
    diShi: args.diShi,
    xun: args.xun,
    xunKong: args.xunKong
  };
}

function resolveChart(input: ReturnType<typeof normalizeBaziInput>): {
  solar: SolarInstance;
  lunar: LunarInstance;
  eightChar: EightCharInstance;
} {
  let solar: SolarInstance;
  let lunar: LunarInstance;

  if (input.calendarType === "solar") {
    solar = Solar.fromYmdHms(
      input.year,
      input.month,
      input.day,
      input.hour,
      input.minute,
      input.second
    );
    lunar = solar.getLunar();
  } else {
    const lunarMonth = input.isLeapMonth ? -input.month : input.month;
    lunar = Lunar.fromYmdHms(
      input.year,
      lunarMonth,
      input.day,
      input.hour,
      input.minute,
      input.second
    );
    solar = lunar.getSolar();
  }

  const eightChar = lunar.getEightChar();
  eightChar.setSect(input.sect);

  return { solar, lunar, eightChar };
}

function buildLuckCycles(args: {
  yun: YunInstance;
  count: number;
  annualCount: number;
  dayMaster: PillarDetails["stem"];
  natalPillars: PillarDetails[];
  gender: Gender;
  isStrong: boolean;
}): BaziProfile["luckCycles"] {
  const { yun, count, annualCount, dayMaster, natalPillars, gender, isStrong } = args;

  const cycles = yun
    .getDaYun(count + 1)
    .filter((cycle) => cycle.getIndex() > 0)
    .slice(0, count)
    .map((cycle: DaYunInstance) => {
      const cycleGanZhi = cycle.getGanZhi();
      const cycleAnalysis = buildFlowAnalysis({
        ganZhi: cycleGanZhi,
        level: "cycle",
        dayMaster,
        natalPillars,
        gender,
        isStrong
      });

      const annuals = cycle
        .getLiuNian(annualCount)
        .map((annual: LiuNianInstance): AnnualCycle => ({
          year: annual.getYear(),
          age: annual.getAge(),
          ganZhi: annual.getGanZhi(),
          analysis: buildFlowAnalysis({
            ganZhi: annual.getGanZhi(),
            level: "annual",
            dayMaster,
            natalPillars,
            gender,
            parentGanZhi: cycleGanZhi,
            isStrong
          })
        }));

      return {
        index: cycle.getIndex(),
        ganZhi: cycleGanZhi,
        startYear: cycle.getStartYear(),
        endYear: cycle.getEndYear(),
        startAge: cycle.getStartAge(),
        endAge: cycle.getEndAge(),
        analysis: cycleAnalysis,
        annuals
      };
    });

  return {
    startOffset: {
      years: yun.getStartYear(),
      months: yun.getStartMonth(),
      days: yun.getStartDay()
    },
    startSolar: yun.getStartSolar().toYmd(),
    direction: yun.isForward() ? "forward" : "backward",
    cycles
  };
}

export function generateBaziProfile(rawInput: BaziInput): BaziProfile {
  const input = normalizeBaziInput(rawInput);
  const { solar, lunar, eightChar } = resolveChart(input);
  const dayStem = eightChar.getDayGan();

  const pillars: PillarDetails[] = [
    buildPillar({
      key: "year",
      ganZhi: eightChar.getYear(),
      stem: eightChar.getYearGan(),
      branch: eightChar.getYearZhi(),
      hiddenStems: toStringArray(eightChar.getYearHideGan()),
      stemTenGod: eightChar.getYearShiShenGan(),
      branchTenGods: toStringArray(eightChar.getYearShiShenZhi()),
      naYin: eightChar.getYearNaYin(),
      diShi: eightChar.getYearDiShi(),
      xun: eightChar.getYearXun(),
      xunKong: eightChar.getYearXunKong(),
      dayStem
    }),
    buildPillar({
      key: "month",
      ganZhi: eightChar.getMonth(),
      stem: eightChar.getMonthGan(),
      branch: eightChar.getMonthZhi(),
      hiddenStems: toStringArray(eightChar.getMonthHideGan()),
      stemTenGod: eightChar.getMonthShiShenGan(),
      branchTenGods: toStringArray(eightChar.getMonthShiShenZhi()),
      naYin: eightChar.getMonthNaYin(),
      diShi: eightChar.getMonthDiShi(),
      xun: eightChar.getMonthXun(),
      xunKong: eightChar.getMonthXunKong(),
      dayStem
    }),
    buildPillar({
      key: "day",
      ganZhi: eightChar.getDay(),
      stem: eightChar.getDayGan(),
      branch: eightChar.getDayZhi(),
      hiddenStems: toStringArray(eightChar.getDayHideGan()),
      stemTenGod: eightChar.getDayShiShenGan(),
      branchTenGods: toStringArray(eightChar.getDayShiShenZhi()),
      naYin: eightChar.getDayNaYin(),
      diShi: eightChar.getDayDiShi(),
      xun: eightChar.getDayXun(),
      xunKong: eightChar.getDayXunKong(),
      dayStem
    }),
    buildPillar({
      key: "time",
      ganZhi: eightChar.getTime(),
      stem: eightChar.getTimeGan(),
      branch: eightChar.getTimeZhi(),
      hiddenStems: toStringArray(eightChar.getTimeHideGan()),
      stemTenGod: eightChar.getTimeShiShenGan(),
      branchTenGods: toStringArray(eightChar.getTimeShiShenZhi()),
      naYin: eightChar.getTimeNaYin(),
      diShi: eightChar.getTimeDiShi(),
      xun: eightChar.getTimeXun(),
      xunKong: eightChar.getTimeXunKong(),
      dayStem
    })
  ];

  const dayMaster = buildStemDetails(dayStem, "日主");
  const relations = analyzeNatalRelations(pillars);
  const elementBalance = buildElementBalance(pillars);
  const tenGodDistribution = buildTenGodDistribution(pillars);
  const strength = computeStrength(pillars, dayMaster.element);
  const strengthAssessment = assessStrength(pillars, dayMaster.element);
  const pattern = determinePattern(pillars, strengthAssessment);
  const yongShen = assessYongShen(pillars, dayMaster.element, strengthAssessment, pattern);
  const shenSha = calculateShenSha(pillars);
  const xunKong = calculateXunKong(pillars);
  const yun = eightChar.getYun(toGenderNumber(input.gender), input.luckSect);
  // 全局统一的旺衰开关：采用新版三维旺衰结论（得令/得地/得势细判）推导单一布尔值，
  // 不再使用旧版 computeStrength 的单一总分阈值（strongValue>29）。
  // 该阈值与三维细判在边界案例上约3.9%概率互相矛盾（如 strongValue=29 恰好被
  // 旧阈值判为身弱，但得令+得地+得势三项已有两项成立、supportRatio也过半，
  // 三维标准判定为身强），曾导致 profile.strengthAssessment.isStrong 与
  // profile.strength.level 在同一份报告里给出相反结论。此处推导结果会同时
  // 供大运流年评分与对外的 strengthAssessment.isStrong 字段使用，确保全局唯一口径。
  const isStrongForFlow =
    strengthAssessment.level === "身旺" || strengthAssessment.level === "身强"
      ? true
      : strengthAssessment.level === "身弱" || strengthAssessment.level === "身极弱"
        ? false
        : strengthAssessment.supportRatio >= 0.5;
  const luckCycles = buildLuckCycles({
    yun,
    count: input.luckCycleCount,
    annualCount: input.annualCycleCount,
    dayMaster,
    natalPillars: pillars,
    gender: input.gender,
    isStrong: isStrongForFlow
  });
  const analysis = buildNarrativeAnalysis({
    dayMaster,
    elementBalance,
    tenGodDistribution,
    relations,
    startSolar: luckCycles.startSolar,
    direction: luckCycles.direction,
    dayBranch: pillars.find((pillar) => pillar.key === "day")!.branch.value,
    strength: strengthAssessment,
    pattern,
    yongShen,
    shenSha
  });

  return {
    input,
    birth: {
      solar: solar.toYmdHms(),
      lunar: `${lunar.toString()} ${pad(input.hour)}:${pad(input.minute)}:${pad(input.second)}`
    },
    chart: {
      pillars,
      dayMaster: {
        ...dayMaster,
        ganZhi: eightChar.getDay()
      },
      taiYuan: eightChar.getTaiYuan(),
      mingGong: eightChar.getMingGong(),
      shenGong: eightChar.getShenGong()
    },
    relations,
    elementBalance,
    tenGodDistribution,
    strengthAssessment: {
      isStrong: isStrongForFlow,
      strongValue: strength.strongValue,
      weakValue: strength.weakValue
    },
    strength: strengthAssessment,
    pattern,
    yongShen,
    shenSha,
    xunKong,
    luckCycles,
    analysis
  };
}

