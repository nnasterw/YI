import type { PillarDetails, ShenShaRecord, XunKongAssessment } from "./types";

const LU_SHEN: Record<string, string> = {
  甲: "寅", 乙: "卯", 丙: "巳", 丁: "午", 戊: "巳",
  己: "午", 庚: "申", 辛: "酉", 壬: "亥", 癸: "子"
};

const YANG_REN: Record<string, string> = {
  甲: "卯", 乙: "寅", 丙: "午", 丁: "巳", 戊: "午",
  己: "巳", 庚: "酉", 辛: "申", 壬: "子", 癸: "亥"
};

const TIAN_YI_GUI_REN: Record<string, string[]> = {
  甲: ["丑", "未"], 戊: ["丑", "未"], 庚: ["丑", "未"],
  乙: ["子", "申"], 己: ["子", "申"],
  丙: ["亥", "酉"], 丁: ["亥", "酉"],
  辛: ["寅", "午"],
  壬: ["卯", "巳"], 癸: ["卯", "巳"]
};

const WEN_CHANG_GUI_REN: Record<string, string> = {
  甲: "巳", 乙: "午", 丙: "申", 丁: "酉", 戊: "申",
  己: "酉", 庚: "亥", 辛: "子", 壬: "寅", 癸: "卯"
};

/** 桃花（咸池）：以年支或日支三合局对应的沐浴之地查取 */
const TAO_HUA: Record<string, string> = {
  寅: "卯", 午: "卯", 戌: "卯",
  申: "酉", 子: "酉", 辰: "酉",
  亥: "子", 卯: "子", 未: "子",
  巳: "午", 酉: "午", 丑: "午"
};

/** 驿马：以年支或日支三合局对应的冲位查取 */
const YI_MA: Record<string, string> = {
  寅: "申", 午: "申", 戌: "申",
  申: "寅", 子: "寅", 辰: "寅",
  亥: "巳", 卯: "巳", 未: "巳",
  巳: "亥", 酉: "亥", 丑: "亥"
};

/** 华盖：以年支或日支三合局对应的墓库之地查取 */
const HUA_GAI: Record<string, string> = {
  寅: "戌", 午: "戌", 戌: "戌",
  亥: "未", 卯: "未", 未: "未",
  申: "辰", 子: "辰", 辰: "辰",
  巳: "丑", 酉: "丑", 丑: "丑"
};

/** 六十甲子空亡（旬空）：以日柱所在旬查取该旬所空的两个地支 */
const XUN_KONG_BY_STEM_BRANCH_INDEX: string[][] = [
  ["戌", "亥"], // 甲子旬
  ["申", "酉"], // 甲戌旬
  ["午", "未"], // 甲申旬
  ["辰", "巳"], // 甲午旬
  ["寅", "卯"], // 甲辰旬
  ["子", "丑"]  // 甲寅旬
];

const STEM_ORDER = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const BRANCH_ORDER = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];

function computeXunKong(stem: string, branch: string): string[] {
  const stemIndex = STEM_ORDER.indexOf(stem);
  const branchIndex = BRANCH_ORDER.indexOf(branch);
  if (stemIndex < 0 || branchIndex < 0) return [];

  // 六十甲子序数：天干10个一循环、地支12个一循环，某组干支在六十甲子表中的
  // 序号 ganZhiIndex（0~59）需同时满足 ganZhiIndex % 10 === stemIndex 且
  // ganZhiIndex % 12 === branchIndex，逐一遍历定位即可，不依赖公式推导，
  // 从根本上避免“起始地支索引每旬如何偏移”这类方向性推导错误。
  let ganZhiIndex = -1;
  for (let i = 0; i < 60; i += 1) {
    if (i % 10 === stemIndex && i % 12 === branchIndex) {
      ganZhiIndex = i;
      break;
    }
  }
  if (ganZhiIndex < 0) return [];

  const xun = Math.floor(ganZhiIndex / 10); // 0~5，第几旬（甲子/甲戌/甲申/甲午/甲辰/甲寅）
  return XUN_KONG_BY_STEM_BRANCH_INDEX[xun];
}

/**
 * 神煞查取：覆盖命理分析中较常用且查法明确、无争议的一批神煞，
 * 均以日干或年支为基准查取，命中则记录出现在哪些柱位。
 */
