import { HIDDEN_STEM_WEIGHTS, STEM_META, computeTenGod } from "./constants";
import { CONTROLLING, GENERATING, reverseControlling, reverseGenerating } from "./scoring";
import type { Element, PatternAssessment, PatternCategory, PillarDetails, StrengthAssessment } from "./types";

const PATTERN_NAME_MAP: Record<string, string> = {
  正官: "正官格",
  七杀: "七杀格",
  正财: "正财格",
  偏财: "偏财格",
  正印: "正印格",
  偏印: "偏印格",
  食神: "食神格",
  伤官: "伤官格",
  比肩: "建禄格",
  劫财: "羊刃格"
};

/** 十天干临官（禄）之地：日主本气得禄的地支。 */
const LU_BRANCH: Record<string, string> = {
  甲: "寅", 乙: "卯", 丙: "巳", 丁: "午", 戊: "巳", 己: "午", 庚: "申", 辛: "酉", 壬: "亥", 癸: "子"
};

/** 十天干帝旺（刃）之地：日主本气最旺的地支，阳干专论羊刃，阴干习惯上称“禄之极”一并纳入判断。 */
const YANG_REN_BRANCH: Record<string, string> = {
  甲: "卯", 乙: "寅", 丙: "午", 丁: "巳", 戊: "午", 己: "巳", 庚: "酉", 辛: "申", 壬: "子", 癸: "亥"
};

/** 十神取格的优先级：官杀 > 财 > 印 > 食伤，比劫殿后（比劫另循建禄/羊刃处理） */
const TEN_GOD_PRIORITY: Record<string, number> = {
  七杀: 1,
  正官: 1,
  正财: 2,
  偏财: 2,
  正印: 3,
  偏印: 3,
  食神: 4,
  伤官: 4,
  比肩: 5,
  劫财: 5
};

/**
 * 格局判定：以月令藏干为纲。月令本气（权重最大的藏干）若非比肩/劫财，直接以本气定格
 * （无论是否透干）；仅当本气恰为比肩/劫财（帮身之物不能自身成格）时，才退而在中气、余气
 * 范围内择优（透干优先，同等透干情况按官杀>财>印>食伤的十神优先级取舍）。
 * 月支恰为日主禄地/刃地的特殊情形单独归为建禄格/羊刃格。随后结合旺衰评估，
 * 判断是否满足从强、从弱等变格条件，变格条件成立时优先采用变格。
 */
