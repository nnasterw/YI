import type { Element, YinYang } from "./types";

export const STEM_META: Record<string, { element: Element; yinYang: YinYang }> = {
  甲: { element: "木", yinYang: "阳" },
  乙: { element: "木", yinYang: "阴" },
  丙: { element: "火", yinYang: "阳" },
  丁: { element: "火", yinYang: "阴" },
  戊: { element: "土", yinYang: "阳" },
  己: { element: "土", yinYang: "阴" },
  庚: { element: "金", yinYang: "阳" },
  辛: { element: "金", yinYang: "阴" },
  壬: { element: "水", yinYang: "阳" },
  癸: { element: "水", yinYang: "阴" }
};

export const BRANCH_META: Record<
  string,
  { element: Element; yinYang: YinYang; hiddenStems: string[] }
> = {
  子: { element: "水", yinYang: "阳", hiddenStems: ["癸"] },
  丑: { element: "土", yinYang: "阴", hiddenStems: ["己", "癸", "辛"] },
  寅: { element: "木", yinYang: "阳", hiddenStems: ["甲", "丙", "戊"] },
  卯: { element: "木", yinYang: "阴", hiddenStems: ["乙"] },
  辰: { element: "土", yinYang: "阳", hiddenStems: ["戊", "乙", "癸"] },
  巳: { element: "火", yinYang: "阴", hiddenStems: ["丙", "庚", "戊"] },
  午: { element: "火", yinYang: "阳", hiddenStems: ["丁", "己"] },
  未: { element: "土", yinYang: "阴", hiddenStems: ["己", "丁", "乙"] },
  申: { element: "金", yinYang: "阳", hiddenStems: ["庚", "壬", "戊"] },
  酉: { element: "金", yinYang: "阴", hiddenStems: ["辛"] },
  戌: { element: "土", yinYang: "阳", hiddenStems: ["戊", "辛", "丁"] },
  亥: { element: "水", yinYang: "阴", hiddenStems: ["壬", "甲"] }
};

export const TEN_GODS = [
  "比肩",
  "劫财",
  "食神",
  "伤官",
  "偏财",
  "正财",
  "七杀",
  "正官",
  "偏印",
  "正印"
] as const;

export const STEM_COMBINATIONS = [
  { members: ["甲", "己"], result: "土", label: "天干五合" },
  { members: ["乙", "庚"], result: "金", label: "天干五合" },
  { members: ["丙", "辛"], result: "水", label: "天干五合" },
  { members: ["丁", "壬"], result: "木", label: "天干五合" },
  { members: ["戊", "癸"], result: "火", label: "天干五合" }
] as const;

export const BRANCH_PAIR_RELATIONS = [
  { type: "六合", members: ["子", "丑"], result: "土" },
  { type: "六合", members: ["寅", "亥"], result: "木" },
  { type: "六合", members: ["卯", "戌"], result: "火" },
  { type: "六合", members: ["辰", "酉"], result: "金" },
  { type: "六合", members: ["巳", "申"], result: "水" },
  { type: "六合", members: ["午", "未"], result: "土" },
  { type: "六冲", members: ["子", "午"] },
  { type: "六冲", members: ["丑", "未"] },
  { type: "六冲", members: ["寅", "申"] },
  { type: "六冲", members: ["卯", "酉"] },
  { type: "六冲", members: ["辰", "戌"] },
  { type: "六冲", members: ["巳", "亥"] },
  { type: "六害", members: ["子", "未"] },
  { type: "六害", members: ["丑", "午"] },
  { type: "六害", members: ["寅", "巳"] },
  { type: "六害", members: ["卯", "辰"] },
  { type: "六害", members: ["申", "亥"] },
  { type: "六害", members: ["酉", "戌"] }
] as const;

export const BRANCH_TRIPLE_RELATIONS = [
  { type: "三合", members: ["申", "子", "辰"], result: "水" },
  { type: "三合", members: ["亥", "卯", "未"], result: "木" },
  { type: "三合", members: ["寅", "午", "戌"], result: "火" },
  { type: "三合", members: ["巳", "酉", "丑"], result: "金" },
  { type: "三会", members: ["寅", "卯", "辰"], result: "木" },
  { type: "三会", members: ["巳", "午", "未"], result: "火" },
  { type: "三会", members: ["申", "酉", "戌"], result: "金" },
  { type: "三会", members: ["亥", "子", "丑"], result: "水" }
] as const;

export const BRANCH_PUNISHMENTS = [
  { type: "相刑", members: ["子", "卯"] },
  { type: "相刑", members: ["寅", "巳"] },
  { type: "相刑", members: ["巳", "申"] },
  { type: "相刑", members: ["寅", "申"] },
  { type: "相刑", members: ["丑", "未"] },
  { type: "相刑", members: ["未", "戌"] },
  { type: "相刑", members: ["丑", "戌"] }
] as const;

