import {
  BRANCH_HALF_TRIPLE_RELATIONS,
  BRANCH_META,
  BRANCH_TRIPLE_RELATIONS,
  STEM_META,
  computeTenGod,
  findBranchPairRelations,
  getElementInteraction
} from "./constants";
import { CONTROLLING } from "./scoring";
import type {
  AnalysisTone,
  BaziAnalysis,
  Element,
  ElementBalance,
  FlowAnalysis,
  FlowSignal,
  Gender,
  PatternAssessment,
  PillarDetails,
  RelationRecord,
  ShenShaRecord,
  StrengthAssessment,
  TenGodDistribution,
  YongShenAssessment
} from "./types";

const DIMENSION_FALLBACK = {
  career: "当前样本更适合结合大运和流年一起判断事业起伏。",
  relationships: "关系宫位还需要结合大运、流年与日支联动一起判断。",
  health: "健康维度建议结合五行偏枯、寒热燥湿再做二次细分。",
  wealth: "财富维度建议结合财星来源、比劫分财和大运触发一起判断。"
} as const;

const FLOW_DIMENSIONS = ["overall", "career", "relationships", "health", "wealth"] as const;
type FlowDimensionKey = (typeof FLOW_DIMENSIONS)[number];
type FlowScoreState = Record<FlowDimensionKey, { score: number; messages: string[] }>;

function rankRecord(record: Record<string, number>): string[] {
  const max = Math.max(0, ...Object.values(record));
  if (max === 0) {
    return [];
  }
  return Object.entries(record)
    .filter(([, value]) => value === max)
    .map(([key]) => key);
}

function classifyTone(score: number): AnalysisTone {
  if (score >= 2) {
    return "supportive";
  }
  if (score <= -2) {
    return "challenging";
  }
  return "mixed";
}

function createFlowScoreState(): FlowScoreState {
  return {
    overall: { score: 0, messages: [] },
    career: { score: 0, messages: [] },
    relationships: { score: 0, messages: [] },
    health: { score: 0, messages: [] },
    wealth: { score: 0, messages: [] }
  };
}

function addMessage(
  state: FlowScoreState,
  dimension: FlowDimensionKey,
  delta: number,
  message: string
): void {
  state[dimension].score += delta;
  if (!state[dimension].messages.includes(message)) {
    state[dimension].messages.push(message);
  }
}

function buildSignalKey(signal: FlowSignal): string {
  return [
    signal.category,
    signal.type,
    signal.tone,
    signal.members.join("|"),
    signal.description,
    signal.result ?? ""
  ].join("::");
}

function pushSignal(
  signals: FlowSignal[],
  seen: Set<string>,
  signal: FlowSignal
): boolean {
  const key = buildSignalKey(signal);
  if (seen.has(key)) {
    return false;
  }
  seen.add(key);
  signals.push(signal);
  return true;
}

function getElementTotals(balance: ElementBalance): Record<Element, number> {
  return {
    木: balance.counts.木.total,
    火: balance.counts.火.total,
    土: balance.counts.土.total,
    金: balance.counts.金.total,
    水: balance.counts.水.total
  };
}

function getFlowTripleRelations(flowBranch: string, natalBranches: string[]): Array<{
  type: string;
  members: string[];
  result: string;
}> {
  const allBranches = [...new Set([...natalBranches, flowBranch])];
  return BRANCH_TRIPLE_RELATIONS
    .filter((relation) =>
      (relation.members as readonly string[]).includes(flowBranch) &&
      relation.members.every((member) => allBranches.includes(member))
    )
    .map((relation) => ({
      type: relation.type,
      members: [...relation.members],
      result: relation.result
    }));
}

// 流年地支引动原局地支形成“半合”：三合局中含子/午/卯/酉中神的两支组合即可成立，力量弱于完整三合。
// 若流年与原局已能凑齐完整三合/三会，则不重复标记其子集半合，避免信号冗余。
function getFlowHalfTripleRelations(flowBranch: string, natalBranches: string[]): Array<{
  type: string;
  members: string[];
  result: string;
}> {
  const allBranches = [...new Set([...natalBranches, flowBranch])];
  const fullTripleGroups = BRANCH_TRIPLE_RELATIONS.filter((relation) =>
    relation.members.every((member) => allBranches.includes(member))
  );
  const isCoveredByFullTriple = (members: readonly string[]) =>
    fullTripleGroups.some((full) => members.every((member) => (full.members as readonly string[]).includes(member)));

  return BRANCH_HALF_TRIPLE_RELATIONS
    .filter((relation) =>
      (relation.members as readonly string[]).includes(flowBranch) &&
      relation.members.every((member) => allBranches.includes(member))
    )
    .filter((relation) => !isCoveredByFullTriple(relation.members))
    .map((relation) => ({
      type: relation.type,
      members: [...relation.members],
      result: relation.result
    }));
}

export function buildElementBalance(pillars: PillarDetails[]): ElementBalance {
  const counts: ElementBalance["counts"] = {
    木: { visibleStems: 0, hiddenStems: 0, total: 0 },
    火: { visibleStems: 0, hiddenStems: 0, total: 0 },
    土: { visibleStems: 0, hiddenStems: 0, total: 0 },
    金: { visibleStems: 0, hiddenStems: 0, total: 0 },
    水: { visibleStems: 0, hiddenStems: 0, total: 0 }
  };

  for (const pillar of pillars) {
    counts[pillar.stem.element].visibleStems += 1;
    counts[pillar.stem.element].total += 1;
    for (const hiddenStem of pillar.branch.hiddenStems) {
      counts[hiddenStem.element].hiddenStems += 1;
      counts[hiddenStem.element].total += 1;
    }
  }

  const totals = getElementTotals({ counts, strongest: [], weakest: [], observations: [] });
  const max = Math.max(...Object.values(totals));
  const min = Math.min(...Object.values(totals));

  const strongest = (Object.entries(totals) as [Element, number][])
    .filter(([, value]) => value === max)
    .map(([element]) => element);
  const weakest = (Object.entries(totals) as [Element, number][])
    .filter(([, value]) => value === min)
    .map(([element]) => element);

  const observations: string[] = [];
  if (max - min >= 3) {
    observations.push(
      `五行分布存在明显偏重，${strongest.join("、")}偏强，${weakest.join("、")}偏弱。`
    );
  } else {
    observations.push("五行分布相对均衡，后续更要看组合方式和运势触发。");
  }

  return {
    counts,
    strongest,
    weakest,
    observations
  };
}

export function buildTenGodDistribution(pillars: PillarDetails[]): TenGodDistribution {
  const counts: Record<string, number> = {};

  for (const pillar of pillars) {
    if (pillar.stem.tenGod !== "日主") {
      counts[pillar.stem.tenGod] = (counts[pillar.stem.tenGod] ?? 0) + 1;
    }
    for (const hiddenStem of pillar.branch.hiddenStems) {
      counts[hiddenStem.tenGod] = (counts[hiddenStem.tenGod] ?? 0) + 1;
    }
  }

  const dominant = rankRecord(counts);
  const observations =
    dominant.length > 0
      ? [`十神主轴偏向${dominant.join("、")}，说明对应的人事主题更容易反复出现。`]
      : ["十神分布较散，命局更依赖结构组合而不是单一十神主导。"];

  return {
    counts,
    dominant,
    observations
  };
}