export function determinePattern(
  pillars: PillarDetails[],
  strength: StrengthAssessment
): PatternAssessment {
  const dayPillar = pillars.find((pillar) => pillar.key === "day")!;
  const monthPillar = pillars.find((pillar) => pillar.key === "month")!;
  const dayStem = dayPillar.stem.value;
  const dayElement = STEM_META[dayStem].element;
  const monthBranch = monthPillar.branch.value;
  const monthHiddenStems = Object.keys(HIDDEN_STEM_WEIGHTS[monthBranch] ?? {});
  const allStems = pillars.map((pillar) => pillar.stem.value);

  let name: string;
  let category: PatternCategory = "正格";
  const reasons: string[] = [];
  let governingStem: string;
  let governingTenGod: string;
  let isRevealed: boolean;

  // 建禄格/羊刃格：月支恰为日主本气临官（禄）或帝旺（刃）之地时，月令本气即为比肩/劫财，
  // 不能像其他十神一样直接取格，故单独命名，判定标准以月支为准，不依赖旺衰是否达到极端变格程度。
  if (monthBranch === LU_BRANCH[dayStem]) {
    name = "建禄格";
    governingStem = dayStem;
    governingTenGod = "比肩";
    isRevealed = true;
    reasons.push(`月支${monthBranch}为日主${dayStem}临官禄地，月令本气即为比肩，归建禄格。`);
  } else if (monthBranch === YANG_REN_BRANCH[dayStem]) {
    name = "羊刃格";
    governingStem = dayStem;
    governingTenGod = "劫财";
    isRevealed = true;
    reasons.push(`月支${monthBranch}为日主${dayStem}帝旺刃地，月令本气即为劫财，归羊刃格。`);
  } else {
    const allCandidates = monthHiddenStems.map((stem) => ({
      stem,
      tenGod: computeTenGod(dayStem, stem),
      weight: HIDDEN_STEM_WEIGHTS[monthBranch][stem],
      revealed: allStems.includes(stem)
    }));

    // 月令本气（权重最大的藏干）是格局判定的主体：只要本气不是比肩/劫财（帮身之物无法自身成格），
    // 就应直接以本气定格，不与权重远小的中气、余气比较十神优先级——
    // 否则会出现杂气月（辰戌丑未）本气为比肩/劫财时才需要的"舍本气取余气"逻辑，
    // 被错误地套用到本气并非比肩/劫财的场合，导致权重占绝对主导的本气被权重很小的中余气反超定格。
    const dominant = allCandidates.reduce((a, b) => (b.weight > a.weight ? b : a));

    let best: typeof allCandidates[number];
    if (dominant.tenGod !== "比肩" && dominant.tenGod !== "劫财") {
      best = dominant;
    } else {
      // 本气为比肩/劫财，帮身不能自身成格，退而在中气、余气范围内择优（透干优先，同等透干情况下按十神优先级、权重取舍）。
      const secondary = allCandidates.filter((candidate) => candidate.stem !== dominant.stem);
      const pool = secondary.length > 0 ? secondary : allCandidates;
      const revealedPool = pool.filter((candidate) => candidate.revealed);
      const finalPool = revealedPool.length > 0 ? revealedPool : pool;
      finalPool.sort((a, b) => {
        const priorityDiff = (TEN_GOD_PRIORITY[a.tenGod] ?? 99) - (TEN_GOD_PRIORITY[b.tenGod] ?? 99);
        if (priorityDiff !== 0) return priorityDiff;
        return b.weight - a.weight;
      });
      best = finalPool[0] ?? dominant;
    }

    name = PATTERN_NAME_MAP[best.tenGod] ?? "杂气格";
    governingStem = best.stem;
    governingTenGod = best.tenGod;
    isRevealed = best.revealed;

    reasons.push(
      best.stem === dominant.stem
        ? `月令${monthBranch}藏干${best.stem}（${best.tenGod}）为本气，${best.revealed ? "且透出天干，格局清纯" : "未透天干，以本气定格"}。`
        : `月令${monthBranch}本气${dominant.stem}（${dominant.tenGod}）帮身不能自成格局，改取${best.revealed ? "透干" : "未透"}的${best.stem}（${best.tenGod}）定格。`
    );

    // 伤官格细分：有官杀制衡则为“有制”，官杀伤尽则为“伤尽”
    if (name === "伤官格") {
      const hasOfficer = allStems.some((stem) => {
        const tenGod = computeTenGod(dayStem, stem);
        return tenGod === "正官" || tenGod === "七杀";
      });
      name = hasOfficer ? "伤官格（有制）" : "伤官格（伤尽）";
    }
  }

  // 变格判定：仅在扶抑评估达到身旺/身极弱等极端状态时才考虑，避免中和命局被误判为变格
  const variant = checkVariantPattern(pillars, dayElement, strength);
  if (variant) {
    name = variant.name;
    category = "变格";
    reasons.push(variant.reason);
    // 变格覆盖 governingTenGod/governingStem：变格名称已不再以月令本气为纲，
    // 而是以主导命局走势的旺神为纲。若仍保留月令本气的十神，会导致 overview 出现
    // "以正财为纲"/"以食神为纲"等与"从杀格"/"从强格"实质矛盾的叙述。
    // 注意：governingStem 标记为 dayStem 仅为占位，因为变格中真正的纲领是五行类别
    // 而非某根具体天干；isRevealed 改为 true 因为变格的判定已明确旺神存在。
    switch (variant.name) {
      case "从强格":
        // 从强格以日主同气及印星为用，纲领即日主自身
        governingTenGod = "比肩";
        governingStem = dayStem;
        break;
      case "从财格":
        // 从财格以财星为纲，找命局中力量最强的财星天干（透出优先）
        {
          const caiStems = pillars
            .map(p => p.stem.value)
            .filter(s => { const tg = computeTenGod(dayStem, s); return tg === "正财" || tg === "偏财"; });
          if (caiStems.length > 0) {
            governingStem = caiStems[0];
            governingTenGod = computeTenGod(dayStem, governingStem);
          } else {
            governingTenGod = "正财";
          }
        }
        break;
      case "从杀格":
        // 从杀格以官杀为纲，找命局中力量最强的官杀天干（透出优先）
        {
          const shaStems = pillars
            .map(p => p.stem.value)
            .filter(s => { const tg = computeTenGod(dayStem, s); return tg === "正官" || tg === "七杀"; });
          if (shaStems.length > 0) {
            governingStem = shaStems[0];
            governingTenGod = computeTenGod(dayStem, governingStem);
          } else {
            governingTenGod = "七杀";
          }
        }
        break;
      case "从儿格":
        // 从儿格以食伤为纲，找命局中力量最强的食伤天干（透出优先）
        {
          const shiStems = pillars
            .map(p => p.stem.value)
            .filter(s => { const tg = computeTenGod(dayStem, s); return tg === "食神" || tg === "伤官"; });
          if (shiStems.length > 0) {
            governingStem = shiStems[0];
            governingTenGod = computeTenGod(dayStem, governingStem);
          } else {
            governingTenGod = "食神";
          }
        }
        break;
    }
    isRevealed = true;
  }

  const outcome = evaluatePatternOutcome(pillars, name, dayStem, allStems);

  return {
    name,
    category,
    governingStem,
    governingTenGod,
    isRevealed,
    outcome: outcome.outcome,
    reasons: [...reasons, ...outcome.reasons]
  };
}