export const SELF_PUNISHMENTS = new Set(["辰", "午", "酉", "亥"]);

export const HIDDEN_STEM_WEIGHTS: Record<string, Record<string, number>> = {
  "子": { "癸": 8 },
  "丑": { "己": 5, "癸": 2, "辛": 1 },
  "寅": { "甲": 5, "丙": 2, "戊": 1 },
  "卯": { "乙": 8 },
  "辰": { "戊": 5, "乙": 2, "癸": 1 },
  "巳": { "丙": 5, "戊": 2, "庚": 1 },
  "午": { "丁": 5, "己": 3 },
  "未": { "己": 5, "丁": 2, "乙": 1 },
  "申": { "庚": 5, "壬": 2, "戊": 1 },
  "酉": { "辛": 8 },
  "戌": { "戊": 5, "辛": 2, "丁": 1 },
  "亥": { "壬": 5, "甲": 3 }
};

export const MONTH_ELEMENT_STATE: Record<string, Record<string, string>> = {
  "寅": { "金": "囚", "木": "旺", "水": "休", "火": "相", "土": "死" },
  "卯": { "金": "囚", "木": "旺", "水": "休", "火": "相", "土": "死" },
  "辰": { "金": "相", "木": "囚", "水": "死", "火": "休", "土": "旺" },
  "巳": { "金": "死", "木": "休", "水": "囚", "火": "旺", "土": "相" },
  "午": { "金": "死", "木": "休", "水": "囚", "火": "旺", "土": "相" },
  "未": { "金": "相", "木": "囚", "水": "死", "火": "休", "土": "旺" },
  "申": { "金": "旺", "木": "死", "水": "相", "火": "囚", "土": "休" },
  "酉": { "金": "旺", "木": "死", "水": "相", "火": "囚", "土": "休" },
  "戌": { "金": "休", "木": "死", "水": "相", "火": "囚", "土": "旺" },
  "亥": { "金": "休", "木": "相", "水": "旺", "火": "死", "土": "囚" },
  "子": { "金": "休", "木": "相", "水": "旺", "火": "死", "土": "囚" },
  "丑": { "金": "相", "木": "死", "水": "休", "火": "囚", "土": "旺" }
};

const ELEMENT_GENERATES: Record<Element, Element> = {
  木: "火",
  火: "土",
  土: "金",
  金: "水",
  水: "木"
};

const ELEMENT_CONTROLS: Record<Element, Element> = {
  木: "土",
  火: "金",
  土: "水",
  金: "木",
  水: "火"
};

export function findBranchPairRelation(
  branchA: string,
  branchB: string
): { type: string; result?: string } | undefined {
  for (const relation of BRANCH_PAIR_RELATIONS) {
    if ((relation.members as readonly string[]).includes(branchA) && (relation.members as readonly string[]).includes(branchB)) {
      return {
        type: relation.type,
        result: "result" in relation ? relation.result : undefined
      };
    }
  }

  for (const relation of BRANCH_PUNISHMENTS) {
    if ((relation.members as readonly string[]).includes(branchA) && (relation.members as readonly string[]).includes(branchB)) {
      return { type: relation.type };
    }
  }

  if (branchA === branchB && SELF_PUNISHMENTS.has(branchA)) {
    return { type: "自刑" };
  }

  return undefined;
}

export function findBranchTripleRelations(branches: string[]): Array<{
  type: string;
  members: string[];
  result: string;
}> {
  const unique = [...new Set(branches)];
  return BRANCH_TRIPLE_RELATIONS
    .filter((relation) => relation.members.every((member) => unique.includes(member)))
    .map((relation) => ({
      type: relation.type,
      members: [...relation.members],
      result: relation.result
    }));
}

export function getElementInteraction(
  from: Element,
  to: Element
): "same" | "generate" | "generated-by" | "control" | "controlled-by" {
  if (from === to) {
    return "same";
  }
  if (ELEMENT_GENERATES[from] === to) {
    return "generate";
  }
  if (ELEMENT_GENERATES[to] === from) {
    return "generated-by";
  }
  if (ELEMENT_CONTROLS[from] === to) {
    return "control";
  }
  return "controlled-by";
}

export function computeTenGod(dayStem: string, otherStem: string): string {
  if (dayStem === otherStem) {
    return "比肩";
  }
  const day = STEM_META[dayStem];
  const other = STEM_META[otherStem];
  const samePolarity = day.yinYang === other.yinYang;
  const interaction = getElementInteraction(day.element, other.element);

  switch (interaction) {
    case "same":
      return samePolarity ? "比肩" : "劫财";
    case "generate":
      return samePolarity ? "食神" : "伤官";
    case "control":
      return samePolarity ? "偏财" : "正财";
    case "controlled-by":
      return samePolarity ? "七杀" : "正官";
    case "generated-by":
      return samePolarity ? "偏印" : "正印";
  }
}

