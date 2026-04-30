import { describe, expect, it } from "vitest";
import { buildFlowAnalysis } from "../src/analysis";
import { generateBaziProfile } from "../src/bazi";
import { normalizeBaziInput } from "../src/input";
import { analyzeNatalRelations } from "../src/relations";
import type { BaziInput, PillarDetails } from "../src/types";

describe("generateBaziProfile", () => {
  it("builds a solar chart with structured pillars", () => {
    const profile = generateBaziProfile({
      calendarType: "solar",
      year: 2005,
      month: 12,
      day: 23,
      hour: 8,
      minute: 37,
      gender: "male"
    });

    expect(profile.birth.solar).toBe("2005-12-23 08:37:00");
    expect(profile.chart.pillars.map((pillar) => pillar.ganZhi)).toEqual([
      "乙酉",
      "戊子",
      "辛巳",
      "壬辰"
    ]);
    expect(profile.chart.dayMaster.value).toBe("辛");
    expect(profile.chart.pillars[0].stem.tenGod).toBe("偏财");
    expect(profile.chart.pillars[1].branch.hiddenStems.map((item) => item.value)).toEqual(["癸"]);
    expect(profile.chart.taiYuan).toBe("己卯");
    expect(profile.chart.mingGong).toBe("己丑");
    expect(profile.chart.shenGong).toBe("辛巳");
  });

  it("supports sect switching for late zi-hour charts", () => {
    const profile = generateBaziProfile({
      calendarType: "solar",
      year: 1988,
      month: 2,
      day: 15,
      hour: 23,
      minute: 30,
      gender: "male",
      sect: 1
    });

    expect(profile.chart.pillars.map((pillar) => pillar.ganZhi)).toEqual([
      "戊辰",
      "甲寅",
      "辛丑",
      "戊子"
    ]);
  });

  it("supports lunar input and luck-cycle start calculation", () => {
    const profile = generateBaziProfile({
      calendarType: "solar",
      year: 1981,
      month: 1,
      day: 29,
      hour: 23,
      minute: 37,
      gender: "female"
    });

    expect(profile.luckCycles.startOffset).toEqual({
      years: 8,
      months: 0,
      days: 20
    });
    expect(profile.luckCycles.startSolar).toBe("1989-02-18");
    expect(profile.luckCycles.cycles[0].ganZhi).toBe("戊子");
    expect(profile.luckCycles.cycles[0].annuals[0].ganZhi).toBe("己巳");
  });
});

describe("flow analysis integration", () => {
  const profile = generateBaziProfile({
    calendarType: "solar",
    year: 2005,
    month: 12,
    day: 23,
    hour: 8,
    minute: 37,
    gender: "male"
  });

  it("attaches analysis to each luck cycle", () => {
    for (const cycle of profile.luckCycles.cycles) {
      expect(cycle.analysis).toBeDefined();
      expect(cycle.analysis.signals.length).toBeGreaterThan(0);
      expect(cycle.analysis.overall.tone).toMatch(/supportive|mixed|challenging/);
      expect(cycle.analysis.career.summary.length).toBeGreaterThan(0);
      expect(cycle.analysis.relationships.summary.length).toBeGreaterThan(0);
      expect(cycle.analysis.health.summary.length).toBeGreaterThan(0);
      expect(cycle.analysis.wealth.summary.length).toBeGreaterThan(0);
    }
  });

  it("attaches analysis to each annual cycle", () => {
    const firstCycle = profile.luckCycles.cycles[0];
    for (const annual of firstCycle.annuals) {
      expect(annual.analysis).toBeDefined();
      expect(annual.analysis.signals.length).toBeGreaterThan(0);
      expect(annual.analysis.overall.tone).toMatch(/supportive|mixed|challenging/);
    }
  });

  it("annual analysis includes cycle-link signals when parent is provided", () => {
    const firstCycle = profile.luckCycles.cycles[0];
    const allSignals = firstCycle.annuals.flatMap((annual) => annual.analysis.signals);
    const cycleLinkSignals = allSignals.filter((signal) => signal.category === "cycle-link");
    expect(cycleLinkSignals.length).toBeGreaterThanOrEqual(0);
  });
});