function checkVariantPattern(
  pillars: PillarDetails[],
  dayElement: Element,
  strength: StrengthAssessment
): { name: string; reason: string } | null {
  const dayPillar = pillars.find((pillar) => pillar.key === "day")!;
  const dayStem = dayPillar.stem.value;

  const counts: Record<Element, number> = { "木": 0, "火": 0, "土": 0, "金": 0, "水": 0 };
  for (const pillar of pillars) {
    counts[pillar.stem.element] += 5;
    const weights = HIDDEN_STEM_WEIGHTS[pillar.branch.value];
    if (!weights) continue;
    for (const [stem, weight] of Object.entries(weights)) {
      counts[STEM_META[stem].element] += weight;
    }
  }

  // 五行方向说明：supportElement=印星(生我)；drainingElement=食伤(我生)；
  // controllingElement=官杀(克我)；wealthElement=财星(我克)。四者互不相同。
  const supportElement = GENERATING[dayElement];
  const drainingElement = reverseGenerating(dayElement);
  const controllingElement = reverseControlling(dayElement);
  const wealthElement = CONTROLLING[dayElement];

  const supportTotal = counts[dayElement] + (supportElement ? counts[supportElement] : 0);
  const controlAndDrain = counts[controllingElement] + counts[wealthElement] + counts[drainingElement];

  // 从强格 / 专旺格：日主身旺，且克泄耗力量极弱。
  // 注：建禄格/羊刃格已在主流程中依据月支单独判定，此处不再重复处理日支禄刃，
  // 避免与月支取格逻辑冲突（同一命局的月支、日支禄刃归属可能不同）。
  // 阈值说明：经批量统计验证（1950-2030年遍历抽样，身旺样本n=1351），
  // supportTotal>22 在身旺样本中已接近全员满足（区分度低但保留以维持语义完整），
  // 真正的判别瓶颈在 controlAndDrain；原 <6 命中率仅1.3%，与其余三种从格量级严重失衡，
  // 调整为 <10（命中率约5.4%），使四种从格判定标准的严格程度彼此协调。
  if (strength.level === "身旺" && controlAndDrain < 10 && supportTotal > 22) {
    return { name: "从强格", reason: "日主得势且生扶之力独旺，克泄耗几无立足之地，从其旺势而定为从强格。" };
  }

  // 从财格：财星极旺，日主克泄耗齐弱
  // 阈值说明：批量统计显示 supportTotal<12 与 wealth>18 联合命中率仅4.0%，
  // 明显偏严；supportTotal 放宽至 <14 后联合命中率约7.6%，与其余从格量级一致。
  if ((strength.level === "身弱" || strength.level === "身极弱") && counts[wealthElement] > 18 && supportTotal < 14) {
    return { name: "从财格", reason: "财星独旺而日主生扶之力微弱，命局无力与财相抗，从其财势而定为从财格。" };
  }

  // 从杀格：官杀极旺，日主克泄耗齐弱
  // 阈值说明：同上方法论，supportTotal<12 时联合命中率仅4.75%，放宽至 <14 后约9.1%。
  if ((strength.level === "身弱" || strength.level === "身极弱") && counts[controllingElement] > 14 && supportTotal < 14) {
    return { name: "从杀格", reason: "官杀独旺而日主生扶之力微弱，命局无力与杀相抗，从其杀势而定为从杀格。" };
  }

  // 从儿格（从食伤格）：食伤极旺，日主生扶之力弱
  // 阈值说明：同上方法论，supportTotal<14 时联合命中率仅4.6%，放宽至 <16 后约8.2%。
  if ((strength.level === "身弱" || strength.level === "身极弱") && counts[drainingElement] > 16 && supportTotal < 16) {
    return { name: "从儿格", reason: "食伤独旺而日主生扶之力微弱，命局顺食伤之势外泄，从其秀气而定为从儿格。" };
  }

  return null;
}

