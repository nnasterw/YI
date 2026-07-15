import { HIDDEN_STEM_WEIGHTS, STEM_META, computeTenGod } from "./constants";
import { CONTROLLING, GENERATING, reverseControlling, reverseGenerating } from "./scoring";
import type {
  Element,
  PatternAssessment,
  PillarDetails,
  StrengthAssessment,
  YongShenAssessment,
  YongShenMethodName,
  YongShenMethodResult
} from "./types";

/** 扶抑法：身强者以克泄耗为用，身弱者以生扶为用 */
function selectByFuYi(dayElement: Element, strength: StrengthAssessment): YongShenMethodResult {
  if (strength.level === "身旺" || strength.level === "身强") {
    const controlling = reverseControlling(dayElement); // 官杀：克我者
    const draining = reverseGenerating(dayElement); // 食伤：我生者
    return {
      method: "扶抑",
      elements: [controlling, draining],
      reason: `日主${strength.level}，宜以克耗之${controlling}、泄秀之${draining}为用，抑其太过。`
    };
  }
  if (strength.level === "身弱" || strength.level === "身极弱") {
    const supporting = GENERATING[dayElement]; // 印星：生我者
    return {
      method: "扶抑",
      elements: [supporting, dayElement],
      reason: `日主${strength.level}，宜以生扶之${supporting}、同气之${dayElement}为用，扶其不足。`
    };
  }
  // level==="中和"时，三诀细判扶抵大致相当，但 supportRatio 仍会略偏一侧——
  // strength.isStrong 已经用 supportRatio>=0.5 对中和态做了偏强/偏弱的二次区分
  // （见 scoring.ts）。此前这里无论中和偏强偏弱，一律取"同气五行"（比劫）为参考
  // 用神，若中和实际偏强（isStrong=true），会与"身强当忌比劫、喜克泄耗"的扶抑
  // 大原则自相矛盾——用户能同时看到 isStrong=身强定性、却被推荐比劫为最喜用神。
  // 中和偏强复用身强分支的克泄耗结论，偏弱复用身弱分支的生扶结论，仅措辞标注为
  // "中和偏强/中和偏弱"以区别于真正的身旺/身强/身弱/身极弱。
  if (strength.isStrong) {
    const controlling = reverseControlling(dayElement);
    const draining = reverseGenerating(dayElement);
    return {
      method: "扶抑",
      elements: [controlling, draining],
      reason: `日主中和偏强（扶抵占比${Math.round(strength.supportRatio * 100)}%），宜以克耗之${controlling}、泄秀之${draining}为用，抑其偏盛。`
    };
  }
  const supporting = GENERATING[dayElement];
  return {
    method: "扶抑",
    elements: [supporting, dayElement],
    reason: `日主中和偏弱（扶抵占比${Math.round(strength.supportRatio * 100)}%），宜以生扶之${supporting}、同气之${dayElement}为用，扶其偏虚。`
  };
}

/**
 * 病药法：命局某一类十神过重成病，取其克制或化解之神为药。
 *
 * 关键前提：“过重成病”本身是相对于日主整体旺衰而言的结构性失衡，而非孤立的十神
 * 计数问题。比劫、食伤对日主是帮扶/泄秀之神，只有当日主本已偏强（身旺/身强）、
 * 帮扶或泄秀之力过剩到反而壅塞流通时，才谈得上“重重成病”，需取克泄之神为药；
 * 若日主本已身弱甚至身极弱，比劫、食伤恰是其赖以扶持、尚且不足的力量，不能反过来
 * 当作病灶克制或耗泄，否则会与扶抑法“身弱喜印比、忌财官食伤”的结论正面冲突。
 * 官杀混杂克身则不同：无论日主强弱，官杀相杂本身都是需要印星化解通关的结构性
 * 问题（身强印星顺势化杀护身，身弱印星本就是扶身用神，取印方向不受强弱影响），
 * 因此保留不设强弱前置条件。
 */