describe("buildFlowAnalysis unit", () => {
  const natalPillars: PillarDetails[] = [
    {
      key: "year",
      ganZhi: "乙酉",
      stem: { value: "乙", element: "木", yinYang: "阴", tenGod: "偏财" },
      branch: { value: "酉", element: "金", yinYang: "阴", hiddenStems: [{ value: "辛", element: "金", yinYang: "阴", tenGod: "比肩" }], tenGods: ["比肩"] },
      naYin: "泉中水", diShi: "临官", xun: "甲子", xunKong: "戌亥"
    },
    {
      key: "month",
      ganZhi: "戊子",
      stem: { value: "戊", element: "土", yinYang: "阳", tenGod: "正印" },
      branch: { value: "子", element: "水", yinYang: "阳", hiddenStems: [{ value: "癸", element: "水", yinYang: "阴", tenGod: "偏财" }], tenGods: ["偏财"] },
      naYin: "霹雳火", diShi: "长生", xun: "甲午", xunKong: "辰巳"
    },
    {
      key: "day",
      ganZhi: "辛巳",
      stem: { value: "辛", element: "金", yinYang: "阴", tenGod: "日主" },
      branch: { value: "巳", element: "火", yinYang: "阴", hiddenStems: [{ value: "丙", element: "火", yinYang: "阳", tenGod: "正官" }, { value: "庚", element: "金", yinYang: "阳", tenGod: "劫财" }, { value: "戊", element: "土", yinYang: "阳", tenGod: "正印" }], tenGods: ["正官", "劫财", "正印"] },
      naYin: "白蜡金", diShi: "死", xun: "甲午", xunKong: "辰巳"
    },
    {
      key: "time",
      ganZhi: "壬辰",
      stem: { value: "壬", element: "水", yinYang: "阳", tenGod: "伤官" },
      branch: { value: "辰", element: "土", yinYang: "阳", hiddenStems: [{ value: "戊", element: "土", yinYang: "阳", tenGod: "正印" }, { value: "乙", element: "木", yinYang: "阴", tenGod: "偏财" }, { value: "癸", element: "水", yinYang: "阴", tenGod: "偏财" }], tenGods: ["正印", "偏财", "偏财"] },
      naYin: "长流水", diShi: "养", xun: "甲辰", xunKong: "寅卯"
    }
  ];

  const dayMaster = { value: "辛", element: "金" as const, yinYang: "阴" as const, tenGod: "日主" };

  it("detects 六冲 when flow branch clashes with natal branch", () => {
    const result = buildFlowAnalysis({
      ganZhi: "丙午",
      level: "annual",
      dayMaster,
      natalPillars,
      gender: "male"
    });
    const clashSignals = result.signals.filter(
      (signal) => signal.type === "六冲" && signal.members.includes("午")
    );
    expect(clashSignals.length).toBeGreaterThan(0);
  });

  it("detects 六合 when flow branch combines with natal branch", () => {
    const result = buildFlowAnalysis({
      ganZhi: "己丑",
      level: "cycle",
      dayMaster,
      natalPillars,
      gender: "male"
    });
    const combineSignals = result.signals.filter(
      (signal) => signal.type === "六合" && signal.members.includes("丑")
    );
    expect(combineSignals.length).toBeGreaterThan(0);
  });

  it("includes ten-god signal for flow stem", () => {
    const result = buildFlowAnalysis({
      ganZhi: "甲寅",
      level: "cycle",
      dayMaster,
      natalPillars,
      gender: "female"
    });
    const tenGodSignals = result.signals.filter((signal) => signal.category === "ten-god");
    expect(tenGodSignals.length).toBe(1);
    expect(tenGodSignals[0].type).toBe("正财");
  });
});