export function buildNarrativeAnalysis(args: {
  dayMaster: PillarDetails["stem"];
  elementBalance: ElementBalance;
  tenGodDistribution: TenGodDistribution;
  relations: RelationRecord[];
  startSolar: string;
  direction: "forward" | "backward";
  dayBranch: string;
  strength: StrengthAssessment;
  pattern: PatternAssessment;
  yongShen: YongShenAssessment;
  shenSha: ShenShaRecord[];
  gender: Gender;
}): BaziAnalysis {
  const {
    dayMaster,
    elementBalance,
    tenGodDistribution,
    relations,
    startSolar,
    direction,
    dayBranch,
    strength,
    pattern,
    yongShen,
    gender,
    shenSha
  } = args;

  // 概述只保留综合判断，不重复基本信息卡片中的日主/五行/十神/起运等原始数据。
  const overview: string[] = [];
  overview.push(
    `格局定为${pattern.name}（${pattern.category}），以${pattern.governingTenGod}为纲，当前判断倾向${pattern.outcome}。`
  );
  overview.push(
    `用神取用以${yongShen.primaryMethod}法为主，具体喜忌五行与方位详见下方「喜忌用神」表。`
  );
  // 中和态需按 strength.isStrong（supportRatio>=0.5 的二次区分，见 scoring.ts）
  // 区分偏强/偏弱措辞，不能无脑说"大致平衡"——否则会与同一份报告里用神取用
  // （如病药法"比劫重重为病，宜克制"）明确给出的偏强/偏弱结论自相矛盾。
  if (strength.level === "中和") {
    overview.push(
      strength.isStrong
        ? `日主中和偏强（扶抵占比${Math.round(strength.supportRatio * 100)}%），仍以克泄耗为宜，需结合格局与用神再定取舍。`
        : `日主中和偏弱（扶抵占比${Math.round(strength.supportRatio * 100)}%），仍以生扶为宜，需结合格局与用神再定取舍。`
    );
  }

  const career: string[] = [];
  const wealth: string[] = [];
  const relationships: string[] = [];
  const health: string[] = [];

  const officerScore =
    (tenGodDistribution.counts.正官 ?? 0) + (tenGodDistribution.counts.七杀 ?? 0);
  const resourceScore =
    (tenGodDistribution.counts.正印 ?? 0) + (tenGodDistribution.counts.偏印 ?? 0);
  const outputScore =
    (tenGodDistribution.counts.食神 ?? 0) + (tenGodDistribution.counts.伤官 ?? 0);
  const wealthScore =
    (tenGodDistribution.counts.正财 ?? 0) + (tenGodDistribution.counts.偏财 ?? 0);
  const peerScore =
    (tenGodDistribution.counts.比肩 ?? 0) + (tenGodDistribution.counts.劫财 ?? 0);

  // 变格专属 career 文案（依《子平真诠》《三命通会》变格取用原则）
  if (pattern.category === "变格") {
    switch (pattern.name) {
      case "从强格":
        // 从强格：日主及比印极旺，宜顺其强势，不宜以官杀、财星抑制
        // 依据：《子平真诠》"从强者，四柱无财官，比劫印绶重重，日主无泄，以强论"
        career.push("从强格以日主自身能量为纲，事业最宜独立门户、自主发展或开创事业，越顺从自身意志方向越顺。");
        career.push("大运忌走财官（克泄）之地，顺比印之运时格局稳定、事业顺遂；逆势运中需格外稳健，勿强行拓展。");
        break;
      case "从财格":
        // 依据：《子平真诠》"从财者，日主无根，满局财星或财得令，财气专旺"
        // "从财格宜从财，财官食伤皆为喜，比印破格最忌"
        career.push("从财格以财星能量为核心驱动，天然适合经营、商业、资本运作、财务管理等与钱财资源直接挂钩的路径。");
        career.push("大运喜走财官食伤之地，合作与资源整合能力是核心竞争力；比劫印绶运破格，需注意资金消耗与竞争压力。");
        break;
      case "从杀格":
        // 依据：《子平真诠》"从杀者，日主无根，满局官杀，日主无力抗拒，顺其杀势"
        // "从杀格，官杀为权，财生官杀为喜，宜在权力或竞争体系内发展"
        career.push("从杀格以官杀权势为纲，在竞争激烈、层级分明或高压任务型环境中反而能量爆发；适合体制内、军警、高管等权力体系赛道。");
        career.push("大运喜走财杀之地，能量在压力与约束中释放；比劫印绶运破格，遇自我膨胀或抗拒管束时反易受阻。");
        break;
      case "从儿格":
        // 依据：《子平真诠》"从儿格，日主气弱，食伤泄秀独旺，以食伤为用"
        // "从儿格，食伤为纲，才艺、技术、创作皆宜，顺其秀气流泄"
        career.push("从儿格以食伤秀气为纲，才艺、技术、创意、写作、学术、设计等需要输出能力的领域最能发挥天赋。");
        career.push("大运喜走食伤财星之地，技能变现路径顺畅；官杀运克制食伤为忌，印绶运回克反弄巧成拙，需格外谨慎转型。");
        break;
    }
  } else {
    // 正格 career 分析
    if (officerScore >= 3) {
      career.push("官杀信息偏重，做事倾向看重秩序、责任与结果，适合有规则边界的岗位。");
    }
    if (resourceScore >= 3) {
      career.push("印星支持较足，学习吸收、证照积累、方法论沉淀往往能放大事业稳定性。");
    }
    if (outputScore >= 3) {
      career.push("食伤较活跃，适合表达、策划、产品、创作、咨询等需要输出能力的场景。");
    }
    if (pattern.outcome === "成格") {
      career.push("格局清纯，事业发展宜顺势强化优势领域。");
    } else if (pattern.outcome === "败格") {
      career.push("存在破格信号，事业上更需靠后天努力和大运补位。");
    }
    if (yongShen.yongShen.includes(dayMaster.element) || peerScore >= 3) {
      career.push("命局比劫或同气力量参与用神取用，适合团队协作、合伙经营或需要人脉资源整合的路径。");
    }
  }
  if (career.length === 0) {
    career.push(DIMENSION_FALLBACK.career);
  }

  // 变格专属 wealth 文案
  if (pattern.category === "变格") {
    switch (pattern.name) {
      case "从强格":
        // 从强格忌财（财破比劫或印），宜比劫帮身，财运反不利
        wealth.push("从强格忌财星（财克比劫或引官杀破格），大运流年引动财星时需防资金消耗和外部干扰；积累财富靠的是把自身强势能力变现，而非单纯追逐财星。");
        break;
      case "从财格":
        // 从财格财星为喜，宜顺势经营
        wealth.push("从财格以财星为用，财运、投资机会来临时顺势把握，资源整合和商业嗅觉是天然优势；比劫运中须防合伙纠纷和资金分流。");
        break;
      case "从杀格":
        // 从杀格财生官杀为喜，财是间接助力
        wealth.push("从杀格财星生官杀，财富积累往往通过权力平台或职务晋升带来；在体系内做出成绩、获得认可是财富增长的主要路径，宜以事业带财。");
        break;
      case "从儿格":
        // 从儿格食伤生财，技能变现是核心
        wealth.push("从儿格以食伤泄秀为用，财富来自技能、才艺或智识的直接变现；专注深耕一门手艺或输出能力，让食伤生财的自然通道保持畅通。");
        break;
    }
  } else {
    // 正格 wealth 分析
    if (wealthScore >= 3) {
      wealth.push("财星活跃，命盘对资源、项目、交易和现金流更敏感，利于经营意识的培养。");
    }
    if (peerScore >= 3) {
      wealth.push("比劫偏多，拿项目、做合伙、争资源的动力强，但也要防止分财与成本失控。");
    }
    if (yongShen.yongShen.includes(CONTROLLING[dayMaster.element])) {
      wealth.push("财星恰与用神方向重合，理财与创收的天然敏感度更高，值得重点经营。");
    }
  }
  if (yongShen.yongShen.length > 0) {
    wealth.push(
      `用神方向以${yongShen.yongShen.join("、")}为先，大运流年一旦引动此类五行，往往是财富节奏的重要触发点。`
    );
  }
  if (wealth.length === 0) {
    wealth.push(DIMENSION_FALLBACK.wealth);
  }

  const dayBranchRelations = relations.filter(
    (relation) =>
      relation.category === "earthly-branch" && relation.members.includes(dayBranch)
  );
  const tenseRelation = dayBranchRelations.find((relation) =>
    ["六冲", "六害", "相刑", "自刑"].includes(relation.type)
  );
  const supportiveRelation = dayBranchRelations.find((relation) =>
    ["六合", "三合", "三会", "半合"].includes(relation.type)
  );

  // 变格专属 relationships 文案（依《子平真诠》《三命通会》各变格格局人际特征）
  if (pattern.category === "变格") {
    switch (pattern.name) {
      case "从强格":
        // 从强格日主气势独强，感情模式偏于主导，对等关系中最忌对方"克制"自我
        // 依据：《三命通会》"从强者，气势一边倒，最宜顺从，逆之则激"
        relationships.push("从强格人际中自我意志偏强，在感情和合作里更容易以自身节奏为主轴；对能顺应、配合自己方向的人缘分更深，遇强势对抗或管束反而关系趋紧。");
        relationships.push("喜欢在关系中保持主动位置，感情适合找能欣赏和追随自身方向的伴侣；合作伙伴最宜气场相近、能协同而非制衡的类型。");
        break;
      case "从财格":
        // 从财格以财为用，感情中正财代表配偶，财旺则夫妻关系通达
        // 依据：《子平真诠》"从财格，正财旺者，婚配和谐；财弱则情缘不稳"
        relationships.push("从财格以财星为命局纲领，正财代表配偶能量，感情关系多与资源、实际利益捆绑；在物质基础稳固的环境下，情感关系更容易落地和稳固。");
        relationships.push("人际中善于建立互利合作，资源整合和信任积累是维系关系的核心；比劫运中需防合伙纠纷和竞争侵蚀。");
        break;
      case "从杀格":
        // 从杀格官杀旺，感情带有"权威服从"色彩，或在高压环境中更容易建立深度关系
        // 依据：《三命通会》"从杀者，顺其杀势方通，感情亦然，遇强则服，遇软则失焦"
        relationships.push("从杀格感情模式带有一定服从权威或在高压关系中磨合成长的特点；在有清晰边界和规则感的关系里反而更踏实，不拘束反而缺乏方向感。");
        relationships.push("人际中对能给予结构和保护感的权威类型更有好感；自身在关系中也可能扮演「执行者」或「协从者」角色，但应警惕过度依附或压抑。");
        break;
      case "从儿格":
        // 从儿格食伤旺，感情中伤官星代表配偶（男命），情感表达丰富，但容易因言辞锋利或个性鲜明产生摩擦
        // 依据：《子平真诠》"伤官旺者，感情浓烈而情绪化，需留意因口舌或个性冲撞关系"
        relationships.push("从儿格食伤秀气旺盛，感情表达丰富、细腻，对美感和精神共鸣要求高；但食伤过旺时容易因才气外露、锋芒毕现，与人摩擦增加，关系需要刻意经营温度。");
        relationships.push("人际中容易被欣赏才艺或气质吸引，也容易主动展示；官杀运中感情关系会更明显地受到约束或外部压力影响，需格外注意相处方式。");
        break;
    }
  }

  if (supportiveRelation) {
    relationships.push(`日支参与${supportiveRelation.type}，亲密关系更容易被联动、合和或外部缘分触发。`);
  }
  if (tenseRelation) {
    relationships.push(`日支出现${tenseRelation.type}，情感关系里更要留意节奏拉扯、误解累积和边界冲撞。`);
  }

  // 正格：基于十神的 relationships 信号（依《子平真诠》《三命通会》）
  // 正财旺：男命正财代表配偶，旺而有用则婚配和谐；正官旺：女命正官代表配偶
  // 依据：《子平真诠》"正财旺、正官旺者，男女婚配皆主和谐"
  //       《三命通会》"财星得令，妻贤；官星得令，夫荣"
  if (pattern.category !== "变格") {
    const zhengCaiCount = tenGodDistribution.counts["正财"] ?? 0;
    const zhengGuanCount = tenGodDistribution.counts["正官"] ?? 0;
    const shangGuanCount = tenGodDistribution.counts["伤官"] ?? 0;
    const qiShaCount = tenGodDistribution.counts["七杀"] ?? 0;

    if (gender === "male" && zhengCaiCount >= 2) {
      // 男命正财多：多妻缘或感情场拉扯，财多身弱则反为负担
      if (strength.isStrong) {
        relationships.push("命局正财多而日主有力，感情机缘较丰，能承接财星代表的配偶与资源能量，婚缘较顺。");
      } else {
        relationships.push("命局正财偏多而日主气弱，财星反成负担，感情中容易被动受牵制；先固根基再拓展关系。");
      }
    }
    if (gender === "female" && zhengGuanCount >= 2) {
      // 女命正官多：或婚姻关系多番，或感情中对规则与责任较敏感
      relationships.push("命局正官偏多，感情中对规则、承诺与责任感的需求较强；大运逢官星旺地，婚配议题易被激活。");
    }
    if (gender === "female" && qiShaCount >= 2 && zhengGuanCount === 0) {
      // 女命七杀旺而无正官：感情偏向强势有吸引力的对象，关系容易高张力
      relationships.push("命局七杀偏重而无正官制化，感情模式偏向高张力、强吸引的类型；需留意关系节奏过快或情绪拉锯。");
    }
    if (shangGuanCount >= 2 && (gender === "female" ? zhengGuanCount > 0 : true)) {
      // 伤官旺：感情表达直接锋利，容易因言辞产生摩擦（女命伤官见官更甚）
      relationships.push("命局伤官活跃，感情中情绪和言辞容易外露；优点是真实直接，但也需注意边界与表达方式，避免无意中刺伤亲密关系。");
    }
  }

  const taoHua = shenSha.find((record) => record.name === "桃花");
  if (taoHua) {
    relationships.push(`命局带桃花神煞（见于${taoHua.hitPillars.join("、")}），异性缘或人际吸引力相对突出，也更需留意情感边界。`);
  }
  const tianYi = shenSha.find((record) => record.name === "天乙贵人");
  if (tianYi) {
    relationships.push(`命局带天乙贵人（见于${tianYi.hitPillars.join("、")}），人际关系中更容易遇到关键时刻拉一把的贵人。`);
  }
  if (relationships.length === 0) {
    relationships.push(DIMENSION_FALLBACK.relationships);
  }

  // 健康五行底色（通用引言，后续根据正格/变格分支提供具体脏腑建议）
  // 依据：《黄帝内经》"五行各归其脏，偏盛则亢，偏弱则虚，寒热燥湿由此而判"
  const strongest = elementBalance.strongest.join("、");
  const weakest = elementBalance.weakest.join("、");
  // 只有在变格时才用通用五行引言，正格分支由下方脏腑文案直接承接（避免重复）
  if (pattern.category === "变格") {
    health.push(`健康底色上，${strongest}偏盛、${weakest}偏弱构成寒热燥湿的基础格局，结合变格格局特征一并考量。`);
  }

  // 变格专属 health 文案（依《子平真诠》《三命通会》各变格格局体质倾向）
  if (pattern.category === "变格") {
    switch (pattern.name) {
      case "从强格":
        // 从强格日主气势极旺，对应过亢而少泄：气血充盈但容易积郁或情绪波动大
        // 依据：《三命通会》"从强者，日主极旺，气有余而泄少，容易气亢化火"
        health.push("从强格气势独旺，身体底子扎实、精力充沛，但需防气血过盛化热、情绪激亢；运走泄气之地（食伤）时可适当疏通，切忌长期硬撑积压。");
        break;
      case "从财格":
        // 从财格日主气弱而财旺：日主无根，体质偏于虚弱，消耗大于积累
        // 依据：《子平真诠》"从财者，日主无根，体质偏虚，耗散大于补益"
        health.push("从财格日主气弱而财星旺，体质上倾向消耗大于补充，容易因过度奔波或透支精力而积劳；宜注意脾胃和气血的补益，避免长期高强度消耗不休。");
        break;
      case "从杀格":
        // 从杀格官杀旺克身：持续压力和高强度状态是常态，需防心理积压和免疫系统问题
        // 依据：《三命通会》"从杀者，官杀重克，日主极弱，长期压力积累，须防郁结"
        health.push("从杀格官杀重克日主，长期处于高压或被约束的状态，容易产生心理积压和情绪郁结；需特别关注神经系统和免疫调节，定期减压放松是身体保养的关键。");
        break;
      case "从儿格":
        // 从儿格食伤泄秀：精力大量输出于才艺和创造，体力续航容易不足
        // 依据：《子平真诠》"从儿格，食伤极旺泄日主，精力外耗为主，需防过劳"
        health.push("从儿格食伤泄秀极旺，精力大量输出于表达和创作，容易因过度消耗导致体力透支；宜规律作息，注意肺气和消化系统的养护，避免长期熬夜状态。");
        break;
    }
  } else {
    // 正格健康分析
    // 改用 strength.isStrong 而非仅比较 level：原判断把"中和"排除在偏强/偏弱两个
    // 分支之外，导致约36%的中和态样本（含中和偏强、中和偏弱）在健康维度完全没有
    // 强弱相关建议，是明显的信息缺口；isStrong 已对中和态做了偏强/偏弱二次区分
    // （见 scoring.ts），据此补全健康维度可覆盖全部命局且与其他维度口径一致。
    if (!strength.isStrong) {
      health.push("日主偏弱，整体抗压耐受度相对有限，作息规律和体力储备上更需要留有余量。");
    } else {
      health.push("日主偏旺，精力充沛的同时也容易情绪或气血过亢，宜适度疏泄、避免长期硬扛。");
    }

    // 五行脏腑对应建议（依《黄帝内经》五脏五行对应）：
    // 木→肝胆、火→心小肠、土→脾胃、金→肺大肠、水→肾膀胱
    // 偏盛则过亢，偏弱则不足，取最偏（strongest/weakest）各给一条健康提示
    const ORGAN_MAP: Record<string, { excess: string; deficient: string }> = {
      "木": { excess: "肝气偏亢，容易情绪急躁、眼睛疲劳或筋肌紧张", deficient: "肝血偏弱，容易眼睛干涩、筋骨不够柔韧或情绪郁结不舒" },
      "火": { excess: "心火偏旺，容易心悸、睡眠浅或情绪波动大", deficient: "心阳偏弱，容易疲倦乏力、手脚怕冷或心气提不起来" },
      "土": { excess: "脾胃湿热偏重，容易消化积滞、四肢沉重或体湿困顿", deficient: "脾胃偏弱，消化吸收和气血生化能力有限，容易食欲不振、体力不续" },
      "金": { excess: "肺气过旺，容易皮肤干燥、鼻咽敏感或呼吸道问题", deficient: "肺气偏弱，抵抗力相对有限，呼吸道和皮肤的外邪防御需要加强" },
      "水": { excess: "肾水偏旺，容易腰膝酸软、下焦湿寒或精神内敛过度", deficient: "肾气偏弱，容易腰背无力、精力续航短或睡眠质量不稳" }
    };
    for (const el of elementBalance.strongest) {
      if (ORGAN_MAP[el]) {
        health.push(`五行以${el}偏盛为主，对应${ORGAN_MAP[el].excess}，宜适度疏散调节。`);
        break; // 只取最偏盛的一条
      }
    }
    for (const el of elementBalance.weakest) {
      if (ORGAN_MAP[el]) {
        health.push(`五行以${el}偏弱为主，对应${ORGAN_MAP[el].deficient}，宜注意补益维护。`);
        break; // 只取最偏弱的一条
      }
    }
  }
  const yangRen = shenSha.find((record) => record.name === "羊刃");
  if (yangRen) {
    health.push(`命局带羊刃（见于${yangRen.hitPillars.join("、")}），情绪波动或意外磕碰的风险需额外留意。`);
  }

  return {
    overview,
    career,
    relationships,
    health,
    wealth
  };
}

