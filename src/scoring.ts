import { HIDDEN_STEM_WEIGHTS, MONTH_ELEMENT_STATE, STEM_META } from "./constants";
import type { Element, PillarDetails, StrengthAssessment, StrengthLevel } from "./types";

export interface ElementScores {
  counts: Record<Element, number>;
  strongest: Element[];
  weakest: Element[];
  strongValue: number;
  weakValue: number;
}

export const GENERATING: Record<Element, Element> = { "木": "水", "火": "木", "土": "火", "金": "土", "水": "金" };
export const CONTROLLING: Record<Element, Element> = { "木": "土", "火": "金", "土": "水", "金": "木", "水": "火" };

/**
 * 五行生克关系速查（以日主/目标五行为参照）：
 * - GENERATING[X] = 生X者，即印星方向（谁生我）。
 * - CONTROLLING[X] = X所克者，即财星方向（我克谁）。
 * - reverseGenerating(X) = 反查GENERATING，得到X所生者，即食伤方向（我生谁）。
 * - reverseControlling(X) = 反查CONTROLLING，得到克X者，即官杀方向（谁克我）。
 * 四个方向函数在旺衰、格局、用神等模块中共享，避免各自重复实现且方向混淆。
 */
export function reverseGenerating(target: Element): Element {
  return (Object.entries(GENERATING) as [Element, Element][]).find(([, value]) => value === target)![0];
}

export function reverseControlling(target: Element): Element {
  return (Object.entries(CONTROLLING) as [Element, Element][]).find(([, value]) => value === target)![0];
}

export function computeStrength(pillars: PillarDetails[], dayElement: Element): ElementScores {
  const counts: Record<Element, number> = { "木": 0, "火": 0, "土": 0, "金": 0, "水": 0 };

  for (const pillar of pillars) {
    counts[pillar.stem.element] += 5;
  }

  const branches = pillars.map(p => p.branch.value);
  const monthBranch = pillars[1].branch.value;
  // 月令加权：月支藏干额外计算一次，使月令在五行强弱分值中权重更高。
  // 依据：《滴天髓》"月令提纲，尤关重要"；《子平真诠》以月令为格局之根。
  // 影响范围：仅 computeStrength() 的 counts 输出（用于 supportRatio 计算），
  // 不影响 assessStrength() 中独立判断的得令/得地/得势三维细判。
  const allBranches = [...branches, monthBranch];

  for (const branch of allBranches) {
    const weights = HIDDEN_STEM_WEIGHTS[branch];
    if (!weights) continue;
    for (const [stem, weight] of Object.entries(weights)) {
      counts[STEM_META[stem].element] += weight;
    }
  }

  const generating = GENERATING[dayElement];
  const strongValue = counts[dayElement] + counts[generating];
  const weakValue = Object.values(counts).reduce((a, b) => a + b, 0) - strongValue;

  const max = Math.max(...Object.values(counts));
  const min = Math.min(...Object.values(counts));
  const strongest = (Object.entries(counts) as [Element, number][])
    .filter(([, v]) => v === max).map(([e]) => e);
  const weakest = (Object.entries(counts) as [Element, number][])
    .filter(([, v]) => v === min).map(([e]) => e);

  // 注：此前这里还有一个 isStrong = strongValue > 29 的字段，但 strongValue>29
  // 这一单一总分阈值从未有典籍依据、也从未被 bazi.ts/renderer.ts 实际读取
  // （二者均已改用 assessStrength() 的得令/得地/得势三维细判结论），保留该
  // 死字段只会让后来者误以为它是有效判据而误用，故彻底移除，仅保留
  // strongValue/weakValue 两个原始分值供上层展示，旺衰结论统一以
  // assessStrength().isStrong / .level 为准。
  return { counts, strongest, weakest, strongValue, weakValue };
}

export function getMonthElementState(monthBranch: string, element: Element): string {
  return MONTH_ELEMENT_STATE[monthBranch]?.[element] || "";
}

/**
 * 旺衰细判：在总分值扶抑判断的基础上，补充“得令 / 得地 / 得势”三项独立校验，
 * 并给出更细颗粒度的旺衰等级（身旺 / 身强 / 中和 / 身弱 / 身极弱）与判定依据文案。
 *
 * - 得令：月支所主之五行（以月令旺相状态为准）与日主五行相同或为日主之印（生我）。
 * - 得地：日主之五行在年、日、时地支藏干中通根，累计权重达到有效门槛。
 * - 得势：天干（含月干）中比劫或印星帮扶日主的数量达到有效门槛。
 */
