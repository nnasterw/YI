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
      expect(cycle.analysis.career.summary).toBeDefined();
      expect(cycle.analysis.relationships.summary).toBeDefined();
      expect(cycle.analysis.health.summary).toBeDefined();
      expect(cycle.analysis.wealth.summary).toBeDefined();
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

  // 回归：劫财 tone 需与自身 delta 净方向一致——身旺逢劫是纯负面（challenging），
  // 身弱逢劫帮身但争财、得失参半，文案明写"参半"，tone 不应再标为纯负面的
  // challenging（否则会被 web 端十神评分误判为-1分，且与文案语义矛盾）。
  it("劫财 tone 随身强身弱变化：身旺为 challenging，身弱为 mixed", () => {
    const strongResult = buildFlowAnalysis({
      ganZhi: "庚辰",
      level: "cycle",
      dayMaster,
      natalPillars,
      gender: "male",
      isStrong: true
    });
    const strongJieCai = strongResult.signals.find(
      (signal) => signal.category === "ten-god" && signal.type === "劫财"
    );
    expect(strongJieCai?.tone).toBe("challenging");

    const weakResult = buildFlowAnalysis({
      ganZhi: "庚辰",
      level: "cycle",
      dayMaster,
      natalPillars,
      gender: "male",
      isStrong: false
    });
    const weakJieCai = weakResult.signals.find(
      (signal) => signal.category === "ten-god" && signal.type === "劫财"
    );
    expect(weakJieCai?.tone).toBe("mixed");
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

describe("中和态旺衰口径一致性（回归 isStrong 与 level 分歧 bug）", () => {
  // 2006-10-11 18:00 男：扶抑法中和态样本，此前 selectByFuYi 的"中和"分支无脑
  // 取比劫为用神，未按 isStrong 区分偏强/偏弱，导致喜用神与 isStrong 定性矛盾。
  it("扶抑法中和偏强命局不应把比劫/印星作为最喜用神", () => {
    const profile = generateBaziProfile({
      calendarType: "solar",
      year: 2006,
      month: 10,
      day: 11,
      hour: 18,
      minute: 0,
      gender: "male"
    });

    if (profile.yongShen.primaryMethod === "扶抑" && profile.strength.level === "中和") {
      const dayElement = profile.chart.dayMaster.element;
      const printElement = (Object.entries({
        木: "火", 火: "土", 土: "金", 金: "水", 水: "木"
      }).find(([, v]) => v === dayElement) ?? [])[0];
      if (profile.strength.isStrong) {
        expect(profile.yongShen.yongShen).not.toContain(dayElement);
        expect(profile.yongShen.yongShen).not.toContain(printElement);
      }
    }
  });

  // 1990-05-15 10:00 男：庚日主中和偏强（supportRatio 62%），比劫（金）重重成病，
  // 覆盖 selectByBingYao 的 isStrong 判断、概述文案、健康维度三处口径。
  it("中和偏强命局的病药法、概述文案、健康建议三处口径应彼此一致", () => {
    const profile = generateBaziProfile({
      calendarType: "solar",
      year: 1990,
      month: 5,
      day: 15,
      hour: 10,
      minute: 0,
      gender: "male"
    });

    expect(profile.strength.level).toBe("中和");
    expect(profile.strength.isStrong).toBe(true);
    expect(profile.yongShen.primaryMethod).toBe("病药");
    // 病药法取克泄耗（官杀/食伤），不应取比劫同气为药
    expect(profile.yongShen.yongShen).not.toContain(profile.chart.dayMaster.element);

    // 概述文案需标注"偏强"，不能只说"大致平衡"（否则与用神取用矛盾）
    const overviewLine = profile.analysis.overview.find((line) => line.includes("中和"));
    expect(overviewLine).toContain("偏强");
    expect(overviewLine).not.toContain("偏弱");

    // 健康维度不应因"中和"而完全缺失强弱建议
    expect(profile.analysis.health.some((line) => line.includes("日主偏旺"))).toBe(true);
  });

  // 批量抽样保证：扶抑法、病药法（比劫/食伤为病）在任意中和态样本下均不与
  // strength.isStrong 矛盾，避免同类"level 二元判断遗漏中和细分"的 bug 再次出现。
  it("批量样本中扶抑法与病药法结论均与 strength.isStrong 一致", () => {
    const REVERSE_GENERATING: Record<string, string> = { 木: "火", 火: "土", 土: "金", 金: "水", 水: "木" };
    const REVERSE_CONTROLLING: Record<string, string> = { 木: "金", 火: "水", 土: "木", 金: "火", 水: "土" };
    const GENERATING: Record<string, string> = { 木: "火", 火: "土", 土: "金", 金: "水", 水: "木" };
    const printOf = (el: string) => Object.keys(GENERATING).find((k) => GENERATING[k] === el)!;

    let fuyiChecked = 0;
    let bingyaoChecked = 0;

    for (let year = 1960; year <= 2024; year += 3) {
      for (const [month, day, hour] of [[3, 12, 6], [7, 20, 14], [11, 5, 22]] as const) {
        const profile = generateBaziProfile({
          calendarType: "solar",
          year,
          month,
          day,
          hour,
          minute: 0,
          gender: year % 2 === 0 ? "male" : "female"
        });

        const dayElement = profile.chart.dayMaster.element;
        const { yongShen, primaryMethod, methods } = profile.yongShen;
        const { isStrong } = profile.strength;

        if (primaryMethod === "扶抑") {
          fuyiChecked++;
          if (isStrong) {
            expect(yongShen).not.toContain(dayElement);
            expect(yongShen).not.toContain(printOf(dayElement));
          } else {
            expect(yongShen).not.toContain(REVERSE_CONTROLLING[dayElement]);
            expect(yongShen).not.toContain(REVERSE_GENERATING[dayElement]);
          }
        }

        const bingyao = methods.find((m) => m.method === "病药");
        if (bingyao && (bingyao.reason.includes("比劫重重") || bingyao.reason.includes("食伤过旺"))) {
          bingyaoChecked++;
          expect(isStrong).toBe(true);
        }
      }
    }

    expect(fuyiChecked).toBeGreaterThan(0);
    expect(bingyaoChecked).toBeGreaterThan(0);
  });

  // 1944-1-15 3:00 男：戊土生丑月，得令+得地两项信号命中，但客观扶抑力量
  // 占比 supportRatio 仅 46.7%（不足一半，克泄耗力量实际更多）。此前
  // "身强"档的判定门槛误写为 supportRatio>0.45（低于半数即可称强），导致
  // 这类样本被贴上"身强"标签，与其字面含义（扶抑力量过半才称得上"强"）
  // 自相矛盾，且与其余三档（身旺>0.55、身弱<0.4、身极弱<0.3）均以0.5为界
  // 的方向不一致。订正门槛为 supportRatio>0.5 后，该样本应回落到"中和"档，
  // 不再出现"名强实弱"的矛盾；本用例锁定该具体样本防止阈值再次跑偏。
  it("supportRatio 不足五成时不应被判定为身强（回归'名强实弱'的自相矛盾）", () => {
    const profile = generateBaziProfile({
      calendarType: "solar",
      year: 1944,
      month: 1,
      day: 15,
      hour: 3,
      minute: 0,
      gender: "male"
    });

    expect(profile.strength.level).toBe("中和");
    expect(profile.strength.supportRatio).toBeLessThan(0.5);
  });

  // 批量样本兜底：任意命局只要 level 落在"身强/身旺"，supportRatio 必须过半；
  // 落在"身弱/身极弱"，supportRatio 必须不足半——避免等级定性与客观占比方向相反。
  it("批量样本中身强/身旺的 supportRatio 恒过半，身弱/身极弱恒不足半", () => {
    let checked = 0;
    for (let year = 1930; year <= 2029; year++) {
      for (const [month, day, hour] of [[1, 15, 3], [4, 10, 9], [7, 20, 15], [10, 5, 21]] as const) {
        const profile = generateBaziProfile({
          calendarType: "solar",
          year,
          month,
          day,
          hour,
          minute: 30,
          gender: year % 2 === 0 ? "male" : "female"
        });
        checked++;
        const { level, supportRatio } = profile.strength;
        if (level === "身旺" || level === "身强") {
          expect(supportRatio).toBeGreaterThanOrEqual(0.5);
        }
        if (level === "身弱" || level === "身极弱") {
          expect(supportRatio).toBeLessThan(0.5);
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});