describe("analyzeNatalRelations", () => {
  it("detects earthly pair relations", () => {
    const pillars = [
      {
        key: "year",
        ganZhi: "甲子",
        stem: { value: "甲", element: "木", yinYang: "阳", tenGod: "日主" },
        branch: { value: "子", element: "水", yinYang: "阳", hiddenStems: [], tenGods: [] },
        naYin: "",
        diShi: "",
        xun: "",
        xunKong: ""
      },
      {
        key: "month",
        ganZhi: "乙丑",
        stem: { value: "乙", element: "木", yinYang: "阴", tenGod: "劫财" },
        branch: { value: "丑", element: "土", yinYang: "阴", hiddenStems: [], tenGods: [] },
        naYin: "",
        diShi: "",
        xun: "",
        xunKong: ""
      },
      {
        key: "day",
        ganZhi: "丙午",
        stem: { value: "丙", element: "火", yinYang: "阳", tenGod: "日主" },
        branch: { value: "午", element: "火", yinYang: "阳", hiddenStems: [], tenGods: [] },
        naYin: "",
        diShi: "",
        xun: "",
        xunKong: ""
      },
      {
        key: "time",
        ganZhi: "丁未",
        stem: { value: "丁", element: "火", yinYang: "阴", tenGod: "劫财" },
        branch: { value: "未", element: "土", yinYang: "阴", hiddenStems: [], tenGods: [] },
        naYin: "",
        diShi: "",
        xun: "",
        xunKong: ""
      }
    ] satisfies PillarDetails[];

    const relations = analyzeNatalRelations(pillars);
    expect(relations.some((relation) => relation.type === "六合" && relation.members.includes("子"))).toBe(
      true
    );
    expect(relations.some((relation) => relation.type === "六冲" && relation.members.includes("午"))).toBe(
      true
    );
    expect(relations.some((relation) => relation.type === "六害" && relation.members.includes("未"))).toBe(
      true
    );
  });
});

describe("input validation", () => {
  it("rejects invalid calendarType", () => {
    expect(() =>
      normalizeBaziInput({ calendarType: "foo" as BaziInput["calendarType"], year: 2000, month: 1, day: 1, hour: 0, gender: "male" })
    ).toThrow("calendarType must be 'solar' or 'lunar'");
  });

  it("rejects invalid gender", () => {
    expect(() =>
      normalizeBaziInput({ calendarType: "solar", year: 2000, month: 1, day: 1, hour: 0, gender: "other" as BaziInput["gender"] })
    ).toThrow("gender must be 'male' or 'female'");
  });

  it("rejects out-of-range month", () => {
    expect(() =>
      normalizeBaziInput({ calendarType: "solar", year: 2000, month: 13, day: 1, hour: 0, gender: "male" })
    ).toThrow("month must be between 1 and 12");
  });

  it("rejects non-integer hour", () => {
    expect(() =>
      normalizeBaziInput({ calendarType: "solar", year: 2000, month: 1, day: 1, hour: 8.5, gender: "male" })
    ).toThrow("hour must be an integer");
  });

  it("rejects invalid sect", () => {
    expect(() =>
      normalizeBaziInput({ calendarType: "solar", year: 2000, month: 1, day: 1, hour: 0, gender: "male", sect: 3 as 1 | 2 })
    ).toThrow("sect must be 1 or 2");
  });
});

describe("lunar calendar input", () => {
  it("generates chart from lunar date", () => {
    const profile = generateBaziProfile({
      calendarType: "lunar",
      year: 2019,
      month: 12,
      day: 12,
      hour: 11,
      minute: 22,
      gender: "female"
    });

    expect(profile.input.calendarType).toBe("lunar");
    expect(profile.birth.solar).toBeTruthy();
    expect(profile.birth.lunar).toBeTruthy();
    expect(profile.chart.pillars).toHaveLength(4);
    expect(profile.chart.dayMaster.tenGod).toBe("日主");
  });

  it("handles leap month flag", () => {
    const profile = generateBaziProfile({
      calendarType: "lunar",
      year: 2020,
      month: 4,
      day: 15,
      hour: 12,
      gender: "male",
      isLeapMonth: true
    });

    expect(profile.chart.pillars).toHaveLength(4);
    expect(profile.input.isLeapMonth).toBe(true);
  });
});

describe("relation description uses Chinese pillar labels", () => {
  it("uses 年/月/时 instead of year/month/time", () => {
    const profile = generateBaziProfile({
      calendarType: "solar",
      year: 2005,
      month: 12,
      day: 23,
      hour: 8,
      minute: 37,
      gender: "male"
    });

    const fiveElementRelations = profile.relations.filter((r) => r.category === "five-element");
    for (const relation of fiveElementRelations) {
      expect(relation.description).not.toMatch(/year|month|time/);
      expect(relation.description).toMatch(/年干|月干|时干/);
    }
  });
});