function selectByBingYao(
  pillars: PillarDetails[],
  dayElement: Element,
  strength: StrengthAssessment
): YongShenMethodResult | null {
  const dayStem = pillars.find((pillar) => pillar.key === "day")!.stem.value;
  const allStems = pillars.map((pillar) => pillar.stem.value);
  // 用 strength.isStrong（已含中和态按 supportRatio 的偏强/偏弱二次区分，见
  // scoring.ts）而非仅比较 level 是否为"身旺/身强"：否则中和偏强命局即使比劫、
  // 食伤同样过重成病，也会被这里判定为不满足病药条件，与 selectByFuYi 扶抑法
  // 对中和偏强命局"当忌比劫、当克食伤"的结论互相矛盾。
  const isStrong = strength.isStrong;

  const officerCount = allStems.filter((stem) => {
    const tenGod = computeTenGod(dayStem, stem);
    return tenGod === "正官" || tenGod === "七杀";
  }).length;
  const peerCount = allStems.filter((stem) => {
    const tenGod = computeTenGod(dayStem, stem);
    return tenGod === "比肩" || tenGod === "劫财";
  }).length;
  const outputCount = allStems.filter((stem) => {
    const tenGod = computeTenGod(dayStem, stem);
    return tenGod === "食神" || tenGod === "伤官";
  }).length;

  if (officerCount >= 2) {
    const cure = GENERATING[dayElement]; // 印星：生我者，化杀生身
    return {
      method: "病药",
      elements: [cure],
      reason: `官杀混杂为局中之病（${officerCount}位），宜取印星${cure}化杀生身以为药。`
    };
  }
  if (peerCount >= 2 && isStrong) {
    const cure = reverseControlling(dayElement); // 官杀：克我者，克制比劫
    return {
      method: "病药",
      elements: [cure],
      reason: `日主${strength.level}而比劫重重为局中之病（${peerCount}位），宜取官杀${cure}克制比劫以为药。`
    };
  }
  if (outputCount >= 2 && isStrong) {
    const cure = GENERATING[dayElement]; // 印星：生我者，制伏食伤
    return {
      method: "病药",
      elements: [cure],
      reason: `日主${strength.level}而食伤过旺为局中之病（${outputCount}位），宜取印星${cure}制伏食伤以为药。`
    };
  }
  return null;
}

/** 调候法：以月支寒暖燥湿判断是否需要专门的水火来调和气候 */
function selectByTiaoHou(monthBranch: string): YongShenMethodResult | null {
  const summerBranches = ["巳", "午", "未"];
  const winterBranches = ["亥", "子", "丑"];

  if (summerBranches.includes(monthBranch)) {
    return {
      method: "调候",
      elements: ["水"],
      reason: `生于${monthBranch}月，火气当令炎燥，宜取水润泽调候。`
    };
  }
  if (winterBranches.includes(monthBranch)) {
    return {
      method: "调候",
      elements: ["火"],
      reason: `生于${monthBranch}月，水气当令寒凝，宜取火温暖调候。`
    };
  }
  return null;
}

/** 通关法：两行力量相当且彼此相克对峙时，取居间通关之神化解僵局 */
function selectByTongGuan(counts: Record<Element, number>): YongShenMethodResult | null {
  // pairs 中的 [a, b] 均满足 CONTROLLING[a] === b，即 a 克 b，两者相战对峙
  const pairs: Array<[Element, Element]> = [
    ["木", "土"],
    ["火", "金"],
    ["土", "水"],
    ["金", "木"],
    ["水", "火"]
  ];

  for (const [a, b] of pairs) {
    if (counts[a] > 8 && counts[b] > 8) {
      // 通关之神：由施克方(a)所生、又能反过来生被克方(b)的过渡五行
      const bridge = reverseGenerating(a);
      return {
        method: "通关",
        elements: [bridge],
        reason: `局中${a}与${b}两气对峙相战，宜取${bridge}为通关之神，化其相克为相生。`
      };
    }
  }
  return null;
}

/**
 * 用神综合评估：四法合参，优先级为 病药 > 调候 > 通关 > 扶抑。
 * 这一优先级顺序反映了命理分析中的常见取用思路——先解命局明显的结构性病灶，
 * 再看气候是否失衡，再看两行是否对峙需要通关，最后才回到常规的扶抑判断兜底。
 */
