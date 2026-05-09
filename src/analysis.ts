import {
  BRANCH_META,
  BRANCH_TRIPLE_RELATIONS,
  STEM_META,
  computeTenGod,
  findBranchPairRelation,
  getElementInteraction
} from "./constants";
import type {
  AnalysisTone,
  BaziAnalysis,
  Element,
  ElementBalance,
  FlowAnalysis,
  FlowSignal,
  Gender,
  PillarDetails,
  RelationRecord,
  TenGodDistribution
} from "./types";

const DIMENSION_FALLBACK = {
  career: "当前样本更适合结合大运和流年一起判断事业起伏。",
  relationships: "关系宫位还需要结合大运、流年与日支联动一起判断。",
  health: "健康维度建议结合五行偏枯、寒热燥湿再做二次细分。",
  wealth: "财富维度建议结合财星来源、比劫分财和大运触发一起判断。"
} as const;

const FLOW_FALLBACK = {
  overall: "该阶段的流运信号较为均衡，宜把它视为趋势提示而不是单点结论。",
  career: "事业维度以阶段性变化为主，建议结合现实项目与职位节点一起观察。",
  relationships: "关系维度暂无单一强信号，更适合结合沟通节奏和现实互动判断。",
  health: "健康维度暂无强烈单点信号，适合重点观察作息、压力与体感变化。",
  wealth: "财富维度暂无单一强信号，建议重点看现金流、合作分配与支出结构。"
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
}): BaziAnalysis {
  const { dayMaster, elementBalance, tenGodDistribution, relations, startSolar, direction, dayBranch } =
    args;

  const overview: string[] = [];
  overview.push(`日主为${dayMaster.value}${dayMaster.element}，属于${dayMaster.yinYang}性之主。`);
  overview.push(...elementBalance.observations);
  overview.push(...tenGodDistribution.observations);
  overview.push(`大运按${direction === "forward" ? "顺行" : "逆行"}展开，起运公历时间为${startSolar}。`);

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
  if (career.length === 0) {
    career.push(DIMENSION_FALLBACK.career);
  }

  if (wealthScore >= 3) {
    wealth.push("财星活跃，命盘对资源、项目、交易和现金流更敏感，利于经营意识的培养。");
  }
  if (peerScore >= 3) {
    wealth.push("比劫偏多，拿项目、做合伙、争资源的动力强，但也要防止分财与成本失控。");
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
    ["六合", "三合", "三会"].includes(relation.type)
  );

  if (supportiveRelation) {
    relationships.push(`日支参与${supportiveRelation.type}，亲密关系更容易被联动、合和或外部缘分触发。`);
  }
  if (tenseRelation) {
    relationships.push(`日支出现${tenseRelation.type}，情感关系里更要留意节奏拉扯、误解累积和边界冲撞。`);
  }
  if (relationships.length === 0) {
    relationships.push(DIMENSION_FALLBACK.relationships);
  }

  const strongest = elementBalance.strongest.join("、");
  const weakest = elementBalance.weakest.join("、");
  health.push(`健康观察上，先看${strongest}偏盛与${weakest}偏弱对应的寒热燥湿失衡。`);
  if (elementBalance.strongest.length === 1 && elementBalance.weakest.length === 1) {
    health.push("后续如果做更细报告，可以把体感与作息问题映射到对应五行系统继续展开。");
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
      registerSignal(
        {
          category: "ten-god",
          type: flowTenGod,
          tone: "supportive",
          description: `${levelLabel}天干${flowStem}为${flowTenGod}，强调规则、责任和职位秩序。`,
          members: [dayMaster.value, flowStem]
        },
        [
          { dimension: "overall", delta: 1, message: `${levelLabel}官星显露，阶段节奏更偏向规范推进。` },
          { dimension: "career", delta: 2, message: `${levelLabel}正官到位，事业上更利于职责明确、晋升考核或身份建立。` },
          ...(gender === "female"
            ? [
                {
                  dimension: "relationships" as const,
                  delta: 1,
                  message: `${levelLabel}官星对女命也常会带来关系议题的强化。`
                }
              ]
            : [])
        ]
      );
      break;
    case "七杀":
      registerSignal(
        {
          category: "ten-god",
          type: flowTenGod,
          tone: "mixed",
          description: `${levelLabel}天干${flowStem}为${flowTenGod}，带来压力、竞争和突进式要求。`,
          members: [dayMaster.value, flowStem]
        },
        [
          { dimension: "overall", delta: 0, message: `${levelLabel}七杀发力，推进速度快，但伴随要求和压力。` },
          { dimension: "career", delta: 1, message: `${levelLabel}七杀更像高压任务期，适合硬仗，但不宜失控冒进。` },
          { dimension: "health", delta: -1, message: `${levelLabel}七杀偏重时，身心负荷和紧绷感要重点留意。` },
          ...(gender === "female"
            ? [
                {
                  dimension: "relationships" as const,
                  delta: -1,
                  message: `${levelLabel}七杀对关系也可能带来压迫感或强刺激。`
                }
              ]
            : [])
        ]
      );
      break;
    case "正财":
    case "偏财":
      registerSignal(
        {
          category: "ten-god",
          type: flowTenGod,
          tone: "supportive",
          description: `${levelLabel}天干${flowStem}为${flowTenGod}，资源、交易与现实回报议题升温。`,
          members: [dayMaster.value, flowStem]
        },
        [
          { dimension: "overall", delta: 1, message: `${levelLabel}财星浮现，更容易把注意力拉向资源和结果。` },
          { dimension: "career", delta: 1, message: `${levelLabel}财星阶段更利于项目落地、客户经营和资源整合。` },
          { dimension: "wealth", delta: 2, message: `${levelLabel}${flowTenGod}到位，财富主题会更直接地被触发。` },
          ...(gender === "male"
            ? [
                {
                  dimension: "relationships" as const,
                  delta: 1,
                  message: `${levelLabel}财星对男命也常对应关系与伴侣主题的升温。`
                }
              ]
            : [])
        ]
      );
      break;
    case "食神":
      registerSignal(
        {
          category: "ten-god",
          type: flowTenGod,
          tone: "supportive",
          description: `${levelLabel}天干${flowStem}为${flowTenGod}，表达、输出、舒展和作品感增强。`,
          members: [dayMaster.value, flowStem]
        },
        [
          { dimension: "overall", delta: 1, message: `${levelLabel}食神较旺，阶段氛围更利于展开和输出。` },
          { dimension: "career", delta: 1, message: `${levelLabel}食神阶段适合创作、传播、产品表达和方法输出。` },
          { dimension: "health", delta: 1, message: `${levelLabel}食神也常对应状态舒展与恢复空间增大。` },
          { dimension: "wealth", delta: 1, message: `${levelLabel}食神带动输出变现，适合把能力转成结果。` }
        ]
      );
      break;
    case "伤官":
      registerSignal(
        {
          category: "ten-god",
          type: flowTenGod,
          tone: "mixed",
          description: `${levelLabel}天干${flowStem}为${flowTenGod}，突破、质疑、表达冲劲和规则摩擦并存。`,
          members: [dayMaster.value, flowStem]
        },
        [
          { dimension: "overall", delta: 0, message: `${levelLabel}伤官当令，适合突破，但也容易和规则硬碰。` },
          { dimension: "career", delta: 0, message: `${levelLabel}伤官更利创新表达，不利僵硬体系下的顺从推进。` },
          { dimension: "relationships", delta: -1, message: `${levelLabel}伤官偏强时，说话方式和边界感更需要克制。` },
          { dimension: "health", delta: -1, message: `${levelLabel}伤官阶段常伴随消耗、熬夜或情绪外放。` }
        ]
      );
      break;
    case "正印":
    case "偏印":
      registerSignal(
        {
          category: "ten-god",
          type: flowTenGod,
          tone: "supportive",
          description: `${levelLabel}天干${flowStem}为${flowTenGod}，学习、保护、支持系统与恢复力增强。`,
          members: [dayMaster.value, flowStem]
        },
        [
          { dimension: "overall", delta: 1, message: `${levelLabel}印星增强，更利于吸收、复盘和修正节奏。` },
          { dimension: "career", delta: 1, message: `${levelLabel}印星阶段适合学习、考证、拿方法论和构建支撑系统。` },
          { dimension: "health", delta: 1, message: `${levelLabel}印星也有助于恢复和自我保护。` }
        ]
      );
      break;
    case "比肩":
      registerSignal(
        {
          category: "ten-god",
          type: flowTenGod,
          tone: "mixed",
          description: `${levelLabel}天干${flowStem}为${flowTenGod}，自我主张、同侪竞争与独立行动意愿变强。`,
          members: [dayMaster.value, flowStem]
        },
        [
          { dimension: "overall", delta: 0, message: `${levelLabel}比肩阶段更强调自我决断和并行竞争。` },
          { dimension: "wealth", delta: -1, message: `${levelLabel}比肩偏旺时，财务上要防分流、摊薄和资源平分。` },
          { dimension: "relationships", delta: -1, message: `${levelLabel}比肩强化自我立场，关系里更要注意互相让位。` }
        ]
      );
      break;
    case "劫财":
      registerSignal(
        {
          category: "ten-god",
          type: flowTenGod,
          tone: "challenging",
          description: `${levelLabel}天干${flowStem}为${flowTenGod}，竞争、夺财、冲动决策和资源消耗感更强。`,
          members: [dayMaster.value, flowStem]
        },
        [
          { dimension: "overall", delta: -1, message: `${levelLabel}劫财偏重，阶段更像强竞争和高消耗并存。` },
          { dimension: "wealth", delta: -2, message: `${levelLabel}劫财对应资源争夺，财务上要防支出失控或被分流。` },
          { dimension: "relationships", delta: -1, message: `${levelLabel}劫财阶段更容易因边界与利益问题产生摩擦。` }
        ]
      );
      break;
  }

  const stemInteraction = getElementInteraction(dayMaster.element, STEM_META[flowStem].element);
  switch (stemInteraction) {
    case "generated-by":
      registerSignal(
        {
          category: "element",
          type: "生我",
          tone: "supportive",
          description: `${levelLabel}天干${flowStem}五行对日主形成“生我”关系。`,
          members: [dayMaster.value, flowStem]
        },
        [
          { dimension: "overall", delta: 1, message: `${levelLabel}天干生扶日主，阶段支持度更高。` },
          { dimension: "career", delta: 1, message: `${levelLabel}有外部支持或资源补给，更利于稳中推进。` },
          { dimension: "health", delta: 1, message: `${levelLabel}生扶关系有利于恢复与续航。` }
        ]
      );
      break;
    case "generate":
      registerSignal(
        {
          category: "element",
          type: "我生",
          tone: "mixed",
          description: `${levelLabel}天干${flowStem}五行对日主形成“我生”关系。`,
          members: [dayMaster.value, flowStem]
        },
        [
          { dimension: "overall", delta: 0, message: `${levelLabel}以输出换结果，收获与消耗会并行出现。` },
          { dimension: "career", delta: 1, message: `${levelLabel}更适合把想法、作品或表达推到台前。` },
          { dimension: "health", delta: -1, message: `${levelLabel}输出过度时要防精力被持续抽走。` }
        ]
      );
      break;
    case "control":
      registerSignal(
        {
          category: "element",
          type: "我克",
          tone: "mixed",
          description: `${levelLabel}天干${flowStem}五行对日主形成“我克”关系。`,
          members: [dayMaster.value, flowStem]
        },
        [
          { dimension: "overall", delta: 0, message: `${levelLabel}更像主动拿结果的阶段，但也需要消耗换取。` },
          { dimension: "wealth", delta: 1, message: `${levelLabel}我克为财，财务与资源主题更容易被拉出来处理。` }
        ]
      );
      break;
    case "controlled-by":
      registerSignal(
        {
          category: "element",
          type: "克我",
          tone: "challenging",
          description: `${levelLabel}天干${flowStem}五行对日主形成“克我”关系。`,
          members: [dayMaster.value, flowStem]
        },
        [
          { dimension: "overall", delta: -1, message: `${levelLabel}克我之力增强，阶段压力和被要求感更明显。` },
          { dimension: "health", delta: -1, message: `${levelLabel}克我过强时，更要防疲劳、焦虑和恢复不足。` }
        ]
      );
      break;
    case "same":
      registerSignal(
        {
          category: "element",
          type: "同气",
          tone: "mixed",
          description: `${levelLabel}天干${flowStem}与日主同气，同类力量增强。`,
          members: [dayMaster.value, flowStem]
        },
        [
          { dimension: "overall", delta: 0, message: `${levelLabel}同气增强，自我意志与同类能量都会抬头。` }
        ]
      );
      break;
  }

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
        { dimension: "health", delta: -1, message: `${levelLabel}地支之气对日主形成压力，体感波动更值得留神。` },
        { dimension: "overall", delta: -1, message: `${levelLabel}地支层面的压力更偏底层和环境式。` }
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
        { dimension: "overall", delta: 1, message: `${levelLabel}地支生扶日主，底层环境更容易出现托举。` },
        { dimension: "health", delta: 1, message: `${levelLabel}地支生扶有利于状态回暖和恢复节律。` }
      ]
    );
  }

  for (const natalBranch of natalBranches) {
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
          { dimension: "overall", delta: 1, message: `${levelLabel}地支有合，事情更容易被牵动、撮合或整合。` },
          { dimension: "relationships", delta: 2, message: `${levelLabel}六合信号增强，关系互动和协商空间更大。` },
          { dimension: "wealth", delta: 1, message: `${levelLabel}六合也利于合作、撮合资源与交易达成。` }
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
          { dimension: "overall", delta: -1, message: `${levelLabel}地支逢冲，阶段更容易出现变动、对冲和突发调整。` },
          { dimension: "health", delta: -1, message: `${levelLabel}六冲也容易带来节律打乱、奔波或身心紧张。` },
          ...(natalDayBranch === natalBranch
            ? [
                {
                  dimension: "relationships" as const,
                  delta: -2,
                  message: `${levelLabel}冲到日支，关系与亲密互动的波动会更明显。`
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
          { dimension: "overall", delta: -1, message: `${levelLabel}六害偏向暗耗和不顺，很多问题会慢慢显形。` },
          { dimension: "relationships", delta: -1, message: `${levelLabel}六害常对应误解、别扭或暗中消耗。` },
          { dimension: "health", delta: -1, message: `${levelLabel}六害阶段也要防止情绪郁结转成体感问题。` }
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
          { dimension: "overall", delta: -1, message: `${levelLabel}刑象增强，阶段更容易出现拧巴、反复或内耗。` },
          { dimension: "relationships", delta: -1, message: `${levelLabel}相刑更需要处理边界、情绪和语言方式。` },
          { dimension: "health", delta: -2, message: `${levelLabel}刑象较重时，要重点看压力累积和身体警讯。` }
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
        { dimension: "career", delta: 1, message: `${levelLabel}${triple.type}成局时，事业推进往往更有整体联动感。` },
        { dimension: "relationships", delta: 1, message: `${levelLabel}${triple.type}也会放大人际与关系联结。` },
        { dimension: "wealth", delta: 1, message: `${levelLabel}${triple.type}利于资源会聚与结果聚焦。` }
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
                message: "流年与所属大运同频，阶段主题更容易被持续放大。"
              },
              {
                dimension: "career",
                delta: 1,
                message: "流年与大运相合时，事业节奏更容易连成线。"
              }
            ]
          : [
              {
                dimension: "overall",
                delta: -1,
                message: "流年与所属大运有对冲，阶段主题会更容易出现转折和波动。"
              },
              {
                dimension: "health",
                delta: -1,
                message: "流年与大运冲刑时，身心承压感通常更直观。"
              }
            ]
      );
    }
  }

  // v2 身旺身弱校正：调整整体分数
  const flowStemElement = STEM_META[flowStem].element;
  const stemInteractionType = getElementInteraction(dayMaster.element, flowStemElement);
  if (isStrong) {
    if (stemInteractionType === "generated-by") {
      state.overall.score -= 2;
      if (!state.overall.messages.some(m => m.includes("身旺忌印"))) {
        state.overall.messages.push(`身旺忌印——${levelLabel}天干${flowStem}印星生身反为忌，不宜过度依赖外部支持。`);
      }
    } else if (stemInteractionType === "same") {
      state.overall.score -= 2;
      if (!state.overall.messages.some(m => m.includes("身旺忌比"))) {
        state.overall.messages.push(`身旺忌比——${levelLabel}天干${flowStem}比劫帮身过旺，竞争加剧、破财风险增加。`);
      }
    } else if (stemInteractionType === "generate") {
      state.overall.score += 1;
    } else if (stemInteractionType === "control") {
      state.overall.score += 1;
    }
  } else {
    if (stemInteractionType === "generated-by" || stemInteractionType === "same") {
      state.overall.score += 1;
    } else if (stemInteractionType === "control" || stemInteractionType === "generate") {
      state.overall.score -= 1;
    }
  }

  const summaries = FLOW_DIMENSIONS.reduce<FlowAnalysis>(
    (accumulator, dimension) => {
      const messages =
        state[dimension].messages.length > 0
          ? state[dimension].messages
          : [FLOW_FALLBACK[dimension]];
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
