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

// 三合局的“半合”：三合三支中，凡含子/午/卯/酉（四正中神，五行之气最纯）的两支组合即可成局，
// 力量弱于完整三合，但仍是命理分析中常用的合局信号。不含中神的两支（如申辰缺子）不计半合。
export const BRANCH_HALF_TRIPLE_RELATIONS = [
  { type: "半合", members: ["申", "子"], result: "水" },
  { type: "半合", members: ["子", "辰"], result: "水" },
  { type: "半合", members: ["亥", "卯"], result: "木" },
  { type: "半合", members: ["卯", "未"], result: "木" },
  { type: "半合", members: ["寅", "午"], result: "火" },
  { type: "半合", members: ["午", "戌"], result: "火" },
  { type: "半合", members: ["巳", "酉"], result: "金" },
  { type: "半合", members: ["酉", "丑"], result: "金" }
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
  "戌": { "金": "相", "木": "囚", "水": "死", "火": "休", "土": "旺" },
  "亥": { "金": "休", "木": "相", "水": "旺", "火": "死", "土": "囚" },
  "子": { "金": "休", "木": "相", "水": "旺", "火": "死", "土": "囚" },
  "丑": { "金": "相", "木": "死", "水": "休", "火": "囚", "土": "旺" }
};

export const TEN_GOD_CONCRETE: Record<string, {
  career: string;
  personality: string;
  relationship: string;
  wealth: string;
}> = {
  "食神": {
    career: "表达能力、作品产出、歌唱/演艺才华、创作力",
    personality: "温和输出型——享受过程、有品味、厚道",
    relationship: "女命代表女儿；对伴侣温和但可能沉浸在自己世界",
    wealth: "食神生财=才华变现的通道"
  },
  "伤官": {
    career: "锐利表达、创新突破、演艺才华（比食神更激烈）",
    personality: "清高骄傲、追求极致、不服管、有叛逆心",
    relationship: "女命代表儿子；说话容易冒犯伴侣",
    wealth: "伤官生财=靠突破创新赚钱"
  },
  "正官": {
    career: "名气、职位、规则秩序、体制内发展",
    personality: "有责任感、讲规矩、在意身份和形象",
    relationship: "女命代表丈夫（正缘）；男命代表约束",
    wealth: "官生印=通过职位获取资源"
  },
  "七杀": {
    career: "名气（比正官更强）、压力、竞争、贵人",
    personality: "不服输、抗压强、在压力下反而出色",
    relationship: "女命代表情人/强势男性；关系中有压迫感",
    wealth: "杀为权=以势取财"
  },
  "正财": {
    career: "稳定收入、务实经营、踏实积累",
    personality: "务实、节俭、重视安全感",
    relationship: "男命代表妻子（正缘）",
    wealth: "正财=稳定的、可持续的收入来源"
  },
  "偏财": {
    career: "灵活运作、投资、经营、多渠道收入",
    personality: "大方、灵活、有经营头脑、社交广",
    relationship: "男命代表情人/异性缘；偏财=桃花",
    wealth: "偏财=意外之财、投资回报、灵活收入"
  },
  "正印": {
    career: "学习能力、证照、学历、平台支持",
    personality: "善良、有人缘、善于吸收、母性关怀",
    relationship: "代表母亲；配偶中寻找理解和支持",
    wealth: "印不直接生财，但印旺=平台好→间接生财"
  },
  "偏印": {
    career: "偏门灵感、非主流思路、独特技能",
    personality: "想法多、不走寻常路、有艺术感、但多虑",
    relationship: "与母亲关系复杂；偏印夺食=对子女不利",
    wealth: "偏印=通过独特技能或偏门渠道获利"
  },
  "比肩": {
    career: "竞争、独立、同行并进",
    personality: "独立意识强、不喜欢被安排、社交重质",
    relationship: "同性竞争；合伙中容易争主导权",
    wealth: "比肩=分财，合伙需谨慎"
  },
  "劫财": {
    career: "强竞争、争资源、主动出击",
    personality: "争强好胜、不服输、主动抢夺机会",
    relationship: "感情中有第三者风险；劫财=夺妻/夺财",
    wealth: "劫财=破财之象，逢劫财年控制支出"
  }
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

/**
 * 查取两支之间可能成立的六合/六冲/六害/相刑关系。
 *
 * 注意：地支两两关系并非互斥单选——传统命理中"寅巳申"三刑本身即由
 * 寅巳（六害）、巳申（六合）、寅申（六冲）三组两两关系叠加构成，"丑戌未"
 * 三刑同样叠加了丑未（六冲）、未戌（相刑）、丑戌（相刑）。此前实现在
 * BRANCH_PAIR_RELATIONS（六合/六冲/六害）命中后直接return、永不再检查
 * BRANCH_PUNISHMENTS（相刑），导致寅巳/巳申/寅申/丑未这四组本应同时成立
 * 两种关系的地支组合，相刑被六合/六冲/六害无声吞掉——批量抽样显示影响
 * 约30%的命局。现改为返回全部命中的关系数组，不再互相短路覆盖。
 */
export function findBranchPairRelations(
  branchA: string,
  branchB: string
): Array<{ type: string; result?: string }> {
  const matches: Array<{ type: string; result?: string }> = [];

  // 同一支不构成六合/六冲/六害等对宫关系，仅检查自刑
  if (branchA === branchB) {
    if (SELF_PUNISHMENTS.has(branchA)) {
      matches.push({ type: "自刑" });
    }
    return matches;
  }

  for (const relation of BRANCH_PAIR_RELATIONS) {
    if ((relation.members as readonly string[]).includes(branchA) && (relation.members as readonly string[]).includes(branchB)) {
      matches.push({
        type: relation.type,
        result: "result" in relation ? relation.result : undefined
      });
    }
  }

  for (const relation of BRANCH_PUNISHMENTS) {
    if ((relation.members as readonly string[]).includes(branchA) && (relation.members as readonly string[]).includes(branchB)) {
      matches.push({ type: relation.type });
    }
  }

  return matches;
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

// 半合判定：命局若已凑齐某三合局的三支，则该局内任意两支的“半合”视为已被完整三合覆盖，不重复列出，
// 避免同一组地支既报三合又报半合造成信号冗余。
export function findBranchHalfTripleRelations(branches: string[]): Array<{
  type: string;
  members: string[];
  result: string;
}> {
  const unique = [...new Set(branches)];
  const fullTripleGroups = BRANCH_TRIPLE_RELATIONS.filter((relation) =>
    relation.members.every((member) => unique.includes(member))
  );
  const isCoveredByFullTriple = (members: readonly string[]) =>
    fullTripleGroups.some((full) => members.every((member) => (full.members as readonly string[]).includes(member)));

  return BRANCH_HALF_TRIPLE_RELATIONS
    .filter((relation) => relation.members.every((member) => unique.includes(member)))
    .filter((relation) => !isCoveredByFullTriple(relation.members))
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


/**
 * 调候用神表：源自《穷通宝鉴》（又名《造化元钥》）十天干分月调候用神体系，
 * 以“日主天干 + 生月地支”为键，值为按优先级排列的调候用神天干分组
 * （数组下标0为首选、1为次选……同一优先级内可能并列多个天干）。
 * 相较于季节两分法（仅按夏月取水、冬月取火粗略判断），此表精确到具体日主
 * 在具体月份的调候取用，是传统命理“调候优先于扶抑”一派最核心的经典数据。
 * 数据来源于业界公认的穷通宝鉴调候用神表整理版本，其中原始整理存在的
 * 3处非天干噪声字符（辛午候选中的衍生字、辛酉候选中的衍生字、癸丑候选中的
 * 描述性文字）已按“仅保留可信天干、不做臆测性替换”的原则清洗剔除。
 */
export const TIAO_HOU_TABLE: Record<string, string[]> = {
  "丁丑": ["甲", "庚"],
  "丁亥": ["甲", "庚"],
  "丁午": ["壬", "癸庚"],
  "丁卯": ["庚", "甲"],
  "丁子": ["丙"],
  "丁寅": ["甲", "庚"],
  "丁巳": ["甲", "庚"],
  "丁戌": ["甲", "戊庚"],
  "丁未": ["甲", "庚壬"],
  "丁申": ["甲", "丙庚", "戊"],
  "丁辰": ["甲", "庚"],
  "丁酉": ["甲", "丙庚", "戊"],
  "丙丑": ["壬", "甲"],
  "丙亥": ["甲", "壬", "戊"],
  "丙午": ["壬", "庚"],
  "丙卯": ["壬", "己"],
  "丙子": ["壬", "己戊"],
  "丙寅": ["壬", "庚"],
  "丙巳": ["壬", "癸庚"],
  "丙戌": ["壬", "甲"],
  "丙未": ["壬", "庚"],
  "丙申": ["壬", "戊"],
  "丙辰": ["壬", "甲"],
  "丙酉": ["壬", "癸"],
  "乙丑": ["丙"],
  "乙亥": ["丙", "戊"],
  "乙午": ["癸", "丙"],
  "乙卯": ["丙", "癸"],
  "乙子": ["丙"],
  "乙寅": ["丙", "癸"],
  "乙巳": ["癸"],
  "乙戌": ["癸", "辛"],
  "乙未": ["癸", "丙"],
  "乙申": ["癸庚", "丙"],
  "乙辰": ["癸", "戊丙"],
  "乙酉": ["癸", "丁丙"],
  "壬丑": ["丙", "甲丁"],
  "壬亥": ["戊", "庚丙"],
  "壬午": ["癸", "辛庚"],
  "壬卯": ["戊", "庚辛"],
  "壬子": ["戊", "丙"],
  "壬寅": ["庚", "戊丙"],
  "壬巳": ["庚辛", "癸"],
  "壬戌": ["甲", "丙"],
  "壬未": ["辛", "甲"],
  "壬申": ["戊", "丁"],
  "壬辰": ["甲", "庚"],
  "壬酉": ["甲", "庚"],
  "己丑": ["丙", "戊甲"],
  "己亥": ["丙", "戊甲"],
  "己午": ["癸", "丙"],
  "己卯": ["甲", "癸丙"],
  "己子": ["丙", "戊甲"],
  "己寅": ["丙", "甲庚"],
  "己巳": ["癸", "丙"],
  "己戌": ["甲", "癸丙"],
  "己未": ["癸", "丙"],
  "己申": ["丙", "癸"],
  "己辰": ["丙", "甲癸"],
  "己酉": ["丙", "癸"],
  "庚丑": ["丙", "甲丁"],
  "庚亥": ["丁", "丙"],
  "庚午": ["壬", "癸"],
  "庚卯": ["丁", "丙甲", "庚"],
  "庚子": ["丁", "丙甲"],
  "庚寅": ["戊", "丙甲", "丁壬"],
  "庚巳": ["壬", "丙戊", "丁"],
  "庚戌": ["甲", "壬"],
  "庚未": ["丁", "甲"],
  "庚申": ["丁", "甲"],
  "庚辰": ["甲", "壬丁", "癸"],
  "庚酉": ["丁", "丙甲"],
  "戊丑": ["丙", "甲"],
  "戊亥": ["甲", "丙"],
  "戊午": ["壬", "丙甲"],
  "戊卯": ["丙", "癸甲"],
  "戊子": ["丙", "甲"],
  "戊寅": ["丙", "癸甲"],
  "戊巳": ["甲", "癸丙"],
  "戊戌": ["甲", "癸丙"],
  "戊未": ["癸", "甲丙"],
  "戊申": ["丙", "甲癸"],
  "戊辰": ["甲", "癸丙"],
  "戊酉": ["丙", "癸"],
  "甲丑": ["丁", "丙庚"],
  "甲亥": ["庚", "戊丁", "丙"],
  "甲午": ["癸", "庚丁"],
  "甲卯": ["庚", "戊丙", "丁"],
  "甲子": ["丁", "丙庚"],
  "甲寅": ["丙", "癸"],
  "甲巳": ["癸", "庚丁"],
  "甲戌": ["庚壬", "癸丁"],
  "甲未": ["癸", "庚丁"],
  "甲申": ["丁", "壬"],
  "甲辰": ["庚", "壬丁"],
  "甲酉": ["庚", "丙丁"],
  "癸丑": ["丙", "丁"],
  "癸亥": ["庚", "戊辛", "丁"],
  "癸午": ["庚", "癸壬"],
  "癸卯": ["庚", "辛"],
  "癸子": ["丙", "辛"],
  "癸寅": ["辛", "丙"],
  "癸巳": ["辛"],
  "癸戌": ["辛", "壬甲", "癸"],
  "癸未": ["庚", "壬辛", "癸"],
  "癸申": ["丁"],
  "癸辰": ["丙", "甲辛"],
  "癸酉": ["辛", "丙"],
  "辛丑": ["丙", "戊壬", "己"],
  "辛亥": ["壬", "丙"],
  "辛午": ["壬", "癸"],
  "辛卯": ["壬", "甲"],
  "辛子": ["丙", "壬戊", "甲"],
  "辛寅": ["己", "庚壬"],
  "辛巳": ["壬", "癸甲"],
  "辛戌": ["壬", "甲"],
  "辛未": ["壬", "甲庚"],
  "辛申": ["壬", "戊甲"],
  "辛辰": ["壬", "甲"],
  "辛酉": ["壬"]
};