export function calculateShenSha(pillars: PillarDetails[]): ShenShaRecord[] {
  const records: ShenShaRecord[] = [];
  const dayPillar = pillars.find((pillar) => pillar.key === "day")!;
  const yearPillar = pillars.find((pillar) => pillar.key === "year")!;
  const dayStem = dayPillar.stem.value;
  const dayBranch = dayPillar.branch.value;
  const yearBranch = yearPillar.branch.value;

  const pillarLabel: Record<PillarDetails["key"], string> = {
    year: "年柱",
    month: "月柱",
    day: "日柱",
    time: "时柱"
  };

  function hitBranches(target: string | undefined): string[] {
    if (!target) return [];
    return pillars.filter((pillar) => pillar.branch.value === target).map((pillar) => pillarLabel[pillar.key]);
  }

  // 天乙贵人（日干查全局地支）
  const tianYiTargets = TIAN_YI_GUI_REN[dayStem] ?? [];
  const tianYiHits = pillars.filter((pillar) => tianYiTargets.includes(pillar.branch.value));
  if (tianYiHits.length > 0) {
    records.push({
      name: "天乙贵人",
      basis: `日干${dayStem}`,
      hitPillars: tianYiHits.map((pillar) => pillarLabel[pillar.key]),
      description: "命局逢天乙贵人，主一生多得贵人相助、逢凶化吉。"
    });
  }

  // 文昌贵人（日干查全局地支）
  const wenChangHits = hitBranches(WEN_CHANG_GUI_REN[dayStem]);
  if (wenChangHits.length > 0) {
    records.push({
      name: "文昌贵人",
      basis: `日干${dayStem}`,
      hitPillars: wenChangHits,
      description: "命局逢文昌贵人，主聪慧好学、文笔见长。"
    });
  }

  // 禄神（日干查全局地支）
  const luHits = hitBranches(LU_SHEN[dayStem]);
  if (luHits.length > 0) {
    records.push({
      name: "禄神",
      basis: `日干${dayStem}`,
      hitPillars: luHits,
      description: "命局逢禄神，主衣食丰足、根基稳固。"
    });
  }

  // 羊刃（日干查全局地支）
  const yangRenHits = hitBranches(YANG_REN[dayStem]);
  if (yangRenHits.length > 0) {
    records.push({
      name: "羊刃",
      basis: `日干${dayStem}`,
      hitPillars: yangRenHits,
      description: "命局逢羊刃，主性情刚烈果决，遇事敢作敢当，亦需防冲动破财。"
    });
  }

  // 桃花（以年支、日支分别查取，命中即记）
  const taoHuaFromYear = TAO_HUA[yearBranch];
  const taoHuaFromDay = TAO_HUA[dayBranch];
  const taoHuaTargets = [...new Set([taoHuaFromYear, taoHuaFromDay].filter(Boolean))] as string[];
  const taoHuaHits = pillars.filter((pillar) => taoHuaTargets.includes(pillar.branch.value));
  if (taoHuaHits.length > 0) {
    records.push({
      name: "桃花",
      basis: "年支/日支三合局",
      hitPillars: taoHuaHits.map((pillar) => pillarLabel[pillar.key]),
      description: "命局逢桃花，主异性缘佳、气质出众，亦需留意感情纠葛。"
    });
  }

  // 驿马（以年支、日支分别查取，命中即记）
  const yiMaFromYear = YI_MA[yearBranch];
  const yiMaFromDay = YI_MA[dayBranch];
  const yiMaTargets = [...new Set([yiMaFromYear, yiMaFromDay].filter(Boolean))] as string[];
  const yiMaHits = pillars.filter((pillar) => yiMaTargets.includes(pillar.branch.value));
  if (yiMaHits.length > 0) {
    records.push({
      name: "驿马",
      basis: "年支/日支三合局",
      hitPillars: yiMaHits.map((pillar) => pillarLabel[pillar.key]),
      description: "命局逢驿马，主一生多奔波变动、利于远行外调发展。"
    });
  }

  // 华盖（以年支、日支分别查取，命中即记）
  const huaGaiFromYear = HUA_GAI[yearBranch];
  const huaGaiFromDay = HUA_GAI[dayBranch];
  const huaGaiTargets = [...new Set([huaGaiFromYear, huaGaiFromDay].filter(Boolean))] as string[];
  const huaGaiHits = pillars.filter((pillar) => huaGaiTargets.includes(pillar.branch.value));
  if (huaGaiHits.length > 0) {
    records.push({
      name: "华盖",
      basis: "年支/日支三合局",
      hitPillars: huaGaiHits.map((pillar) => pillarLabel[pillar.key]),
      description: "命局逢华盖，主聪慧孤高、有艺术或宗教哲思倾向，人生带几分清冷孤芳之气。"
    });
  }

  // 魁罡（日柱专属组合）
  const kuiGangSet = new Set(["庚辰", "壬辰", "庚戌", "戊戌"]);
  if (kuiGangSet.has(dayPillar.ganZhi)) {
    records.push({
      name: "魁罡",
      basis: "日柱干支",
      hitPillars: ["日柱"],
      description: "日柱逢魁罡，主性格刚毅果断、掌权有威，亦需留意性情过刚带来的人际张力。"
    });
  }

  return records;
}

/**
 * 空亡（旬空）：以日柱干支所在旬计算，返回该旬所空的两个地支及命中的柱位。
 *
 * 优先直接复用 `dayPillar.xunKong`——该字段来自 lunar-javascript 库的
 * `getDayXunKong()`，是经过库方验证的可信数据源；`computeXunKong` 自实现算法
 * 仅作为兜底（理论上不会触发，除非 dayPillar.xunKong 因异常输入为空），
 * 这样可以避免旬空计算存在两套并行实现、口径或方向出现分歧的维护风险。
 */
export function calculateXunKong(pillars: PillarDetails[]): XunKongAssessment {
  const dayPillar = pillars.find((pillar) => pillar.key === "day")!;
  const emptyBranches = dayPillar.xunKong
    ? dayPillar.xunKong.split("")
    : computeXunKong(dayPillar.stem.value, dayPillar.branch.value);
  const pillarLabel: Record<PillarDetails["key"], string> = {
    year: "年柱",
    month: "月柱",
    day: "日柱",
    time: "时柱"
  };
  const hitPillars = pillars
    .filter((pillar) => pillar.key !== "day" && emptyBranches.includes(pillar.branch.value))
    .map((pillar) => pillarLabel[pillar.key]);

  return { emptyBranches, hitPillars };
}
