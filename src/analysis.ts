import {
  BRANCH_HALF_TRIPLE_RELATIONS,
  BRANCH_META,
  BRANCH_TRIPLE_RELATIONS,
  STEM_META,
  computeTenGod,
  findBranchPairRelation,
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
): void {
  const key = buildSignalKey(signal);
  if (seen.has(key)) {
    return;
  }
  seen.add(key);
  signals.push(signal);
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
  if (strength.level === "中和") {
    overview.push("日主中和，扶抑之力大致平衡，需结合格局与用神再定取舍。");
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
  if (career.length === 0) {
    career.push(DIMENSION_FALLBACK.career);
  }

  if (wealthScore >= 3) {
    wealth.push("财星活跃，命盘对资源、项目、交易和现金流更敏感，利于经营意识的培养。");
  }
  if (peerScore >= 3) {
    wealth.push("比劫偏多，拿项目、做合伙、争资源的动力强，但也要防止分财与成本失控。");
  }
  const wealthElement = CONTROLLING[dayMaster.element];
  if (yongShen.yongShen.length > 0) {
    wealth.push(
      `用神方向以${yongShen.yongShen.join("、")}为先，大运流年一旦引动此类五行，往往是财富节奏的重要触发点。`
    );
  }
  if (yongShen.yongShen.includes(wealthElement)) {
    wealth.push("财星恰与用神方向重合，理财与创收的天然敏感度更高，值得重点经营。");
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

  if (supportiveRelation) {
    relationships.push(`日支参与${supportiveRelation.type}，亲密关系更容易被联动、合和或外部缘分触发。`);
  }
  if (tenseRelation) {
    relationships.push(`日支出现${tenseRelation.type}，情感关系里更要留意节奏拉扯、误解累积和边界冲撞。`);
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

  const strongest = elementBalance.strongest.join("、");
  const weakest = elementBalance.weakest.join("、");
  health.push(`健康观察上，先看${strongest}偏盛与${weakest}偏弱对应的寒热燥湿失衡。`);

  if (strength.level === "身极弱" || strength.level === "身弱") {
    health.push("日主偏弱，整体抗压耐受度相对有限，作息规律和体力储备上更需要留有余量。");
  } else if (strength.level === "身旺" || strength.level === "身强") {
    health.push("日主偏旺，精力充沛的同时也容易情绪或气血过亢，宜适度疏泄、避免长期硬扛。");
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
    pushSignal(signals, seen, signal);
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
      registerSignal(
        {
          category: "ten-god",
          type: flowTenGod,
          tone: "challenging",
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
  // 地支五行信号：只保留 overall 一条消息，health 维度交给后续地支关系信号处理
  const branchInteraction = getElementInteraction(dayMaster.element, BRANCH_META[flowBranch].element);
  if (branchInteraction === "controlled-by") {
    registerSignal(
      {
        category: "element",
        type: "地支克我",
        tone: "challenging",
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
        type: "地支生我",
        tone: "supportive",
        description: `${levelLabel}地支${flowBranch}五行对日主形成“生我”关系。`,
        members: [dayMaster.value, flowBranch]
      },
      [
        { dimension: "overall", delta: 1, message: `${levelLabel}地支${flowBranch}生扶日主，底层环境容易出现托举。` }
      ]
    );
  }

  // 对原局地支去重，避免原局有重复地支时生成重复信号
  const seenNatalBranches = new Set<string>();
  for (const natalBranch of natalBranches) {
    if (seenNatalBranches.has(natalBranch)) continue;
    seenNatalBranches.add(natalBranch);
    const relation = findBranchPairRelation(flowBranch, natalBranch);
    if (!relation) {
      continue;
    }

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
    const relation = findBranchPairRelation(flowBranch, parentBranch);
    if (relation) {
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