function evaluatePatternOutcome(
  pillars: PillarDetails[],
  patternName: string,
  dayStem: string,
  allStems: string[]
): { outcome: PatternAssessment["outcome"]; reasons: string[] } {
  const reasons: string[] = [];

  // 正官格破格（依《子平真诠》"官格最怕伤官"）：
  // 伤官见正官为最重破格；有印化解则伤官之锐被疏导，官星得保。
  // 正官格另一常见问题：官杀混杂（正官格中七杀也出现），使官星权威受损，品质降低。
  if (patternName.includes("正官格")) {
    const hasShangGuan = allStems.some((stem) => computeTenGod(dayStem, stem) === "伤官");
    const hasYin = allStems.some((stem) => {
      const tenGod = computeTenGod(dayStem, stem);
      return tenGod === "正印" || tenGod === "偏印";
    });
    const hasQiSha = allStems.some((stem) => computeTenGod(dayStem, stem) === "七杀");
    if (hasShangGuan && hasYin) {
      reasons.push("局中伤官透出但有印星化解，官星得以保全，属成格之象。");
      return { outcome: "成格", reasons };
    }
    if (hasShangGuan) {
      // 依据：《子平真诠》"正官格最忌伤官，伤官见官为祸百端；有印化解则救，无印则破"
      reasons.push("局中伤官透出且无印星化解，伤官见官之象，破格风险高，需大运补救。");
      return { outcome: "败格", reasons };
    }
    if (hasQiSha) {
      // 依据：《子平真诠》"正官格忌官杀混杂，混则官失权威，品格降低；合杀留官或去杀留官方可救解"
      reasons.push("局中官杀混杂（七杀透出），正官权威受损，格局品质下降，宜大运合杀或制杀以救格。");
      return { outcome: "败格", reasons };
    }
  }

  // 七杀格破格（依《子平真诠》"七杀格，有制者贵，无制者贱"）：
  // 七杀与正官格核心差异：七杀格需要有制化（食神/印星制杀），无制则格局贱劣；
  // 而伤官虽克官，对七杀格而言食神制杀本是格局的核心用神，不构成破格。
  // 七杀格主要破格情形：
  // 1. 官杀混杂（正官也出现在七杀格中）：杀被官混，反而两难，合官留杀或去官留杀方可救；
  // 2. 七杀无制（无食神/印星制化）：杀旺无制，凶暴难驭；
  // 3. 伤官本是七杀格的克星，但七杀格本身重制化，需区分是食神制杀（格局的用法）vs 伤官乱入。
  if (patternName.includes("七杀格")) {
    const hasShiShen = allStems.some((stem) => computeTenGod(dayStem, stem) === "食神");
    const hasYin = allStems.some((stem) => {
      const tenGod = computeTenGod(dayStem, stem);
      return tenGod === "正印" || tenGod === "偏印";
    });
    const hasZhengGuan = allStems.some((stem) => computeTenGod(dayStem, stem) === "正官");
    // 官杀混杂：七杀格中正官透出，官杀相混，格局混浊
    // 依据：《子平真诠》"七杀格，见正官则官杀混杂，格局大减；合官留杀或去官留杀方为救应"
    if (hasZhengGuan) {
      reasons.push("局中官杀混杂（正官透入七杀格），格局混浊，七杀之权被正官分散，需大运合官留杀或制官留杀以救格。");
      return { outcome: "败格", reasons };
    }
    // 七杀有制：食神制杀或印星化杀，均为有力制化
    // 依据：《子平真诠》"七杀格，有制者贵；食神制杀为上，印星化杀次之"
    if (hasShiShen) {
      reasons.push("局中食神透出，食神制杀得法，七杀之威得以疏导，属成格之象（以制为贵）。");
      return { outcome: "成格", reasons };
    }
    if (hasYin) {
      reasons.push("局中印星透出，化杀生身，七杀之威转为己用，属成格之象（以化为贵）。");
      return { outcome: "成格", reasons };
    }
    // 七杀无制：杀旺无食神/印星制化，格局凶烈
    // 依据：《子平真诠》"七杀无制，最为下格；身强尚可扛杀，身弱则祸患难免"
    reasons.push("局中七杀旺而无食神制杀、无印星化杀，七杀无制之象，格局品质偏低，需大运引入制化之神救格。");
    return { outcome: "败格", reasons };
  }

  if (patternName.includes("正财格") || patternName.includes("偏财格")) {
    const hasJieCai = allStems.some((stem) => computeTenGod(dayStem, stem) === "劫财");
    if (hasJieCai) {
      reasons.push("局中劫财透出，财星易被分夺，需留意破格风险。");
      return { outcome: "败格", reasons };
    }
  }

  if (patternName.includes("正印格") || patternName.includes("偏印格")) {
    const hasCaiXing = allStems.some((stem) => {
      const tenGod = computeTenGod(dayStem, stem);
      return tenGod === "正财" || tenGod === "偏财";
    });
    if (hasCaiXing) {
      reasons.push("局中财星透出，印星受克，需留意财星破印的风险。");
      return { outcome: "败格", reasons };
    }
  }

  // 食神格破格条件（依《子平真诠》）：
  // 1. 枭神夺食（偏印透出抑制食神）为最重之病，无财星解救则破格；
  // 2. 官杀透出为次患，食神以制杀为功，但官杀过重则制不住，反为财官双病。
  if (patternName === "食神格") {
    const hasPianYin = allStems.some((stem) => computeTenGod(dayStem, stem) === "偏印");
    const hasCai = allStems.some((stem) => {
      const tenGod = computeTenGod(dayStem, stem);
      return tenGod === "正财" || tenGod === "偏财";
    });
    if (hasPianYin && !hasCai) {
      // 枭神夺食且无财星救应：偏印压制食神，又无财星制住偏印
      // 依据：《子平真诠》"食神喜生财，怕枭印夺食；枭印劫财，皆食神之忌"
      reasons.push("局中偏印（枭神）透出且无财星制枭，食神受压，枭神夺食之象，需留意破格风险。");
      return { outcome: "败格", reasons };
    }
    if (hasPianYin && hasCai) {
      // 枭神夺食但有财星制枭：财克偏印，化解枭神之患，食神得保
      // 依据：《子平真诠》"食神逢枭，得财制枭，食神复活，此为救应"
      reasons.push("局中偏印透出但有财星制枭，食神得以保全，属成格之象。");
      return { outcome: "成格", reasons };
    }
    const hasOfficerOrKill = allStems.some((stem) => {
      const tenGod = computeTenGod(dayStem, stem);
      return tenGod === "正官" || tenGod === "七杀";
    });
    if (hasOfficerOrKill) {
      // 食神格中透出官杀：食神以制杀为功，七杀可制为用，但正官入食神格常属赘物
      // 依据：《子平真诠》"食神格，透杀则以食制杀为贵；若正官入局，食神见官则混杂"
      reasons.push("局中官杀透出，食神格中七杀可借食神制化，需结合旺衰判断是否制化有力。");
      // 不直接判败格，留待后续结合大运验证
    }
  }

  // 伤官格破格条件（依《子平真诠》）：
  // 伤官格最畏见正官（"伤官见官，祸患百端"），有印星化解则可救；
  // 伤官佩印、伤官配财各有格局，但若正官透而无印，则为败格。
  // 注意：patternName 已被细化为"伤官格（有制）"/"伤官格（伤尽）"，需用 includes 匹配
  if (patternName.includes("伤官格")) {
    const hasZhengGuan = allStems.some((stem) => computeTenGod(dayStem, stem) === "正官");
    const hasYin = allStems.some((stem) => {
      const tenGod = computeTenGod(dayStem, stem);
      return tenGod === "正印" || tenGod === "偏印";
    });
    if (hasZhengGuan && !hasYin) {
      // 伤官见正官且无印化解：伤官最忌正官，此为伤官见官最纯粹的破格形态
      // 依据：《子平真诠》"伤官见官，为祸百端；有印化解，尚可解救"
      reasons.push("局中正官透出且无印星化解，伤官见官之象，破格风险高，需大运补救。");
      return { outcome: "败格", reasons };
    }
    if (hasZhengGuan && hasYin) {
      // 伤官见官但有印化解：印绶化伤官之锐，使正官得保
      reasons.push("局中正官透出但有印星化解，伤官之锐得以疏导，官星得保，属成格之象。");
      return { outcome: "成格", reasons };
    }
    if (patternName === "伤官格（伤尽）") {
      // 伤尽无官：格局清纯，最宜走财运，财引食伤为用，前途通畅
      // 依据：《子平真诠》"伤官伤尽，最喜财星；无官可伤，以财为纲"
      reasons.push("伤官伤尽格，局中无官可伤，格局清纯，最宜财星相引，属成格之象。");
      return { outcome: "成格", reasons };
    }
  }

  if (patternName === "羊刃格") {
    const hasOfficer = allStems.some((stem) => {
      const tenGod = computeTenGod(dayStem, stem);
      return tenGod === "正官" || tenGod === "七杀";
    });
    if (hasOfficer) {
      reasons.push("局中官杀透出，恰能制衡羊刃之刚烈，刃有所制，属成格之象。");
      return { outcome: "成格", reasons };
    }
    reasons.push("局中未见官杀制刃，羊刃过旺无所约束，需留意刚烈冲动、破财争讼的风险。");
    return { outcome: "败格", reasons };
  }

  if (patternName === "建禄格") {
    const hasWealthOrOfficer = allStems.some((stem) => {
      const tenGod = computeTenGod(dayStem, stem);
      return tenGod === "正财" || tenGod === "偏财" || tenGod === "正官" || tenGod === "七杀";
    });
    if (hasWealthOrOfficer) {
      reasons.push("局中财官透出，建禄之比劫得以转化为可用之力，属成格之象。");
      return { outcome: "成格", reasons };
    }
    reasons.push("局中财官皆不透，建禄比劫虽帮身却缺乏施展方向，格局清而不透，力量偏于内耗。");
    return { outcome: "成格", reasons };
  }

  reasons.push("未见明显破格信号，格局暂可视为成格，具体仍需结合大运流年综合验证。");
  return { outcome: "成格", reasons };
}
