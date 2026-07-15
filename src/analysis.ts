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
  {
    // 变格不使用 governingTenGod（在 pattern.ts 中 governingTenGod 对变格仅做占位）
    // 改为直接输出格局名称和旺神方向，避免"以比肩为纲"等语义模糊的描述
    const overviewGovern =
      pattern.category === "变格"
        ? {
            "从强格": "以日主自身气势为纲",
            "从财格": `以${pattern.governingTenGod}（财星）为纲`,
            "从杀格": `以${pattern.governingTenGod}（官杀）为纲`,
            "从儿格": `以${pattern.governingTenGod}（食伤）为纲`,
          }[pattern.name] ?? `以${pattern.governingTenGod}为纲`
        : `以${pattern.governingTenGod}为纲`;
    overview.push(
      `格局定为${pattern.name}（${pattern.category}），${overviewGovern}，当前判断倾向${pattern.outcome}。`
    );
  }
  overview.push(
    `用神取用以${yongShen.primaryMethod}法为主，具体喜忌五行与方位详见下方「喜忌用神」表。`
  );
  // 中和态需按 strength.isStrong（supportRatio>=0.5 的二次区分，见 scoring.ts）
  // 区分偏强/偏弱措辞，不能无脑说"大致平衡"——否则会与同一份报告里用神取用
  // （如病药法"比劫重重为病，宜克制"）明确给出的偏强/偏弱结论自相矛盾。
  // 注意：败格中含七杀无制、官杀混杂等格局信号时，"以生扶为宜"的旺衰建议
  // 与格局层面的"制化七杀/理清官杀"建议会产生方向矛盾，需在偏弱文案末尾
  // 加注"但格局用神方向优先"的提示，避免用户对"生扶"建议产生误读。
  // 依据：《子平真诠》"用神者，格局取用之纲，旺衰仅为参考，不可凌驾格局之上"
  if (strength.level === "中和") {
    const patternBrokenReasonForOverview = pattern.outcome === "败格"
      ? (pattern.reasons.slice(-1)[0] ?? "") : "";
    const hasKillerConflict =
      patternBrokenReasonForOverview.includes("七杀旺而无") ||
      patternBrokenReasonForOverview.includes("遇杀无制") ||
      patternBrokenReasonForOverview.includes("官杀混杂");
    if (strength.isStrong) {
      overview.push(`日主中和偏强（扶抵占比${Math.round(strength.supportRatio * 100)}%），仍以克泄耗为宜，需结合格局与用神再定取舍。`);
    } else if (hasKillerConflict) {
      // 七杀无制/官杀混杂败格中：日主偏弱但格局用神方向（制杀/化杀）优先于"生扶"建议
      // 依据：《子平真诠》"七杀格无制，不论身强身弱，救格之道在制化而非单纯扶身"
      overview.push(`日主中和偏弱（扶抵占比${Math.round(strength.supportRatio * 100)}%），旺衰角度倾向生扶，但本命格局败格，宜优先依格局用神救格（制杀/化杀），而非单纯扶助日主。`);
    } else {
      overview.push(`日主中和偏弱（扶抵占比${Math.round(strength.supportRatio * 100)}%），仍以生扶为宜，需结合格局与用神再定取舍。`);
    }
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
    // 败格命局：破格病灶所对应的十神，不应再作为优势推荐。
    // 依据：《子平真诠》"格败者，先论补救，候大运流年以期救格"。
    // 通过解析破格原因，识别破格类型，给出格局专属的败格建议，
    // 同时过滤与破格病灶正面矛盾的通用文案。
    const brokenReason = pattern.outcome === "败格" ? (pattern.reasons.slice(-1)[0] ?? "") : "";
    // 识别破格的"病灶"十神类型，用于过滤矛盾文案
    // 官杀混杂（正官格七杀透出 / 七杀格正官透入）需区分：
    // 混杂本身不是"无制"，而是正官与七杀同时存在导致力量分散、方向模糊
    const isOfficerMixed =
      brokenReason.includes("官杀混杂");  // 正官格/七杀格官杀混杂
    const isOfficerBroken =
      brokenReason.includes("七杀旺而无") || // 七杀格无制（无混杂，纯粹无制）
      brokenReason.includes("遇杀无制");       // 建禄格七杀无制
    const isOfficerBrokenByShangGuan =
      brokenReason.includes("伤官见官") || brokenReason.includes("伤官损官");  // 伤官破格
    const isResourceBroken =
      brokenReason.includes("财星破印") || brokenReason.includes("财星透出，印星受克"); // 印格被财破
    const isOutputBroken =
      brokenReason.includes("枭神夺食");  // 食神格被枭神夺食
    const isPeerBroken =
      brokenReason.includes("比肩透出且无官星") || brokenReason.includes("劫财透出且无官星"); // 财格被比劫破
    const isBladeUncontrolled =
      brokenReason.includes("未见官杀制刃");  // 羊刃无制
    const isShangGuanBroken =
      brokenReason.includes("正官透出且无印星化解"); // 伤官格见官

    if (pattern.outcome === "败格") {
      // ——败格命局：格局专属破格建议（优先输出，依《子平真诠》各格败格救格原则）——
      if (isOfficerMixed) {
        // 官杀混杂（正官格七杀同透 / 七杀格正官混入）：《子平真诠》"正官忌官杀混杂，
        // 混则官失权威""七杀忌官杀混杂，混则杀失主导"——官杀相混，方向模糊，
        // 宜先明确定位，专注一个方向，而非试图同时借助正官的秩序感与七杀的竞争力
        career.push("官杀混杂，事业方向易摇摆不定；宜选定一个路线（仕途体制或竞争突破）深耕专注，切忌两者兼顾，等大运合杀或制杀以理清格局。");
      } else if (isOfficerBroken) {
        // 七杀格无制 / 建禄格七杀无制：《子平真诠》"七杀以制为贵，无制者莽夫之命，
        // 谋事不可锋进，须蓄势待时"
        career.push("七杀无制，事业上宜韬光养晦、蓄势而非强进；等待食神制杀或印星化杀的大运到来，方可稳步发力。");
      } else if (isOfficerBrokenByShangGuan) {
        // 正官格伤官见官 / 建禄格伤官损官：《子平真诠》"正官忌伤官，见则权威尽散，
        // 最忌显露锋芒于仕途"
        career.push("伤官与官星同现，职场中与权威摩擦风险大；宜低调行事，以专业实力积累口碑，避免正面与体制或上级冲突。");
      } else if (isResourceBroken) {
        // 印格财星破印：《子平真诠》"印格忌财，财来破印，学业蹉跎，
        // 宜走印旺之运"
        career.push("财星冲克印星，学习积累与才华受物质事务干扰；事业宜以专业技能立身，减少分心追逐财利，待印旺大运方能全力发挥。");
      } else if (isOutputBroken) {
        // 食神格枭神夺食：《三命通会》"枭神夺食，才艺难全，
        // 喜财制枭，运行财星则发"
        // 第1条只讲当下行为建议，不重复候运方向（候运由第2条专属文案承载）
        // 依据：《三命通会》"枭神夺食，才艺难全，宜踏实积蓄，不宜早显"
        career.push("枭神压制食神，表达与创作天赋受阻；当下职场宜踏实积累、避免急于展示才艺，以稳打稳扎的方式积蓄实力。");
      } else if (isPeerBroken) {
        // 财格比劫夺财：《子平真诠》"财格见比劫，官星制之则财可保，无官则合伙必分"
        career.push("比劫夺财之局，合伙事业易生财务纠纷；宜单干或官星制衡比劫之后再谈合作，目前阶段更适合独自经营或明确产权边界。");
      } else if (isBladeUncontrolled) {
        // 羊刃无制：《子平真诠》"羊刃喜官杀制伏，无官杀者刚烈难驯，宜行官杀之运"
        career.push("羊刃无制，刚烈之气难以约束；宜从事需要魄力与决断的竞争性领域（如竞技、技术攻关、军警等），或等官杀制刃大运以驾驭锋芒。");
      } else if (isShangGuanBroken) {
        // 伤官格见官：《子平真诠》"伤官见官，天下第一凶险，宜远离官场，以自由职业或创业为宜"
        career.push("伤官见官，与规则体制存在天然冲突；极力避免官场或强管控环境，最宜自由职业、创业或学术研究等自主性强的路径。");
      } else {
        // 其他未细分的败格：通用降级建议
        career.push("存在破格信号，事业上更需靠后天努力和大运补位，当前阶段宜稳健行事、减少冒进。");
      }
      // 败格通用补充第二条：格局专属候运建议（依《子平真诠》"候大运流年以期救格"各格局补救方向各异）
      // 不同格局败格的补救五行不同，专属建议比"等喜用运"更有实际指导价值
      // 仅在 career 尚不足2条时补充（避免重复），且与 wealth 的用神触发文案在维度与视角上有本质区别
      if (career.length < 2) {
        // 各格局专属候运建议（依据：《子平真诠》各格局救格方向）
        const careerWaitingHints: Record<string, string> = {
          // 印格被财破：候印旺运（木火生印、或财星不透的运）救格
          // 依据：《子平真诠》"印格忌财，财来破印，宜行印旺之运以救格"
          "正印格": "候印星旺运（印星透干或大运地支生印）以解财破之局，届时学识与才华可得充分施展。",
          "偏印格": "候印星助旺之运，或大运走入生印之地，方能解枭夺食或财破印之局，才艺发挥才有土壤。",
          // 食神格枭神夺食：候财运制枭
          // 依据：《三命通会》"枭神夺食，运行财星则发"
          "食神格": "候财星大运到来（财星透出或大运生财）以制枭解食，才华方能重见天日，是事业发力的关键时机。",
          // 财格比劫夺财：候官星制劫
          // 依据：《子平真诠》"财格见比劫，官星制之则财可保"
          "正财格": "候官星大运引入（官星透出或大运走入官旺之地）以制比劫，届时财路可稳，事业机会也随之到来。",
          "偏财格": "候官星制劫大运，或比劫被合化之年份；官星运到则财旺而有保障，是财运与事业双发的窗口。",
          // 羊刃无制：候官杀制刃
          // 依据：《子平真诠》"羊刃喜官杀制伏，宜行官杀之运"
          "羊刃格": "候官杀透出或地支引官杀的大运，以驾驭羊刃之锋芒，届时拼劲与决断可以真正转化为事业成就。",
          // 官杀混杂：候合杀或制杀大运（正官格/七杀格官杀混杂的补救方向不同）
          // 依据：《子平真诠》"官杀混杂，宜合杀留官或制杀留官"
          // 正官格混杂：宜合杀留官（七杀被合去，正官得以主导）或印化杀（印星化解七杀之杀气护住正官）
          "正官格": "候合杀留官或印化杀护官的大运，使官杀格局理清，届时职场信誉和晋升机会才能真正打开。",
          // 七杀格混杂（正官透入）：宜合官留杀（正官被合去）或制官（食伤制去正官），使七杀主导格局
          // 七杀格无制（isOfficerBroken）时，第1条已含"候食神制杀或印化杀"，此处不再重复
          // ⚠️ 注：七杀格的候运在下方按 isOfficerMixed / isOfficerBroken 动态决定，此键占位用于 mixed 场景
          "七杀格_mixed": "候合官留杀（正官被合化之大运）或食神透出制官留杀的大运，使七杀格重获主导地位，届时竞争锐气可以稳定转化为事业资本。",
          // 伤官格见官：候印星护卫伤官不与官冲
          // 依据：《子平真诠》"伤官见官，得印化解则格可救"
          "伤官格（有制）": "候印星大运到来护官化伤，或比劫助身以抵抗官星压制，届时才华可以在自由度更高的环境中施展。",
          "伤官格（伤尽）": "候食伤生财大运，以输出能力带动财运；食伤旺运是才艺变现的最佳窗口，宜把握机会。",
          // 建禄格无官无食：候财官透出
          // 依据：《子平真诠》"建禄格，官星大运到来则可成格"
          "建禄格": "候官星或食伤透出的大运，为建禄格打开事业出口；这类大运是格局从蓄势期转为发力期的关键节点。",
        };
        // 七杀格按破格原因区分候运建议：
        // - isOfficerMixed（官杀混杂，正官透入七杀格）：候合官留杀或食神制官，与第1条"合杀或制杀"不重叠
        // - isOfficerBroken（七杀无制，无混杂）：第1条已完整给出"候食神制杀或印星化杀"，跳过第2条避免重叠
        //   改为：给出不重叠的蓄势期行动建议（资源布局、能力积累），与第1条形成递进关系
        // 依据：《子平真诠》"七杀格，制化为贵；无制者蓄势，候运发力"
        let waitingHint: string | undefined;
        if (pattern.name === "七杀格") {
          if (isOfficerMixed) {
            // 官杀混杂：候合官留杀（第1条说"合杀或制杀"针对含混杂，此处更精准指向七杀格的救格方向）
            waitingHint = careerWaitingHints["七杀格_mixed"];
          } else if (isOfficerBroken) {
            // 七杀无制：第1条已含"候食神制杀或印星化杀"→ 第2条改为不重叠的蓄势期具体建议
            // 依据：《子平真诠》"七杀无制时，蓄势期以积累实力为要，切忌空等而无所作为"
            // 依据：《子平真诠》"七杀无制时，以积累实力为要，避免空等而无所为"
            waitingHint = "当下阶段宜专注核心能力的打磨与行业资源积累，以低调扎实的方式建立口碑基础，待时机到来时方能快速放大已有优势。";
          } else {
            waitingHint = careerWaitingHints[pattern.name];
          }
        } else {
          waitingHint = careerWaitingHints[pattern.name];
        }
        if (waitingHint) {
          career.push(waitingHint);
        } else {
          // 极少数格局未有专属候运文案：给出精简的通用候运提示
          // 依据：《子平真诠》"候喜用大运以救格，喜用运到则格局可期翻转"
          const yongShenLabel = yongShen.yongShen.length > 0 ? yongShen.yongShen.join("、") : "喜用";
          career.push(`格局有破格信号，候${yongShenLabel}大运时机以补位，届时事业方能获得有效支撑。`);
        }
      }
    } else {
      // ——成格/待观察：以十神偏重推断优势方向——
      // 仅在无破格矛盾时，按十神偏重给出正向建议
      // 依据：《子平真诠》各格取用原则
      // 正官格/七杀格已有格局专属文案（更精确），跳过通用"官杀信息偏重"文案
      // 依据：《子平真诠》"正官格宜官印相生，七杀格宜食神制杀，通论'适合规则边界'过于笼统"
      // 食神格/伤官格以食伤为纲，专属文案已覆盖"技能输出"信息，与"官杀信息偏重"语义矛盾，跳过
      // 依据：《子平真诠》"食神格以食神生财为纲，与官杀格取用方向迥异"
      const isOfficerKillerPattern = pattern.name === "正官格" || pattern.name === "七杀格";
      const isOutputPattern = pattern.name === "食神格" || pattern.name === "伤官格（有制）" || pattern.name === "伤官格（伤尽）";
      // 羊刃格本身以"有制"（官杀制刃）为格局核心，通用"官杀信息偏重"语义重叠，跳过
      // 依据：《子平真诠》"羊刃格，官杀制刃为贵，格局专属文案已覆盖此信息"
      const isYangRenPattern = pattern.name === "羊刃格";
      // 建禄格专属文案"财官为用，靠自身实力立命"已含官星核心义，通用"官杀信息偏重"语义重叠，跳过
      // 依据：《子平真诠》"建禄格以财官为用，格局专属文案已定性"
      // 财格（正财/偏财）以财星为纲，官星护财为辅，通用"官杀偏重/规则边界"偏离财格主线，跳过
      // 依据：《子平真诠》"财格之取用，财星为主，官护财为辅；通论'适合规则边界'非财格重心"
      // 偏印格专属"偏门技艺独到"定性为自由探索领域，"官杀偏重/适合规则边界"与此方向相悖，跳过
      // 依据：《子平真诠》"偏印格，偏枭者，走偏门技艺；官星压制偏印，反而束缚才华，不应推荐规则职场"
      const isWealthOrLuPattern = pattern.name === "建禄格" || pattern.name === "正财格" || pattern.name === "偏财格" || pattern.name === "偏印格";
      if (officerScore >= 2 && !isOfficerKillerPattern && !isOutputPattern && !isYangRenPattern && !isWealthOrLuPattern) {
        career.push("官杀信息偏重，做事倾向看重秩序、责任与结果，适合有规则边界的岗位。");
      }
      // 正印格/偏印格专属文案已充分描述印星优势路径，跳过通用"印星支持较足"避免冗余
      // 依据：《子平真诠》"正印格官印相生，偏印格偏门技艺，格局专属文案已定性"
      // 正官格专属"官印相生路最顺"已内含印星的作用，通用"印星支持较足"构成语义重叠，跳过
      // 依据：《子平真诠》"正官格，官印相生者贵；专属文案已囊括印星价值，无需再通论"
      const isResourcePattern = pattern.name === "正印格" || pattern.name === "偏印格" || pattern.name === "正官格";
      if (resourceScore >= 2 && !isResourcePattern) {
        career.push("印星支持较足，学习吸收、证照积累、方法论沉淀往往能放大事业稳定性。");
      }
      // 食神格/伤官格专属文案已包含"输出能力"核心信息，跳过通用"食伤较活跃"文案避免冗余
      // 依据：《子平真诠》"食神格才艺输出，伤官格才华卓绝，通论不及格局专属精准"
      // 七杀格以"制杀/化杀"为核心取用路径，通用"食伤较活跃/适合表达创作"偏向食伤格取用方向，
      // 与七杀格主攻竞争高压赛道的定性存在方向错位，跳过
      // 依据：《子平真诠》"七杀格，食神制杀为贵；制杀是手段，非以表达为志业"
      // 正印格以印绶为纲，食伤活跃意味着"食伤泄印"（不利），不应推荐"适合表达创作"路线
      // 依据：《子平真诠》"正印格，印旺者不宜食伤泄秀；食伤过旺，耗损印气，为忌"
      const isQishaPattern = pattern.name === "七杀格";
      const isZhengyinPattern = pattern.name === "正印格";
      // 正官格以"官印相生"为纲，食伤偏旺对正官格是"伤官克官"的警示信号而非优势，
      // 不应推荐"适合表达、创作"方向（与格局主线相悖）
      // 依据：《子平真诠》"正官格最忌伤官，食伤偏旺则格局受损，不宜以食伤方向定性事业路线"
      const isZhenggGuanPattern = pattern.name === "正官格";
      if (outputScore >= 2 && !isOutputPattern && !isQishaPattern && !isZhengyinPattern && !isZhenggGuanPattern) {
        career.push("食伤较活跃，适合表达、策划、产品、创作、咨询等需要输出能力的场景。");
      }
      // 成格格局专属核心路径（依《子平真诠》各格取用的职业方向）
      // 先给出格局专属一条定性建议，再追加"格局清纯"的总结
      // 注意：当格局为正官格/七杀格时，通用"官杀信息偏重"文案与专属文案语义重叠，
      // 应跳过通用文案，只保留格局专属文案（更精确、更具体）。
      // 依据：《子平真诠》"格局取用专一，通论不及格局取用之精确"
      const officerPatternNames = new Set(["正官格", "七杀格"]);
      // 财格（正财/偏财）中格局专属文案已包含"稳健经营/流通八方"信息，
      // 通用"食伤活跃"文案与财格的逻辑并无冲突但重复度较高，保留即可
      // 只对官杀格做专属去重
      switch (pattern.name) {
        case "正官格":
          // 《子平真诠》"正官格，官印相生者贵，宜仕途、管理、有规则边界之职"
          career.push("正官格清纯，官印相生路最顺，适合仕途体制、管理岗位或需要专业资质认证的领域。");
          break;
        case "七杀格":
          // 《子平真诠》"七杀格，以制为贵，食神制杀，适合高压竞争领域"
          career.push("七杀格以制为贵，竞争性强、高压目标驱动的赛道最能激发潜力，适合军警、投资、律师、技术尖端等高难度领域。");
          break;
        case "正财格":
          // 《子平真诠》"正财格，勤劳经营，以官护财最佳"
          career.push("正财格以勤劳积累为本，适合金融、贸易、实业或需要精细管理资源的职业，持续稳健的经营比冒险更能发挥格局优势。");
          break;
        case "偏财格":
          // 《子平真诠》"偏财格，流通八方，适合广结人脉、以财通人"
          career.push("偏财格财源广阔，适合社交广泛的行业、销售、中介、投资并购或多线并进的商业模式，人脉与流通是核心竞争力。");
          break;
        case "正印格":
          // 《子平真诠》"正印格，官印相生，适合学问、文化、教育、学术"
          career.push("正印格以文化积累为基，适合学术研究、教育、文化传播、医疗或法律等需要资历与信誉积累的领域。");
          break;
        case "偏印格":
          // 《子平真诠》"偏印格，偏门技艺"
          career.push("偏印格偏门技艺独到，适合专项技术研究、艺术创作、心理咨询、玄学或独创性强的专业领域。");
          break;
        case "食神格":
          // 《子平真诠》"食神格，食神生财，适合才艺、饮食、服务"
          career.push("食神格秀气流通，适合文艺创作、餐饮美食、服务设计或以技能输出变现的路径，生活品质感强是天然优势。");
          break;
        case "伤官格（有制）":
          // 《子平真诠》"伤官格，才华过人，宜创新创业，不宜官场"
          career.push("伤官格才艺出众，最宜创新创业、技术攻坚或艺术领域，独立自主的环境比规则约束型更能释放能量。");
          break;
        case "伤官格（伤尽）":
          // 《子平真诠》"伤官伤尽，最喜财星；无官可伤，以财为纲，才艺变现路径最顺"
          career.push("伤官格（伤尽），官星无从干扰，才艺输出最为流畅；以技能变现、创作、培训或技术咨询为路径，财星大运到来时最易出成果。");
          break;
        case "建禄格":
          // 《子平真诠》"建禄格，身旺以财官为用，靠自身实力打拼"
          career.push("建禄格日主身旺，靠自身实力立命，财官为用时适合独立创业或在竞争中凭本事出头，不依赖背景。");
          break;
        case "羊刃格":
          // 《子平真诠》"羊刃格，有官杀制刃，宜刚烈竞争之职"
          career.push("羊刃格有制，刚烈之气得以约束且善加利用，适合军警、外科、竞技体育或高压高风险的专业领域。");
          break;
      }
      // 比劫偏重推荐合伙（在"格局清纯"总结之前输出，使逻辑更连贯）：
      // 仅当日主五行在用神中（比劫已被取为用神，说明身弱需同气扶助）
      // 或用神明确包含比劫且非财格（财格比劫偏重是破财信号而非合伙优势，不宜推荐合伙）
      // 依据：《子平真诠》"财格见比劫为忌，官制比劫则财可保；印格、建禄格比劫为用神则宜合伙"
      const isWealthPattern = pattern.name === "正财格" || pattern.name === "偏财格";
      const peerIsYongShen = yongShen.yongShen.includes(dayMaster.element);
      if (peerIsYongShen && !isWealthPattern && peerScore >= 2) {
        career.push("命局比劫或同气力量参与用神取用，适合团队协作、合伙经营或需要人脉资源整合的路径。");
      }
      // 格局清纯结语：仅在已有≥2条有实质内容时才输出（避免唯一的第2条是废话）
      // 替代方案：当 career 只有1条时，用各格局专属的"成功因素"补充，而非空洞的"清纯顺势"
      // 依据：《子平真诠》"各格局取用有异，成格后的发展路径各有侧重"
      if (career.length >= 2) {
        // 已有足够条数，用简短结语收尾
        career.push("格局清纯，事业发展宜顺势强化优势领域。");
      } else {
        // 只有1条时：输出格局专属的"成功关键要素"补充，比"格局清纯"更有价值
        const careerKeyFactors: Record<string, string> = {
          "正官格": "大运走入印星或官旺之地时，是职场晋升与获得重要机会的关键窗口，宜在此期间主动争取。",
          "偏印格": "大运走入食伤生财或偏印旺运时，是专项才艺变现、突破局限的最佳时机，宜提前布局。",
          "食神格": "大运走入财星旺运时，是才艺输出转化为实际收益的高效期，宜在此前完成技能积累与口碑建立。",
          "正财格": "大运走入官星旺运时，财运最为稳健，适合扩大经营规模或推进重要的财务决策。",
          "偏财格": "大运走入官星制劫或比劫被合化之时，是财运与事业双峰叠加的黄金期，宜提前把握机会。",
          "羊刃格": "大运走入官杀旺运时，刃力得以充分驾驭，是拼搏竞争中获得突破成果的高峰期。",
          "伤官格（有制）": "大运走入食伤生财运时，才艺输出与财务收益形成正向循环，是最容易出成果的阶段。",
          "伤官格（伤尽）": "大运走入财星旺运时，才华可以最顺畅地转化为财富，是职业事业高速发展的窗口期。",
          "建禄格": "大运走入财官透出之时，建禄格才能充分发挥自身实力，是事业真正腾飞的关键节点。",
          "七杀格": "大运走入食神制杀或印化杀之时，七杀之力得以驾驭，是竞争高压赛道中真正取得突破的时机。",
        };
        const keyFactor = careerKeyFactors[pattern.name];
        if (keyFactor) {
          career.push(keyFactor);
        } else {
          career.push("格局清纯，事业发展宜顺势强化优势领域。");
        }
      }
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
    // 正格 wealth 分析（阈值降至 >=2，与 career 维度保持一致）
    // 破格病灶识别：防止将"病灶"推荐为优势
    const wealthBrokenReason = pattern.outcome === "败格" ? (pattern.reasons.slice(-1)[0] ?? "") : "";
    // 印格（正印格/偏印格）败格原因是财星破印时，财星多是病灶，不应推荐"财星活跃利于经营"
    // 依据：《子平真诠》"印格忌财，财来破印，不可以财为用"
    const isResourcePatternBroken = wealthBrokenReason.includes("财星透出，印星受克");
    // 财格判定：在 wealth 分析中独立声明，避免依赖 career 分支中的同名变量（作用域不同）
    const isWealthPattern = pattern.name === "正财格" || pattern.name === "偏财格";
    // 财格败格判定（用于 wealth 分析）：财格破格常因比劫夺财，财星虽活跃但已是"被分之财"
    // 依据：《子平真诠》"财格见比劫而无官星制衡，财旺亦难持久，以警示为主"
    const isWealthPatternBroken = isWealthPattern && pattern.outcome === "败格";
    if (wealthScore >= 2) {
      if (isResourcePatternBroken) {
        // 印格被财破：财星活跃是破格病灶，应警示而非推荐
        wealth.push("命局财星活跃但印格遭财破，财务事务容易分散精力、干扰专业积累；宜以技能立身，避免分心于资金经营或投资，待印旺大运方能驾驭财星。");
      } else if (isWealthPatternBroken) {
        // 财格败格（比劫夺财）：财星活跃但已被比劫分夺，不应推荐"利于经营"
        // 败格财格的财星是"被竞争分夺的财"，应警示而非正向推荐
        // 依据：《子平真诠》"正财格，比劫为大忌，财旺无官制，守财难，宜候官星大运"
        wealth.push("财星活跃但格局遭比劫破，财富虽有却难以独享；宜等官星大运到来制衡比劫，届时财路方能稳固，避免辛苦所得被分摊或失控。");
      } else if (isWealthPattern && peerScore >= 2) {
        // 财格成格 + 财星活跃 + 比劫偏多：
        // 财多而比劫争夺，两者并存是"财旺被分"的警示场景
        // 依据：《子平真诠》"正财格，比劫为大忌，财旺而比劫透，需官星制劫方能守财"
        wealth.push("财星活跃而比劫偏多，财富机会与竞争分夺并存；财格最忌比劫分财，宜等官星透出或大运引入官星制劫，方能稳住财源，避免得而复失。");
      } else if (!isWealthPattern && peerScore >= 2) {
        // 非财格中：财星活跃 + 比劫偏多，并非直接矛盾（非财格不以财为本），
        // 但两者分开各说一条略显冗余，合并为"挣多分多"的综合提示更连贯
        // 依据：《子平真诠》"比劫者，夺财之神，财旺而比劫重，则财路虽宽而难以独享"
        wealth.push("财星活跃，对资源与现金流敏感；但比劫偏多，财来财往分摊比例也高，需注意合伙成本与人际分利，独立经营时反而更容易守住收益。");
      } else {
        wealth.push("财星活跃，命盘对资源、项目、交易和现金流更敏感，利于经营意识的培养。");
      }
    }
    // 比劫偏多（财星不活跃时单独输出）
    // 当 wealthScore >= 2 时，已在上方各分支中合并处理（财格：警示合并；非财格：综合提示）
    // 仅当 wealthScore < 2 时才单独输出比劫偏多文案
    if (peerScore >= 2 && wealthScore < 2) {
      wealth.push("比劫偏多，拿项目、做合伙、争资源的动力强，但也要防止分财与成本失控。");
    }
    if (yongShen.yongShen.includes(CONTROLLING[dayMaster.element])) {
      wealth.push("财星恰与用神方向重合，理财与创收的天然敏感度更高，值得重点经营。");
    }
    // 格局专属财富补充：优先在 wealth 无格局定性文案时补充格局核心财富路径
    // 触发条件：未有已输出的专属警示文案（印格财破/财格败格/财格比劫并存）
    // 这些专属警示已精确定性格局财运，格局专属文案补充会造成方向矛盾
    // 依据：《子平真诠》"各格取用不同，财富路径各异，当以格局为纲，不宜以通论代之"
    const wealthHasSpecificWarning = isResourcePatternBroken || isWealthPatternBroken || 
      (isWealthPattern && peerScore >= 2);
    if (!wealthHasSpecificWarning) {
      const patternWealthHints: Record<string, string> = {
        "正财格": "正财格以财为本，财星藏于月令之中，积累财富宜稳健经营，重在守财与持续积累；忌劫财分夺，大运逢官星制劫则财源稳固。",
        "偏财格": "偏财格以义财为用，对商机和资源嗅觉灵敏，擅长合作与横向整合；比劫旺运中需防合伙纠纷或资源被分，官星制比劫时财路更稳。",
        "正印格": "正印格以印为体，财星入格易破印，财富积累宜间接渠道（如平台资源、证照权威带来的收益），而非直接经营或囤积资金。",
        "偏印格": "偏印格才艺或技能为根基，财富最宜以技能或学识变现；直接经营资金或投机往往效果欠佳，宜以专业积累带财。",
        "七杀格": "七杀格以制化为贵，财富多借助权力平台或高压任务转化而来；自身做生意或独立经营效果有限，宜以事业带财、以职位变现。",
        "伤官格（有制）": "伤官格财富多来自才艺或创意的输出，以表达、设计、咨询等间接方式变现更为自然；守财能力相对弱，更擅长挣快钱或阶段性收益。",
        "伤官格（伤尽）": "伤官伤尽格以食伤生财为天然通道，才艺直接变财是优势路径；财运宜顺不宜逆，大运逢财星流年时把握机会。",
        "建禄格": "建禄格比劫旺，财富积累需靠精准的用神方向作为出口；官杀或食伤透出时财路才真正打开，无此出口则财路相对迂回。",
        "食神格": "食神格以食神生财为最佳路径，才能或专业输出直接带来财富回报；印运中才华受压，财路也会相应收窄，需留意时机。",
        "正官格": "正官格以官印相生为贵，财富多通过职位晋升、薪资增长或体制内资源带来；直接经商往往非强项，以仕途或专业地位带动财富积累最为稳当。",
        "羊刃格": "羊刃格身旺财弱为常态，财富需靠官杀制刃之力转化才能稳固；适合拼劲十足的高薪职业或需要魄力的行业，守财能力需刻意培养。",
      };
      const hint = patternWealthHints[pattern.name];
      if (hint) wealth.push(hint);
    }
  }
  // 用神财运补充：仅在 wealth 中没有实质性格局专属文案（只有比劫/财星活跃泛化文案）时输出，
  // 避免与格局专属文案冗余，也避免与 career 败格用神文案跨维度重叠。
  // 判断标准：
  //   1. 未命中"财星恰与用神方向重合"（该文案已从财星直接匹配角度说清楚）
  //   2. wealth 中无格局专属文案（格局专属文案已从财富路径角度定性清楚，无需再追加触发时机）
  //   3. wealth 条数不足时作为兜底
  // 依据：《子平真诠》"用神既明，候运而动；格局既定，财路已指，触发时机融入格局文案更为精准"
  const wealthAlreadyHasYongShenInfo = wealth.some(s => s.includes("财星恰与用神方向重合"));
  // 格局专属财富文案的识别标志：包含格局定性词汇（而非通用的"财星活跃"/"比劫偏多"）
  // 同时认可专属警示文案（财格破格警示 / 印格财破警示）也属于"已有格局专属信息"
  // 依据：专属警示已从格局角度对财运作出定性，无需再追加通用五行触发提示
  const wealthHasPatternSpecific = wealth.some(s =>
    s.includes("格局") || s.includes("财路") || s.includes("守财") ||
    s.includes("变现") || s.includes("制化") || s.includes("才艺") ||
    s.includes("体制") || s.includes("职位") || s.includes("阶段性收益") ||
    s.includes("以财为本") || s.includes("以印为体") || s.includes("食伤生财") ||
    // 专属警示文案识别（财格败格/印格财破/比劫并存警示）
    s.includes("格局遭比劫破") || s.includes("印格遭财破") || 
    s.includes("财富机会与竞争分夺并存") || s.includes("财星活跃，对资源与现金流")
  );
  if (yongShen.yongShen.length > 0 && !wealthAlreadyHasYongShenInfo && !wealthHasPatternSpecific) {
    // 无格局专属文案时的财运补充：
    // 败格时 career 已给出"候X运补救"方向，wealth 避免重复"等运时机"的说法，
    // 改为聚焦"当下财务风险管理与守财策略"，从现实操作层面给出建议。
    // 成格时输出"哪类五行运程对财运积累最有利"的触发时机。
    // 依据：《子平真诠》"败格者，当务之急在于保守现有，候运补救；成格者，顺势而为，用神运到则财发"
    const yongShenLabel = yongShen.yongShen.join("、");
    if (pattern.outcome === "败格") {
      // 败格时：给出守财/理财的当下操作建议，不重复career的"候运"方向
      // 依据：《子平真诠》"格局不济时，理财宜保守，以稳健积累为先，避免冒险扩张"
      wealth.push(
        `格局处于补救期，财务上宜保守稳健、量入为出，避免大额投资或冒险扩张；稳住基本盘，待格局补救后再伺机扩展财路。`
      );
    } else {
      // 成格时：给出五行触发时机（区别于 career 的事业发力窗口）
      // 依据：《三命通会》"财运者，五行得令，财星当旺之时也；喜用五行当令，财源自然开"
      wealth.push(
        `从五行角度看，${yongShenLabel}运程对财运积累最为有利；大运流年走入此类五行旺地时，是把握收益机会的优先时机。`
      );
    }
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
        // 句1：感情底色与关系模式；句2：大运运势对感情的影响（两句角度互补，无重叠）
        relationships.push("从杀格感情底色偏于服从与磨合——在有规则边界、层次分明的关系里反而踏实；自身易扮演配合与执行的角色，但长期过度依附或压抑时需主动调节。");
        relationships.push("大运逢食伤制杀之地，感情关系中话语权和主动性明显增加；印绶大运则情感更稳但易囿于旧模式，需留意关系中的惰性积累。");
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
    // 旺衰维度的感情底色：日主旺弱直接影响感情中的主动/被动格局
    // 依据：《三命通会》"日主旺则感情主动，日主弱则感情被动或受牵制"
    // 通用旺衰感情底色（有格局专属文案时，仅针对真正矛盾的组合跳过，其余保留）
    // 矛盾组合：偏印格"独立性较强"vs日主气弱"感情被动"；正印格"可能显得被动"vs日主气旺"感情主动"
    // 依据：《三命通会》"日主旺则感情主动，日主弱则感情被动或受牵制"
    // 针对真正矛盾的格局+旺衰组合，用专属补充句替代通用旺弱底色
    // 依据：《子平真诠》格局取用为先，旺弱底色为辅
    if (pattern.name === "偏印格" && !strength.isStrong) {
      // 偏印格"独立性较强"与日主气弱"感情被动"矛盾 → 换用不矛盾的补充
      // 偏印格气弱：内心独立但实际能量储备有限，需先建立自身根基再深入经营关系
      relationships.push("命局气弱，虽内心独立，实际能量积蓄有限；感情中宜量力而行，先巩固自身根基，避免因过度付出或情感消耗而透支。");
    } else if (pattern.name === "正印格" && strength.isStrong) {
      // 正印格"可能显得被动"与日主气旺"感情主动"矛盾 → 换用不矛盾的补充
      // 正印格气旺：感性细腻有主见，感情中能主动表达，但惯性依赖印星导致内在需求也强
      // 正印格气旺：聚焦于主动表达能力与感情节奏的主动性，不重复格局专属"被理解需求"的描述
      // 依据：《子平真诠》"印旺则思虑细腻、感情主动，但需留意主动中仍有印星依赖的柔性"  
      relationships.push("命局气旺，感情中能主动把握节奏和表达心意，但在关系投入时仍需留意印星惯性带来的情感依赖倾向，保持适度的独立空间。");
    } else {
      if (strength.isStrong) {
        relationships.push("日主气旺，感情中往往处于相对主动的位置，更容易主动经营和把握关系节奏；需注意避免过于强势导致对方感到压力。");
      } else {
        relationships.push("日主气弱，感情中更倾向于被动接受和顺应，容易因外部压力或对方的主导性影响而左右感情方向；先自立则感情更稳。");
      }
    }
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
    // 女命正官多：通用文案"对规则、承诺与责任感的需求较强"
    // 当格局本身是正官格时，格局专属文案已精准覆盖此语义，无需重复输出十神通用文案
    // 依据：《子平真诠》"正官格以正官为纲，格局专属感情定性比十神通用更精确，不应叠说"
    if (gender === "female" && zhengGuanCount >= 2 && pattern.name !== "正官格") {
      // 女命正官多：或婚姻关系多番，或感情中对规则与责任较敏感
      relationships.push("命局正官偏多，感情中对规则、承诺与责任感的需求较强；大运逢官星旺地，婚配议题易被激活。");
    }
    // 女命七杀旺而无正官：通用文案"高张力、强吸引"
    // 当格局本身是七杀格时，格局专属文案已精准覆盖"张力与激情"语义，无需重复输出十神通用文案
    // 依据：《子平真诠》"七杀格以制化为贵；格局专属感情定性涵盖高张力特征，十神通用文案构成冗余"
    if (gender === "female" && qiShaCount >= 2 && zhengGuanCount === 0 && pattern.name !== "七杀格") {
      // 女命七杀旺而无正官：感情偏向强势有吸引力的对象，关系容易高张力
      relationships.push("命局七杀偏重而无正官制化，感情模式偏向高张力、强吸引的类型；需留意关系节奏过快或情绪拉锯。");
    }
    if (shangGuanCount >= 2 && (gender === "female" ? zhengGuanCount > 0 : true)) {
      // 伤官旺：感情表达直接锋利，容易因言辞产生摩擦（女命伤官见官更甚）
      relationships.push("命局伤官活跃，感情中情绪和言辞容易外露；优点是真实直接，但也需注意边界与表达方式，避免无意中刺伤亲密关系。");
    }
    // 格局感情专属文案（始终输出，比通用旺衰底色更精准，与日主旺弱不重叠）
    // 依据：《子平真诠》《三命通会》各格局人际特征：格局感情定性比日主旺弱更具体
    const patternRelHints: Record<string, string> = {
      "正官格": "正官格感情中对责任感和秩序感有天然需求，倾向于稳定、有承诺的关系模式；正官代表规则约束，关系里往往注重礼义与名分。",
      "七杀格": "七杀格感情中带有一定张力与激情，对强势或有挑战性的关系反而更有吸引力；需留意激情消退后的关系维护，以及控制欲的边界。",
      "正财格": "正财格（男命）正财为配偶星，感情中倾向于脚踏实地、经济稳定的关系；注重实际和长期价值，但也需防守财过度影响感情的灵动。",
      "偏财格": "偏财格感情中交际能力强，异性缘广，多才多艺的一面容易吸引人；但偏财流动性强，感情上也需注意稳定性和专一程度。",
      "正印格": "正印格感情中感性细腻，对精神共鸣和被理解的需求较强；倾向于稳定、有依托的关系，但过度依赖印星的安全感时可能显得被动。",
      "偏印格": "偏印格感情中独立性较强，内心世界丰富但不易轻易示人；对有才气或特殊气质的对象更感兴趣，感情节奏上多走慢热路线。",
      "食神格": "食神格感情中温润平和，不喜对抗，更倾向于轻松愉悦的相处氛围；对美食、艺术或生活品质有共同追求的伴侣更能产生共鸣。",
      "伤官格（有制）": "伤官格感情中情感浓烈、个性鲜明，对感情有高期待；优点是真诚热情，但言辞直接或情绪化表达容易在亲密关系中引发摩擦。",
      "伤官格（伤尽）": "伤官伤尽格感情中以才气和精神共鸣取胜，对知音型伴侣更有感觉；官星缺席时关系更自由，但长期稳定关系需要自身主动经营结构感。",
      "羊刃格": "羊刃格感情中热烈直接，敢爱敢恨，进退分明；需留意冲动决策和情绪化表达对关系的伤害，遇到官星制刃时感情反而更踏实。",
      "建禄格": "建禄格感情中自我意志较强，有主见，适合独立型或相互尊重的关系模式；比劫旺时需留意在感情中的竞争或强势倾向。",
    };
    const patternRelHint = patternRelHints[pattern.name];
    if (patternRelHint) relationships.push(patternRelHint);
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
    // 变格五行描述改为直接点明对应脏腑倾向，为后续格局专属文案提供具体五行背景
    // 依据：《黄帝内经》"五脏应五行，偏盛者亢，偏弱者虚"
    const ORGAN_SHORT: Record<string, { excess: string; deficient: string }> = {
      "木": { excess: "肝气偏亢（易急躁、眼疲劳）", deficient: "肝血偏弱（易眼干、筋紧）" },
      "火": { excess: "心火偏旺（易心悸、睡眠浅）", deficient: "心阳偏弱（易乏力、怕冷）" },
      "土": { excess: "脾胃湿热（易积滞、体重）", deficient: "脾胃偏弱（易消化差、续航短）" },
      "金": { excess: "肺气过旺（易皮肤干燥、鼻咽敏感）", deficient: "肺气偏弱（易感冒、抵抗力弱）" },
      "水": { excess: "肾水偏旺（易腰膝酸软、下焦湿寒）", deficient: "肾气偏弱（易腰背无力、睡眠浅）" }
    };
    const excessDesc = elementBalance.strongest.map(el => ORGAN_SHORT[el]?.excess).filter(Boolean).join("、");
    const deficientDesc = elementBalance.weakest.map(el => ORGAN_SHORT[el]?.deficient).filter(Boolean).join("、");
    const parts: string[] = [];
    if (excessDesc) parts.push(`${strongest}偏盛：${excessDesc}`);
    if (deficientDesc) parts.push(`${weakest}偏弱：${deficientDesc}`);
    if (parts.length > 0) {
      health.push(`五行底色：${parts.join("；")}，以下格局特质在此基础上叠加影响。`);
    }
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