export function buildFlowAnalysis(args: {
  ganZhi: string;
  level: "cycle" | "annual";
  dayMaster: PillarDetails["stem"];
  natalPillars: PillarDetails[];
  gender: Gender;
  parentGanZhi?: string;
  isStrong?: boolean;
}): FlowAnalysis {
  const { ganZhi, level, dayMaster, natalPillars, gender, parentGanZhi, isStrong = true } = args;
  const [flowStem, flowBranch] = [...ganZhi];
  const state = createFlowScoreState();
  const signals: FlowSignal[] = [];
  const seen = new Set<string>();
  const levelLabel = level === "cycle" ? "大运" : "流年";
  const natalBranches = natalPillars.map((pillar) => pillar.branch.value);
  const natalDayBranch = natalPillars.find((pillar) => pillar.key === "day")?.branch.value;

  const registerSignal = (
    signal: FlowSignal,
    impacts: Array<{ dimension: FlowDimensionKey; delta: number; message: string }>
  ): void => {
    // 若同一 signal（同类别+同关系+同成员）已注册过，说明调用方遇到了重复触发场景
    // （如原局重复地支未在外层去重），此时不应再重复叠加分数或文案，直接跳过。
    const isNew = pushSignal(signals, seen, signal);
    if (!isNew) {
      return;
    }
    for (const impact of impacts) {
      addMessage(state, impact.dimension, impact.delta, impact.message);
    }
  };

  const flowTenGod = computeTenGod(dayMaster.value, flowStem);
  switch (flowTenGod) {
    case "正官":
      // 官杀为克我之神：身弱者再逢克身，压力叠加为忌；身强者借此克泄耗方能中和，反为喜用。
      if (isStrong) {
        registerSignal(
          {
            category: "ten-god",
            type: flowTenGod,
            tone: "supportive",
            description: `${levelLabel}天干${flowStem}为${flowTenGod}，身强得官约束，规则与秩序反能定住方向。`,
            members: [dayMaster.value, flowStem]
          },
          [
            { dimension: "overall", delta: 2, message: `${levelLabel}${flowStem}正官透出，身强逢之，克泄有度，阶段节奏更容易稳中有进。` },
            { dimension: "career", delta: 2, message: `${levelLabel}${flowStem}正官到位，事业上更利于职责明确、晋升考核或身份建立。` },
            ...(gender === "female"
              ? [
                  {
                    dimension: "relationships" as const,
                    delta: 1,
                    message: `${levelLabel}${flowStem}官星对女命也常会带来关系议题的强化。`
                  }
                ]
              : [])
          ]
        );
      } else {
        registerSignal(
          {
            category: "ten-god",
            type: flowTenGod,
            tone: "challenging",
            description: `${levelLabel}天干${flowStem}为${flowTenGod}，身弱再受官星克制，责任和约束容易变成负担。`,
            members: [dayMaster.value, flowStem]
          },
          [
            { dimension: "overall", delta: -1, message: `${levelLabel}${flowStem}正官透出，身弱逢之，克身之力叠加，节奏容易被外部要求压得偏紧。` },
            { dimension: "career", delta: 0, message: `${levelLabel}${flowStem}正官阶段责任加重，身弱时更需量力而行，避免硬扛。` },
            ...(gender === "female"
              ? [
                  {
                    dimension: "relationships" as const,
                    delta: -1,
                    message: `${levelLabel}${flowStem}官星透出，身弱逢之，关系中承受的压力感也会更明显。`
                  }
                ]
              : [])
          ]
        );
      }
      break;
    case "七杀":
      if (isStrong) {
        registerSignal(
          {
            category: "ten-god",
            type: flowTenGod,
            tone: "supportive",
            description: `${levelLabel}天干${flowStem}为${flowTenGod}，身强得杀为用，压力转化为推进的动力。`,
            members: [dayMaster.value, flowStem]
          },
          [
            { dimension: "overall", delta: 1, message: `${levelLabel}${flowStem}七杀透出，身强逢之，克泄之力恰能中和过旺之气，敢打硬仗。` },
            { dimension: "career", delta: 2, message: `${levelLabel}${flowStem}七杀化为权柄，适合承担高压任务、竞争性强的项目。` },
            { dimension: "health", delta: -1, message: `${levelLabel}${flowStem}七杀偏重时，身心负荷和紧绷感仍需留意。` },
            ...(gender === "female"
              ? [
                  {
                    dimension: "relationships" as const,
                    delta: 0,
                    message: `${levelLabel}${flowStem}七杀对关系也可能带来压迫感或强刺激。`
                  }
                ]
              : [])
          ]
        );
      } else {
        registerSignal(
          {
            category: "ten-god",
            type: flowTenGod,
            tone: "challenging",
            description: `${levelLabel}天干${flowStem}为${flowTenGod}，身弱再逢七杀克身，压力和风险都明显放大。`,
            members: [dayMaster.value, flowStem]
          },
          [
            { dimension: "overall", delta: -2, message: `${levelLabel}${flowStem}七杀透出，身弱逢之，克身之力过重，容易身心俱疲、进退两难。` },
            { dimension: "career", delta: -1, message: `${levelLabel}${flowStem}七杀高压叠加身弱，硬扛风险大，更需借外力或印星化解。` },
            { dimension: "health", delta: -2, message: `${levelLabel}${flowStem}七杀偏重且日主本弱，身心负荷和紧绷感要重点留意。` },
            ...(gender === "female"
              ? [
                  {
                    dimension: "relationships" as const,
                    delta: -1,
                    message: `${levelLabel}${flowStem}七杀对关系也可能带来压迫感或强刺激。`
                  }
                ]
              : [])
          ]
        );
      }
      break;
    case "正财":
    case "偏财":
      // 财星为我克之神：身强能任财，财为喜用；身弱本已无力，财旺反而耗身夺气，为忌。
      if (isStrong) {
        registerSignal(
          {
            category: "ten-god",
            type: flowTenGod,
            tone: "supportive",
            description: `${levelLabel}天干${flowStem}为${flowTenGod}，身强能任财，资源、交易与现实回报议题升温。`,
            members: [dayMaster.value, flowStem]
          },
          [
            { dimension: "overall", delta: 1, message: `${levelLabel}${flowStem}${flowTenGod}透出，身强逢之，更容易把注意力拉向资源和结果并转化为收获。` },
            { dimension: "career", delta: 1, message: `${levelLabel}${flowStem}财星阶段更利于项目落地、客户经营和资源整合。` },
            { dimension: "wealth", delta: 2, message: `${levelLabel}${flowTenGod}到位，身强任财，财富主题更容易落到实处。` },
            ...(gender === "male"
              ? [
                  {
                    dimension: "relationships" as const,
                    delta: 1,
                    message: `${levelLabel}${flowStem}财星对男命也常对应关系与伴侣主题的升温。`
                  }
                ]
              : [])
          ]
        );
      } else {
        registerSignal(
          {
            category: "ten-god",
            type: flowTenGod,
            tone: "challenging",
            description: `${levelLabel}天干${flowStem}为${flowTenGod}，身弱难以任财，财旺反而耗身夺气。`,
            members: [dayMaster.value, flowStem]
          },
          [
            { dimension: "overall", delta: -1, message: `${levelLabel}${flowStem}${flowTenGod}透出，身弱逢之，耗身之力增加，容易忙而无功、劳而少获。` },
            { dimension: "career", delta: 0, message: `${levelLabel}${flowStem}财星阶段机会虽在，但身弱时更易力不从心，宜量力而为。` },
            { dimension: "wealth", delta: 0, message: `${levelLabel}${flowTenGod}虽浮现，但身弱难任财，进多出多、难有结余。` },
            ...(gender === "male"
              ? [
                  {
                    dimension: "relationships" as const,
                    delta: 0,
                    message: `${levelLabel}${flowStem}财星对男命也常对应关系与伴侣主题的升温，身弱时更需量力经营。`
                  }
                ]
              : [])
          ]
        );
      }
      break;
    case "食神":
      // 食伤为我生之神，泄身之气：身强需要泄秀，食伤为喜；身弱本已无力，再泄则气更弱，为忌。
      if (isStrong) {
        registerSignal(
          {
            category: "ten-god",
            type: flowTenGod,
            tone: "supportive",
            description: `${levelLabel}天干${flowStem}为${flowTenGod}，身强得食神泄秀，表达、输出、舒展和作品感增强。`,
            members: [dayMaster.value, flowStem]
          },
          [
            { dimension: "overall", delta: 1, message: `${levelLabel}${flowStem}食神泄秀，阶段氛围更利于展开和输出。` },
            { dimension: "career", delta: 1, message: `${levelLabel}${flowStem}食神阶段适合创作、传播、产品表达和方法输出。` },
            { dimension: "health", delta: 1, message: `${levelLabel}${flowStem}食神也常对应状态舒展与恢复空间增大。` },
            { dimension: "wealth", delta: 1, message: `${levelLabel}${flowStem}食神带动输出变现，适合把能力转成结果。` }
          ]
        );
      } else {
        registerSignal(
          {
            category: "ten-god",
            type: flowTenGod,
            tone: "challenging",
            description: `${levelLabel}天干${flowStem}为${flowTenGod}，身弱再被食神泄气，精力和续航更容易被拖垮。`,
            members: [dayMaster.value, flowStem]
          },
          [
            { dimension: "overall", delta: -1, message: `${levelLabel}${flowStem}食神透出，身弱逢之，泄气之力叠加，容易做得多却收效有限。` },
            { dimension: "career", delta: 0, message: `${levelLabel}${flowStem}食神阶段仍利表达输出，但身弱时更要控制节奏、避免透支。` },
            { dimension: "health", delta: -1, message: `${levelLabel}${flowStem}食神泄身，体力和精力续航要格外留意。` },
            { dimension: "wealth", delta: 0, message: `${levelLabel}${flowStem}食神虽利变现，但身弱泄气过重时收益常打折扣。` }
          ]
        );
      }
      break;
    case "伤官":
      // 伤官同属泄身之神，且冲击性更强：身强可借力突破，身弱则耗损与摩擦并重。
      if (isStrong) {
        registerSignal(
          {
            category: "ten-god",
            type: flowTenGod,
            tone: "mixed",
            description: `${levelLabel}天干${flowStem}为${flowTenGod}，身强借伤官泄秀突破，冲劲和表达欲同步增强。`,
            members: [dayMaster.value, flowStem]
          },
          [
            { dimension: "overall", delta: 1, message: `${levelLabel}${flowStem}伤官当令，身强适合突破创新，泄秀有度反成动力。` },
            { dimension: "career", delta: 1, message: `${levelLabel}${flowStem}伤官利创新表达，身强时敢于打破僵化体系、另辟蹊径。` },
            { dimension: "relationships", delta: -1, message: `${levelLabel}${flowStem}伤官偏强时，说话方式和边界感更需要克制。` },
            { dimension: "health", delta: -1, message: `${levelLabel}${flowStem}伤官阶段常伴随消耗、熬夜或情绪外放。` }
          ]
        );
      } else {
        registerSignal(
          {
            category: "ten-god",
            type: flowTenGod,
            tone: "challenging",
            description: `${levelLabel}天干${flowStem}为${flowTenGod}，身弱再逢伤官泄身，消耗与摩擦风险同步升高。`,
            members: [dayMaster.value, flowStem]
          },
          [
            { dimension: "overall", delta: -1, message: `${levelLabel}${flowStem}伤官透出，身弱逢之，泄气叠加冲劲外放，容易身心俱疲又招惹是非。` },
            { dimension: "career", delta: -1, message: `${levelLabel}${flowStem}伤官不服管束，身弱时更难扛住规则摩擦带来的消耗。` },
            { dimension: "relationships", delta: -1, message: `${levelLabel}${flowStem}伤官偏强时，说话方式和边界感更需要克制。` },
            { dimension: "health", delta: -2, message: `${levelLabel}${flowStem}身弱伤官双重泄耗，熬夜、情绪外放对身心影响更明显。` }
          ]
        );
      }
      break;
    case "正印":
    case "偏印":
      if (isStrong) {
        registerSignal(
          {
            category: "ten-god",
            type: flowTenGod,
            tone: "challenging",
            description: `${levelLabel}天干${flowStem}为${flowTenGod}，身旺不需要印星再生——容易想太多做太少、过度依赖外部认可。`,
            members: [dayMaster.value, flowStem]
          },
          [
            { dimension: "overall", delta: -1, message: `${levelLabel}${flowStem}印星对身旺者精力过剩但缺乏有效出口，容易陷入空想。` },
            { dimension: "career", delta: 0, message: `${levelLabel}${flowStem}印星利学习但不利决断，适合充电不适合冲锋。` },
            { dimension: "wealth", delta: -1, message: `${levelLabel}${flowStem}印星克制食伤（泄秀通道被堵），变现能力受限。` }
          ]
        );
      } else {
        registerSignal(
          {
            category: "ten-god",
            type: flowTenGod,
            tone: "supportive",
            description: `${levelLabel}天干${flowStem}为${flowTenGod}，学习、保护、支持系统与恢复力增强。`,
            members: [dayMaster.value, flowStem]
          },
          [
            { dimension: "overall", delta: 1, message: `${levelLabel}${flowStem}印星增强，更利于吸收、复盘和修正节奏。` },
            { dimension: "career", delta: 1, message: `${levelLabel}${flowStem}印星阶段适合学习、考证、拿方法论和构建支撑系统。` },
            { dimension: "health", delta: 1, message: `${levelLabel}${flowStem}印星也有助于恢复和自我保护。` }
          ]
        );
      }
      break;
    case "比肩":
      registerSignal(
        {
          category: "ten-god",
          type: flowTenGod,
          tone: isStrong ? "challenging" : "supportive",
          description: isStrong
            ? `${levelLabel}天干${flowStem}为${flowTenGod}，身旺再逢比肩——竞争加剧、独断过头、破财风险升高。`
            : `${levelLabel}天干${flowStem}为${flowTenGod}，同气相助、信心增强、有伙伴支持。`,
          members: [dayMaster.value, flowStem]
        },
        isStrong
          ? [
              { dimension: "overall", delta: -1, message: `${levelLabel}${flowStem}比肩加身旺，固执和竞争心加倍，容易一意孤行。` },
              { dimension: "wealth", delta: -2, message: `${levelLabel}${flowStem}比肩夺财——合伙分利、借钱不还、投资被分摊的风险高。` },
              { dimension: "relationships", delta: -1, message: `${levelLabel}${flowStem}比肩强化自我立场，关系里更要注意互相让位。` }
            ]
          : [
              { dimension: "overall", delta: 1, message: `${levelLabel}${flowStem}比肩透出，信心和行动力增强。` },
              { dimension: "career", delta: 1, message: `${levelLabel}${flowStem}比肩透出，有同类支持，适合合作和团队推进。` }
            ]
      );
      break;
    case "劫财":
      // tone 需与该信号自身的 delta 净方向一致：身旺逢劫是纯粹的负面（overall/wealth/
      // relationships 三项皆负），故为 challenging；身弱逢劫是"帮身但争财"的得失参半
      // （overall=0 中性，仅 wealth 单项偏负），文案本身也明写"得失参半"，若仍标注
      // challenging 会与"中性/参半"的语义矛盾，且被 web 端 computeCorrectedTone 的
      // 十神评分（每条 challenging 信号计 -1 分）误判为纯负面，故改标 mixed。
      registerSignal(
        {
          category: "ten-god",
          type: flowTenGod,
          tone: isStrong ? "challenging" : "mixed",
          description: isStrong
            ? `${levelLabel}天干${flowStem}为${flowTenGod}，身旺逢劫——破财、争夺、冲动决策风险达到峰值。`
            : `${levelLabel}天干${flowStem}为${flowTenGod}，劫财帮身有力但也争夺资源，得失参半。`,
          members: [dayMaster.value, flowStem]
        },
        isStrong
          ? [
              { dimension: "overall", delta: -2, message: `${levelLabel}${flowStem}劫财加身旺，过旺之势加剧——独断、冲动、与人争利。` },
              { dimension: "wealth", delta: -3, message: `${levelLabel}${flowStem}劫财夺财——最容易破财的年份。不借钱、不担保、不冲动投资。` },
              { dimension: "relationships", delta: -1, message: `${levelLabel}${flowStem}劫财阶段更容易因边界与利益问题产生摩擦。` }
            ]
          : [
              { dimension: "overall", delta: 0, message: `${levelLabel}${flowStem}劫财透出，帮身但也争财，得失参半。` },
              { dimension: "wealth", delta: -1, message: `${levelLabel}${flowStem}劫财仍有夺财之性，财务上需注意。` }
            ]
      );
      break;
  }

  // 五行天干信号仅注册到 signals 列表（供展示），不再推送维度 messages。
  // 因为上面的十神信号已基于 isStrong 对同一关系做了完整的维度分析和评分，
  // 重复推送会造成同一信息以两种措辞出现在 summary 中。
  const stemInteraction = getElementInteraction(dayMaster.element, STEM_META[flowStem].element);
  const stemElementTypeLabels: Record<string, string> = {
    "generated-by": "生我",
    "generate": "我生",
    "control": "我克",
    "controlled-by": "克我",
    "same": "同气"
  };
  const stemElementTones: Record<string, AnalysisTone> = {
    "generated-by": "supportive",
    "generate": "mixed",
    "control": "mixed",
    "controlled-by": "challenging",
    "same": "mixed"
  };
  if (stemElementTypeLabels[stemInteraction]) {
    pushSignal(signals, seen, {
      category: "element",
      type: stemElementTypeLabels[stemInteraction],
      tone: stemElementTones[stemInteraction],
      description: `${levelLabel}天干${flowStem}五行对日主形成"${stemElementTypeLabels[stemInteraction]}"关系。`,
      members: [dayMaster.value, flowStem]
    });
  }
  // 地支五行信号：只保留 overall 一条消息，health 维度交给后续地支关系信号处理。
  // 修复：此前仅处理 controlled-by（克我）/generated-by（生我）两种关系，
  // getElementInteraction 实际有 same/generate/generated-by/control/controlled-by
  // 五种返回值，导致 same（比劫同气）、generate（我生，食伤泄气）、control（我克，
  // 耗财）三种情形完全没有地支层面的信号——批量抽样 12800 个大运周期验证，这三种
  // 关系合计占比约60%，即六成样本在"地支五行"这一独立分析维度上完全空白。
  // 地支没有对应的藏干十神评分机制（与天干不同，天干十神已基于 isStrong 做过完整
  // 维度分析），因此地支五行信号是地支层面唯一的维度贡献来源，必须覆盖全部5种关系。
  // same/generate/control 三种关系的吉凶方向依赖身强身弱（比劫帮身弱、食伤泄身强、
  // 财星耗身强，具体喜忌相反），在不区分强弱的 element 类别里无法判定唯一方向，
  // 故与天干侧 stemElementTones 的处理原则保持一致，统一标记为 mixed 且不推送
  // delta（只做展示性描述，避免中性关系被误判为正面或负面而扭曲综合评分）。
  const branchInteraction = getElementInteraction(dayMaster.element, BRANCH_META[flowBranch].element);
  const branchElementTypeLabels: Record<string, string> = {
    "generated-by": "地支生我",
    "generate": "地支我生",
    "control": "地支我克",
    "controlled-by": "地支克我",
    "same": "地支同气"
  };
  const branchElementTones: Record<string, AnalysisTone> = {
    "generated-by": "supportive",
    "generate": "mixed",
    "control": "mixed",
    "controlled-by": "challenging",
    "same": "mixed"
  };
  if (branchInteraction === "controlled-by") {
    registerSignal(
      {
        category: "element",
        type: branchElementTypeLabels[branchInteraction],
        tone: branchElementTones[branchInteraction],
        description: `${levelLabel}地支${flowBranch}五行对日主形成“克我”关系。`,
        members: [dayMaster.value, flowBranch]
      },
      [
        { dimension: "overall", delta: -1, message: `${levelLabel}地支${flowBranch}层面形成压力，体感波动更值得留神。` }
      ]
    );
  } else if (branchInteraction === "generated-by") {
    registerSignal(
      {
        category: "element",
        type: branchElementTypeLabels[branchInteraction],
        tone: branchElementTones[branchInteraction],
        description: `${levelLabel}地支${flowBranch}五行对日主形成“生我”关系。`,
        members: [dayMaster.value, flowBranch]
      },
      [
        { dimension: "overall", delta: 1, message: `${levelLabel}地支${flowBranch}生扶日主，底层环境容易出现托举。` }
      ]
    );
  } else {
    // same/generate/control：方向随身强身弱而定，此处不推送 delta，仅作展示性信号，
    // 与天干侧 stemElementTypeLabels 对这三种关系的处理方式保持一致。
    pushSignal(signals, seen, {
      category: "element",
      type: branchElementTypeLabels[branchInteraction],
      tone: branchElementTones[branchInteraction],
      description: `${levelLabel}地支${flowBranch}五行对日主形成“${branchElementTypeLabels[branchInteraction].replace("地支", "")}”关系。`,
      members: [dayMaster.value, flowBranch]
    });
  }

  // 对原局地支去重，避免原局有重复地支时生成重复信号
  const seenNatalBranches = new Set<string>();
  for (const natalBranch of natalBranches) {
    if (seenNatalBranches.has(natalBranch)) continue;
    seenNatalBranches.add(natalBranch);
    // 一对地支可能同时命中多种关系（如寅申既六冲又相刑、巳申既六合又相刑，
    // 这正是“寅巳申”“丑戌未”三刑局的构成方式），需要逐条生成信号，不能只
    // 取第一条，否则相刑会被六冲/六合/六害无声吞掉。
    const relationsForPair = findBranchPairRelations(flowBranch, natalBranch);
    for (const relation of relationsForPair) {
      if (relation.type === "六合") {
        registerSignal(
          {
            category: "branch-relation",
            type: relation.type,
            tone: "supportive",
            description: `${levelLabel}地支${flowBranch}与原局${natalBranch}形成${relation.type}。`,
            members: [flowBranch, natalBranch],
            result: relation.result
          },
          [
            { dimension: "overall", delta: 1, message: `${levelLabel}地支${flowBranch}合${natalBranch}，事情更容易被牵动、撮合或整合。` },
            { dimension: "relationships", delta: 2, message: `${levelLabel}${flowBranch}${natalBranch}合，关系互动和协商空间更大。` },
            { dimension: "wealth", delta: 1, message: `${levelLabel}${flowBranch}${natalBranch}合局，合作、撮合与交易达成更顺畅。` }
          ]
        );
      }

      if (relation.type === "六冲") {
        registerSignal(
          {
            category: "branch-relation",
            type: relation.type,
            tone: "challenging",
            description: `${levelLabel}地支${flowBranch}与原局${natalBranch}形成${relation.type}。`,
            members: [flowBranch, natalBranch]
          },
          [
            { dimension: "overall", delta: -1, message: `${levelLabel}地支${flowBranch}冲${natalBranch}，阶段更容易出现变动、对冲和突发调整。` },
            { dimension: "health", delta: -1, message: `${levelLabel}${flowBranch}冲${natalBranch}，节律打乱、奔波或身心紧张。` },
            ...(natalDayBranch === natalBranch
              ? [
                  {
                    dimension: "relationships" as const,
                    delta: -2,
                    message: `${levelLabel}${flowBranch}冲到日支${natalBranch}，关系与亲密互动的波动会更明显。`
                  }
                ]
              : [])
          ]
        );
      }

      if (relation.type === "六害") {
        registerSignal(
          {
            category: "branch-relation",
            type: relation.type,
            tone: "challenging",
            description: `${levelLabel}地支${flowBranch}与原局${natalBranch}形成${relation.type}。`,
            members: [flowBranch, natalBranch]
          },
          [
            { dimension: "overall", delta: -1, message: `${levelLabel}地支${flowBranch}害${natalBranch}，偏向暗耗和不顺，很多问题会慢慢显形。` },
            { dimension: "relationships", delta: -1, message: `${levelLabel}${flowBranch}害${natalBranch}，容易产生误解、别扭或暗中消耗。` },
            { dimension: "health", delta: -1, message: `${levelLabel}${flowBranch}害${natalBranch}，注意情绪郁结转成体感问题。` }
          ]
        );
      }

      if (relation.type === "相刑" || relation.type === "自刑") {
        registerSignal(
          {
            category: "branch-relation",
            type: relation.type,
            tone: "challenging",
            description: `${levelLabel}地支${flowBranch}与原局${natalBranch}形成${relation.type}。`,
            members: [flowBranch, natalBranch]
          },
          [
            { dimension: "overall", delta: -1, message: `${levelLabel}地支${flowBranch}刑${natalBranch}，阶段更容易出现拧巴、反复或内耗。` },
            { dimension: "relationships", delta: -1, message: `${levelLabel}${flowBranch}刑${natalBranch}，需留意边界、情绪和语言方式。` },
            { dimension: "health", delta: -2, message: `${levelLabel}${flowBranch}刑${natalBranch}，重点留意压力累积和身体警讯。` }
          ]
        );
      }
    }
  }

  for (const triple of getFlowTripleRelations(flowBranch, natalBranches)) {
    registerSignal(
      {
        category: "branch-relation",
        type: triple.type,
        tone: "supportive",
        description: `${levelLabel}地支${flowBranch}与原局形成${triple.type}局。`,
        members: triple.members,
        result: triple.result
      },
      [
        { dimension: "overall", delta: 1, message: `${levelLabel}${triple.type}成局，阶段主题会更集中地被放大。` },
        { dimension: "career", delta: 1, message: `${levelLabel}${triple.members.join("")}${triple.type}成局，事业推进更有整体联动感。` },
        { dimension: "relationships", delta: 1, message: `${levelLabel}${triple.members.join("")}${triple.type}放大人际与关系联结。` },
        { dimension: "wealth", delta: 1, message: `${levelLabel}${triple.members.join("")}${triple.type}利资源会聚与结果聚焦。` }
      ]
    );
  }

  for (const half of getFlowHalfTripleRelations(flowBranch, natalBranches)) {
    // 半合力量弱于完整三合，仅给整体与财富维度轻量加分，不放大到关系与事业维度。
    registerSignal(
      {
        category: "branch-relation",
        type: half.type,
        tone: "supportive",
        description: `${levelLabel}地支${flowBranch}与原局形成${half.type}（半合${half.result}局，力量弱于三合）。`,
        members: half.members,
        result: half.result
      },
      [
        { dimension: "overall", delta: 1, message: `${levelLabel}${half.result}气半合初现，阶段主题有所呼应但尚未完全成局。` },
        { dimension: "wealth", delta: 1, message: `${levelLabel}${half.members.join("")}半合${half.result}，局部资源联动，机会零散但值得留意。` }
      ]
    );
  }

  if (parentGanZhi) {
    const [, parentBranch] = [...parentGanZhi];
    // 与原局关系判断同理：流年支与大运支之间也可能同时命中多种关系
    // （如寅申既六冲又相刑），需逐条生成信号，不能只取第一条。
    const parentRelations = findBranchPairRelations(flowBranch, parentBranch);
    for (const relation of parentRelations) {
      const supportive = ["六合", "三合", "三会"].includes(relation.type);
      registerSignal(
        {
          category: "cycle-link",
          type: relation.type,
          tone: supportive ? "supportive" : "challenging",
          description: `流年地支${flowBranch}与所属大运地支${parentBranch}形成${relation.type}。`,
          members: [flowBranch, parentBranch],
          result: relation.result
        },
        supportive
          ? [
              {
                dimension: "overall",
                delta: 1,
                message: `流年${flowBranch}与大运${parentBranch}同频，阶段主题更容易被持续放大。`
              },
              {
                dimension: "career",
                delta: 1,
                message: `流年${flowBranch}合大运${parentBranch}，事业节奏更容易连成线。`
              }
            ]
          : [
              {
                dimension: "overall",
                delta: -1,
                message: `流年${flowBranch}冲大运${parentBranch}，阶段主题更容易出现转折和波动。`
              },
              {
                dimension: "health",
                delta: -1,
                message: `流年${flowBranch}与大运${parentBranch}冲刑，身心承压感通常更直观。`
              }
            ]
      );
    }
  }

  // v2 身旺身弱校正：仅调整 overall 分数，不再推送重复消息。
  // 十神信号已基于 isStrong 对同一关系给出完整描述，此处重复推送会造成冗余。
  const flowStemElement = STEM_META[flowStem].element;
  const stemInteractionType = getElementInteraction(dayMaster.element, flowStemElement);
  if (isStrong) {
    if (stemInteractionType === "generated-by" || stemInteractionType === "same") {
      state.overall.score -= 2;
    } else if (stemInteractionType === "generate" || stemInteractionType === "control" || stemInteractionType === "controlled-by") {
      state.overall.score += 1;
    }
  } else {
    if (stemInteractionType === "generated-by" || stemInteractionType === "same") {
      state.overall.score += 1;
    } else if (stemInteractionType === "control" || stemInteractionType === "generate") {
      state.overall.score -= 1;
    } else if (stemInteractionType === "controlled-by") {
      state.overall.score -= 2;
    }
  }

  // 每个维度 summary 限量：overall 最多 3 条，其他维度最多 2 条。
  // 过多同义模板句会让报告冗长且缺乏重点。
  const maxPerDimension: Record<FlowDimensionKey, number> = {
    overall: 3,
    career: 2,
    relationships: 2,
    health: 2,
    wealth: 2
  };

  const summaries = FLOW_DIMENSIONS.reduce<FlowAnalysis>(
    (accumulator, dimension) => {
      const all = state[dimension].messages;
      const messages = all.length > 0 ? all.slice(0, maxPerDimension[dimension]) : [];
      accumulator[dimension] = {
        tone: classifyTone(state[dimension].score),
        summary: messages
      };
      return accumulator;
    },
    {
      signals,
      overall: { tone: "mixed", summary: [] },
      career: { tone: "mixed", summary: [] },
      relationships: { tone: "mixed", summary: [] },
      health: { tone: "mixed", summary: [] },
      wealth: { tone: "mixed", summary: [] }
    }
  );

  if (signals.length === 0) {
    summaries.signals.push({
      category: "element",
      type: "baseline",
      tone: "mixed",
      description: `${levelLabel}${ganZhi}与原局之间暂无高优先级触发信号。`,
      members: [ganZhi]
    });
  }

  return summaries;
}