export function assessYongShen(
  pillars: PillarDetails[],
  dayElement: Element,
  strength: StrengthAssessment,
  pattern?: PatternAssessment
): YongShenAssessment {
  const monthBranch = pillars.find((pillar) => pillar.key === "month")!.branch.value;

  const counts: Record<Element, number> = { "木": 0, "火": 0, "土": 0, "金": 0, "水": 0 };
  for (const pillar of pillars) {
    counts[pillar.stem.element] += 5;
    const weights = HIDDEN_STEM_WEIGHTS[pillar.branch.value];
    if (!weights) continue;
    for (const [stem, weight] of Object.entries(weights)) {
      counts[STEM_META[stem].element] += weight;
    }
  }

  const fuyi = selectByFuYi(dayElement, strength);
  const bingyao = selectByBingYao(pillars, dayElement, strength);
  const tiaohou = selectByTiaoHou(monthBranch);
  const tongguan = selectByTongGuan(counts);

  const methods: YongShenMethodResult[] = [fuyi];
  if (bingyao) methods.unshift(bingyao);
  if (tongguan) methods.splice(bingyao ? 1 : 0, 0, tongguan);
  if (tiaohou) methods.splice(bingyao ? 1 : 0, 0, tiaohou);

  let primary: YongShenMethodResult;
  if (bingyao) {
    primary = bingyao;
  } else if (tiaohou) {
    primary = tiaohou;
  } else if (tongguan) {
    primary = tongguan;
  } else {
    primary = fuyi;
  }

  // 变格命局（从强/从财/从杀/从儿等）用神取用逻辑与正格相反：顺应旺神之势而不逆抑。
  // 一旦命中变格顺势，最终用神与正格扶抑/病药/调候/通关四法的结论在方向上通常
  // 直接相反（例如从杀格身弱却应"忌印比生扶日主"，与病药法"官杀混杂取印化杀"
  // 或扶抑法"身弱喜印比"正相反）。此前实现只覆盖了 yongShen 数组、追加一条
  // reasons，却仍把 primaryMethod/methods[0] 留在被覆盖的正格方法上，导致对外
  // 展示的"取用依据"（如"以病药法为主"）与实际生效的用神结论同屏矛盾。现改为
  // 命中变格时整体重构 primary 为专门的"顺势"方法，reasons 只保留最终定论，
  // 避免已被否定的正格推导过程和最终结论混在一起造成自相矛盾的展示。
  let yongShen = [...new Set(primary.elements)];
  const reasons = [primary.reason];

  // 注：建禄格/羊刃格在 determinePattern 中恒为 category="正格"（只有 checkVariantPattern
  // 命中从强/从财/从杀/从儿时才会把 name 覆盖为对应的"从X格"并置 category="变格"，
  // 建禄格/羊刃格的 name 不会与 category="变格" 同时出现），故以下分支只处理真正的从强格。
  if (pattern?.category === "变格") {
    let overrideReason: string | null = null;

    if (pattern.name === "从强格") {
      // 顺其旺势：取同气与印星（生我者）为用，不取克泄耗
      yongShen = [dayElement, GENERATING[dayElement]];
      overrideReason = `${pattern.name}日主气势独旺，宜顺其旺势，以同气及生扶之神为用，不宜逆抑。`;
    } else if (pattern.name === "从财格") {
      // 财星（我克者）+ 食伤（我生者，生财之神）
      const wealth = CONTROLLING[dayElement];
      const output = reverseGenerating(dayElement);
      yongShen = [wealth, output];
      overrideReason = "从财格宜顺从财星食伤之势为用，忌比劫印星逆势相争。";
    } else if (pattern.name === "从杀格") {
      // 官杀（克我者）
      const officer = reverseControlling(dayElement);
      yongShen = [officer];
      overrideReason = "从杀格宜顺从官杀之势为用，忌印比生扶日主与杀相争。";
    } else if (pattern.name === "从儿格") {
      // 食伤（我生者）+ 财星（我克者，食伤所生之神，顺势泄秀生财）
      const output = reverseGenerating(dayElement);
      const wealth = CONTROLLING[dayElement];
      yongShen = [output, wealth];
      overrideReason = "从儿格宜顺从食伤秀气之势为用，忌印星回克食伤。";
    }

    if (overrideReason) {
      const original = primary;
      primary = { method: "顺势", elements: [...yongShen], reason: overrideReason };
      reasons.length = 0;
      const originalReasonTrimmed = original.reason.replace(/。$/, "");
      reasons.push(
        overrideReason,
        `（若按正格常法（${original.method}）推导则为"${originalReasonTrimmed}"，但${pattern.name}顺势为准，不采此说。）`
      );
      // 变格顺势一旦成立，正格四法（病药/调候/通关/扶抑）的推导已被明确否定不采用，
      // methods 数组不应再保留它们——此前实现仅将 primary 顺势置于数组最前，
      // 被否定的旧方法结果仍残留在数组后段，任何直接遍历/展示 methods 全量的消费方，
      // 例如若未来网页端渲染候选方法列表，就会重新出现"顺势"与紧随其后的
      // "病药法：宜取印星化杀"同屏并存的矛盾。故此处清空后只保留顺势这一条，
      // 与 primaryMethod、reasons 三处口径彻底统一。
      methods.length = 0;
      methods.push(primary);
    }
  }

  // 喜神：生助用神（印星方向）或与用神同气的五行
  const xiShen = [...new Set(yongShen.flatMap((element) => [element, GENERATING[element]]))];
  // 忌神：克制用神的五行（官杀方向），排除已在用神/喜神之列者
  const jiShen = [...new Set(yongShen.map((element) => reverseControlling(element)))].filter(
    (element) => !yongShen.includes(element) && !xiShen.includes(element)
  );

  return {
    yongShen,
    xiShen,
    jiShen,
    primaryMethod: primary.method,
    methods,
    reasons
  };
}