export function assessStrength(pillars: PillarDetails[], dayElement: Element): StrengthAssessment {
  const scores = computeStrength(pillars, dayElement);
  const dayPillar = pillars.find((pillar) => pillar.key === "day")!;
  const dayStem = dayPillar.stem.value;
  const monthBranch = pillars[1].branch.value;

  // 得令：月令本气五行与日主同气，或月令为日主之印（生扶日主）
  const monthState = getMonthElementState(monthBranch, dayElement);
  const deLing = monthState === "旺" || monthState === "相";

  // 得地：统计日主五行在四柱地支藏干中的权重合计（不含虚拟月令重复项）
  let rootWeight = 0;
  for (const pillar of pillars) {
    const weights = HIDDEN_STEM_WEIGHTS[pillar.branch.value];
    if (!weights) continue;
    for (const [stem, weight] of Object.entries(weights)) {
      if (STEM_META[stem].element === dayElement) {
        rootWeight += weight;
      }
    }
  }
  const deDi = rootWeight >= 5;

  // 得势：天干中比劫（同我）或印星（生我）帮扶日主的数量
  const supportElement = GENERATING[dayElement];
  let helpingStemCount = 0;
  for (const pillar of pillars) {
    if (pillar.stem.value === dayStem) continue; // 日主自身不计入帮扶
    if (pillar.stem.element === dayElement || pillar.stem.element === supportElement) {
      helpingStemCount += 1;
    }
  }
  const deShi = helpingStemCount >= 2;

  const total = Object.values(scores.counts).reduce((a, b) => a + b, 0);
  const supportRatio = total > 0 ? scores.strongValue / total : 0;

  const supportSignals = [deLing, deDi, deShi].filter(Boolean).length;

  // 四档判定统一以 supportRatio=0.5（扶抑力量是否过半）为方向基准，辅以
  // supportSignals（得令/得地/得势命中数）做校验，避免"名强实弱"或"名弱实强"：
  // 身旺/身强要求 supportRatio 高于半数，身弱/身极弱要求低于半数，档位差异
  // 仅体现在具体门槛的松紧（旺0.55/强0.5，弱0.4/极弱0.3），方向绝不矛盾。
  // 此前"身强"档误写为 supportRatio>0.45（低于半数即可称强），导致约2.5%
  // 抽样命局出现 supportRatio 不足五成却被判"身强"的自相矛盾，已订正为 >0.5。
  let level: StrengthLevel;
  const reasons: string[] = [];

  if (supportSignals === 3 && supportRatio > 0.55) {
    level = "身旺";
    reasons.push("日主既得令又得地得势，三气俱全，为身旺之局。");
  } else if (supportSignals >= 2 && supportRatio > 0.5) {
    level = "身强";
    reasons.push(`日主${deLing ? "得令" : deDi ? "得地" : "得势"}兼具其余助力，整体偏强。`);
  } else if (supportSignals === 0 && supportRatio < 0.3) {
    level = "身极弱";
    reasons.push("日主失令、失地、失势三者俱不占，克泄耗齐来，为身极弱之局。");
  } else if (supportSignals <= 1 && supportRatio < 0.4) {
    level = "身弱";
    reasons.push(`日主${!deLing ? "失令" : !deDi ? "失地" : "失势"}，扶助不足，整体偏弱。`);
  } else if (deLing && supportSignals === 1 && supportRatio > 0.5) {
    // 得令单独成立且分值过半：依《子平真诠》"月令独旺，气势虽薄，仍为偏强之局"
    // 得地/得势缺位时月令之气仍足以令日主偏强，三维标准不必全占。
    level = "身强";
    reasons.push("日主得令，虽失地失势，月令之气独旺，分值过半，整体偏强。");
  } else if (!deLing && supportSignals === 2 && supportRatio < 0.42) {
    // 失令兼总分不足42%：依《三命通会》"月令为提纲，失令则气弱"；
    // 《滴天髓》"失时失令，虽强变弱"——即使得地得势，月令克泄之势压制
    // 下总分不足，整体仍偏弱。
    level = "身弱";
    reasons.push("日主失令，虽得地得势，月令克泄之势重，总分不及四成二，整体偏弱。");
  } else {
    level = "中和";
    reasons.push("日主扶抑之力大致平衡，需结合格局与用神再定取舍。");
  }

  reasons.push(
    `得令：${deLing ? "是" : "否"}（月支${monthBranch}对日主${dayElement}呈"${monthState || "休囚"}"势）；` +
      `得地：${deDi ? "是" : "否"}（地支通根权重合计${rootWeight.toFixed(1)}）；` +
      `得势：${deShi ? "是" : "否"}（天干比劫/印星帮扶${helpingStemCount}位）。`
  );

  // isStrong 必须与上方三维细判的 level 同源推导（computeStrength 的单一总分
  // 阈值已废弃删除，见该函数注释），避免同一个 StrengthAssessment 对象内部
  // level 与 isStrong 两个字段互相矛盾。身旺/身强→true，身弱/身极弱→false，
  // 中和态以 supportRatio 是否过半兜底（与身强门槛>0.5衔接，>=0.5即算偏强），
  // 与大运流年评分（isStrongForFlow）、网页渲染层保持完全一致的唯一口径。
  const isStrong =
    level === "身旺" || level === "身强"
      ? true
      : level === "身弱" || level === "身极弱"
        ? false
        : supportRatio >= 0.5;

  return {
    level,
    isStrong,
    deLing,
    deDi,
    rootWeight,
    deShi,
    helpingStemCount,
    supportRatio,
    reasons
  };
}
