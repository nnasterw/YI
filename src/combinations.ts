import { STEM_META, computeTenGod, getElementInteraction } from "./constants";
import type { BaziProfile, Element, PillarDetails } from "./types";

export interface TenGodCombination {
  type: string;
  detected: boolean;
  strength: number;
  personality: string;
  career: string;
  relationship: string;
  risk: string;
}

export interface DayBranchAnalysis {
  branch: string;
  element: Element;
  diShi: string;
  isYangRen: boolean;
  hiddenTenGods: string[];
  spousePalace: string;
  innerWorld: string;
  clashRisk: string;
}

export interface ElementFlowChain {
  type: string;
  chain: string;
  description: string;
  isPositive: boolean;
}

export interface LuckCycleLayers {
  stemElement: Element;
  branchElement: Element;
  stemTenGod: string;
  branchMainTenGod: string;
  stemAnalysis: string;
  branchAnalysis: string;
  stemIsPositive: boolean;
  branchIsPositive: boolean;
}

const YANG_REN_MAP: Record<string, string> = {
  "甲": "卯", "丙": "午", "戊": "午", "庚": "酉", "壬": "子"
};

function countTenGodCategory(profile: BaziProfile, gods: string[]): number {
  const dist = profile.tenGodDistribution.counts;
  return gods.reduce((sum, g) => sum + (dist[g] ?? 0), 0);
}

function hasStemTenGod(profile: BaziProfile, gods: string[]): boolean {
  return profile.chart.pillars.some(p => p.key !== "day" && gods.includes(p.stem.tenGod));
}

function getStems(profile: BaziProfile): string[] {
  return profile.chart.pillars.filter(p => p.key !== "day").map(p => p.stem.tenGod);
}

export function detectCombinations(profile: BaziProfile, isStrong: boolean): TenGodCombination[] {
  const combos: TenGodCombination[] = [];
  const stems = getStems(profile);
  const shiShang = countTenGodCategory(profile, ["食神", "伤官"]);
  const caiXing = countTenGodCategory(profile, ["正财", "偏财"]);
  const guanSha = countTenGodCategory(profile, ["正官", "七杀"]);
  const yinXing = countTenGodCategory(profile, ["正印", "偏印"]);
  const biJie = countTenGodCategory(profile, ["比肩", "劫财"]);
  const hasShangGuan = hasStemTenGod(profile, ["伤官"]);
  const hasZhengGuan = hasStemTenGod(profile, ["正官"]);
  const hasQiSha = hasStemTenGod(profile, ["七杀"]);
  const hasShiShen = hasStemTenGod(profile, ["食神"]);
  const hasYin = hasStemTenGod(profile, ["正印", "偏印"]);

  // 1. 食伤泄秀
  if (isStrong && shiShang >= 2) {
    combos.push({
      type: "食伤泄秀",
      detected: true,
      strength: Math.min(10, shiShang * 3 + (isStrong ? 2 : 0)),
      personality: "你天生需要向外输出和表达，创作、分享、教学是你释放能量的核心通道。闷着不动会让你烦躁，做出东西来才舒服。",
      career: "适合需要持续产出的工作：创作、策划、产品、咨询、教学、自媒体。你的作品就是你最好的名片。",
      relationship: "在关系中你是给予者和表达者，但要注意不要只顾输出忽略倾听。伴侣需要能欣赏你作品的人。",
      risk: "食伤过旺时容易话多得罪人、过度消耗精力、或者对质量过于苛刻导致完美主义。"
    });
  }

  // 2. 食伤生财
  if (shiShang >= 2 && caiXing >= 2) {
    combos.push({
      type: "食伤生财",
      detected: true,
      strength: Math.min(10, (shiShang + caiXing) * 2),
      personality: "你不仅有才华还知道怎么变现。不是空想型创作者，而是能把想法变成收入的实干派。",
      career: "'站着把钱赚了'——通过技能、作品、表达获得回报。适合知识付费、顾问、自由职业、内容创业。",
      relationship: "经济上比较独立，不太依赖伴侣。但也可能因为太忙于赚钱而忽略感情经营。",
      risk: "过度商业化可能损害创作质量。记住：先有好作品，再有好收入，顺序不能反。"
    });
  }

  // 3. 伤官配印
  if (hasShangGuan && hasYin) {
    combos.push({
      type: "伤官配印",
      detected: true,
      strength: 8,
      personality: "有才华且有底线。骨子里清高骄傲，但不是空洞的傲——你的傲有学识和能力撑着。别人觉得你不好接近，其实你只是标准高。",
      career: "适合需要深度思考+犀利表达的工作。学术研究、法律、战略咨询、深度内容。你的锋利被修养包裹，用得好是利器。",
      relationship: "对伴侣的智识要求很高，'聊不来'是你拒绝一个人最常见的原因。需要精神上的对等。",
      risk: "清高过度会变成孤僻。记住：世界上值得你欣赏的人比你想象的多。"
    });
  }

  // 4. 伤官见官
  if (hasShangGuan && hasZhengGuan) {
    combos.push({
      type: "伤官见官",
      detected: true,
      strength: 7,
      personality: "内心的叛逆和外部的规则在持续拉扯。你能看到制度的漏洞和不合理之处，而且忍不住要指出来。",
      career: "在框架内创新是你的最佳赛道。不适合纯服从的执行岗，也不适合完全无序的环境。'打破常规但有建设性'是你的标签。",
      relationship: "说话容易不留情面。与上级、长辈之间容易因为'说了不该说的话'产生冲突。管住嘴是终生课题。",
      risk: "伤官见官为祸百端——逢流年再见官杀时，口舌是非风险极高。那些年份一定要低调。"
    });
  }

  // 5. 食神制杀
  if (hasShiShen && hasQiSha) {
    combos.push({
      type: "食神制杀",
      detected: true,
      strength: 8,
      personality: "你有一种'越有压力越冷静'的本事。七杀是高压，食神是从容应对——你在紧急情况下的表现反而比日常更出色。",
      career: "适合高压但有技术含量的岗位：急诊、投资、危机处理、竞技类。压力是你的燃料而不是负担。",
      relationship: "你在关系中是'定海神针'角色。伴侣遇到事情会第一时间找你，因为你能稳住局面。",
      risk: "长期高压仍然会消耗身体。食神制杀是'制'不是'消除'——压力还在，只是你能扛。注意定期释放。"
    });
  }

  // 6. 杀印相生
  if (hasQiSha && hasYin) {
    const isGood = !isStrong;
    combos.push({
      type: "杀印相生",
      detected: true,
      strength: isGood ? 9 : 4,
      personality: isGood
        ? "压力被转化为成长动力。外部的高要求通过学习和积累变成你的实力。逆境是你的加速器。"
        : "身旺时杀印相生效果打折——印星消解了七杀的制衡作用，反而让你失去约束。需要食伤来泄。",
      career: isGood
        ? "适合在严格的环境中成长：名校→名企→高位。越卷的环境越能激发你。"
        : "印星过重会让你想太多做太少。减少学习、增加输出才是正道。",
      relationship: isGood
        ? "你倾向于找一个能'推你一把'的伴侣——不是温柔呵护型，而是互相激励型。"
        : "小心过度保护自己。身旺+印旺容易在关系中太强势。",
      risk: isGood
        ? "别把所有压力都内化为'我要更努力'。适当放松不是偷懒。"
        : "身旺忌印——杀印相生在你身上是减分项而非加分项。"
    });
  }

  // 7. 比劫夺财
  // 方向说明：比劫过多且财星透出时，身强身弱的实际影响截然相反——
  // 身强命局比劫本已是忌神，夺财纯属负面结构；身弱命局比劫是喜神帮身，
  // "夺财"更多体现为兄弟朋友分担而非单纯破财，因此文案与强度按 isStrong 分流。
  if (biJie >= 3 && caiXing >= 1) {
    combos.push({
      type: "比劫夺财",
      detected: true,
      strength: isStrong ? Math.min(10, biJie * 2) : Math.min(6, biJie),
      personality: isStrong
        ? "有人在争你的资源——不一定是恶意的，但你挣的钱总有人来分。独立意识极强，不喜欢被安排。"
        : "身边人多、援手也多，但资源分散也快。你不太擅长把钱攥在自己手里，花在人情往来上的部分不少。",
      career: isStrong
        ? "合伙慎重！利益分配一定要写清楚。独立运营比合伙经营更适合你。如果必须合伙，你要控股。"
        : "合伙、抱团反而更适合你——身弱时比劫是助力而非对手，团队协作能帮你把事情做成。",
      relationship: isStrong
        ? "在感情中有'护食'倾向。比劫也代表同性竞争——你的伴侣可能有桃花被他人觊觎。"
        : "身边同性朋友、伙伴对你的支持感明显，感情之外的人际扶持是你的重要底气。",
      risk: isStrong
        ? "逢劫财流年破财风险高。不要借钱给朋友、不做担保、不匆忙签合同。"
        : "财富容易在人情往来中悄悄流失，可以适度设定边界，但不必对'破财'过度紧张。"
    });
  }

  // 8. 官杀混杂
  if (hasZhengGuan && hasQiSha) {
    combos.push({
      type: "官杀混杂",
      detected: true,
      strength: 6,
      personality: "两种约束力在你身上交叉——正官要你守规矩，七杀要你拼命。结果是做事容易犹豫：到底该稳还是该冲？",
      career: "事业上容易面临'两个老板'的困境——两套标准、两种要求。需要一个明确的主线。",
      relationship: "女命官杀混杂→感情中容易有多个追求者但难以抉择。男命→事业和家庭的要求互相矛盾。",
      risk: "官杀混杂最需要食伤来制。如果没有食伤，压力无出口，容易焦虑。"
    });
  }

  return combos.filter(c => c.detected);
}

export function analyzeDayBranch(profile: BaziProfile): DayBranchAnalysis {
  const dayPillar = profile.chart.pillars.find(p => p.key === "day")!;
  const dayStem = profile.chart.dayMaster.value;
  const branch = dayPillar.branch.value;
  const element = dayPillar.branch.element;
  const diShi = dayPillar.diShi;
  const isYangRen = YANG_REN_MAP[dayStem] === branch;
  const hiddenTenGods = dayPillar.branch.hiddenStems.map(h => h.tenGod);

  const spouseDescriptions: Record<string, string> = {
    "比肩": "伴侣在某些方面和你很像——可能同行、同性格。两个相似的人在一起，默契多但摩擦也多。",
    "劫财": "伴侣性格中有争强好胜的一面。关系中容易因为'谁说了算'而拉扯。",
    "食神": "伴侣温和、有生活情趣。你在关系中是享受型的——日常里充满小确幸。",
    "伤官": "伴侣聪明、犀利、有个性。关系不沉闷但也不省心——对方很有想法但也很有脾气。",
    "正财": "伴侣务实、持家、稳重。你在关系中能得到实际的物质和情感支持。",
    "偏财": "伴侣灵活、有经营头脑。关系中有'搭档'感——不只是伴侣，也是合作伙伴。",
    "正官": "伴侣正派、有责任感、讲规矩。你在关系中有安全感但也有被约束感。",
    "七杀": "伴侣强势、有魄力、有能力但也有压迫感。关系中张力强——不是细水长流型。",
    "正印": "伴侣像老师或母亲——理解你、支持你、包容你。你在关系中寻找的是'被懂'。",
    "偏印": "伴侣有独特的气质和非主流的思维。关系不按套路来，但有惊喜。"
  };

  const mainTenGod = hiddenTenGods[0] || "";
  const spousePalace = spouseDescriptions[mainTenGod] || "日支藏干组合多元，配偶性格多面。";

  const diShiDescriptions: Record<string, string> = {
    "长生": "内心充满生机和希望，天生乐观。对未来有信心，精力旺盛。",
    "沐浴": "内心敏感多情，容易被外界影响。桃花旺但感情不稳定。",
    "冠带": "内心有上进心和荣誉感。追求体面和成就，自尊心强。",
    "临官": "内心自信且有主见。根基扎实，不容易被动摇。独立意识极强。",
    "帝旺": "内心能量极旺。自信到骄傲的程度，不接受被轻视。外表可能低调但内心绝不认输。",
    "衰": "内心平和内敛，不争不抢。但也可能缺乏进取心，需要外部推动。",
    "病": "内心敏感脆弱，容易多虑。需要安全感和稳定的环境。",
    "死": "内心极度沉稳，不为外物所动。但也可能过于消极或固化。",
    "墓": "内心有很多想法但不轻易表露。像一个宝库——有东西但锁着门。",
    "绝": "内心有断舍离的倾向。该放手时比常人更果断。",
    "胎": "内心有孕育新事物的潜力。对新开始充满期待。",
    "养": "内心温和包容，喜欢被照顾也善于照顾别人。"
  };

  const innerWorld = diShiDescriptions[diShi] || "";

  let clashRisk = "";
  const dayBranchRelations = profile.relations.filter(
    r => r.category === "earthly-branch" && r.members.includes(branch)
  );
  const clashes = dayBranchRelations.filter(r => ["六冲", "六害", "相刑", "自刑"].includes(r.type));
  const combines = dayBranchRelations.filter(r => ["六合", "三合", "三会"].includes(r.type));

  if (isYangRen) {
    clashRisk += "日坐阳刃——对配偶缺乏耐心，感情中容易急躁和强势。";
  }
  // 日支可能同时命中多种冲刑害关系（如既相刑又六害），此时归为同一条结论，
  // 只列出关系类型、不重复措辞，避免出现多句结论完全相同的句子。
  if (clashes.length > 0) {
    const clashTypes = [...new Set(clashes.map(r => r.type))].join("、");
    clashRisk += `日支逢${clashTypes}——配偶宫不安定，感情容易有波动。`;
  }
  if (combines.length > 0) {
    const combineTypes = [...new Set(combines.map(r => r.type))].join("、");
    clashRisk += `日支逢${combineTypes}——感情容易被外部缘分触发和牵动。`;
  }
  if (!clashRisk) {
    clashRisk = "日支无明显冲合，配偶宫相对安定。";
  }

  return { branch, element, diShi, isYangRen, hiddenTenGods, spousePalace, innerWorld, clashRisk };
}

export function analyzeElementFlow(profile: BaziProfile, isStrong: boolean): ElementFlowChain[] {
  const dayElement = profile.chart.dayMaster.element;
  const chains: ElementFlowChain[] = [];

  const genMap: Record<Element, Element> = { "木": "火", "火": "土", "土": "金", "金": "水", "水": "木" };
  const ctlMap: Record<Element, Element> = { "木": "土", "火": "金", "土": "水", "金": "木", "水": "火" };

  const shiShangEl = genMap[dayElement];
  const caiEl = ctlMap[dayElement];
  const guanEl = ctlMap[caiEl];
  const yinEl = genMap[guanEl];

  const scores = profile.elementBalance.counts;

  if (isStrong && scores[shiShangEl].total >= 2 && scores[caiEl].total >= 1) {
    chains.push({
      type: "食伤生财链",
      chain: `${dayElement}(日主) → ${shiShangEl}(食伤泄秀) → ${caiEl}(财星变现)`,
      description: `能量从日主流向${shiShangEl}再到${caiEl}——通过才华和输出来获得财富的完整通道。这是身旺命局最佳的五行流通方式。`,
      isPositive: true
    });
  }

  if (isStrong && scores[yinEl].total >= 2) {
    chains.push({
      type: "印比帮身链",
      chain: `${yinEl}(印星) → ${dayElement}(日主) ← ${dayElement}(比劫)`,
      description: `${yinEl}生${dayElement}，加上比劫帮身——已经身旺还被加持，过旺则固执、独断。需要食伤和财星来疏导。`,
      isPositive: false
    });
  }

  if (!isStrong && scores[yinEl].total >= 1 && scores[guanEl].total >= 1) {
    chains.push({
      type: "杀印相生链",
      chain: `${guanEl}(官杀压力) → ${yinEl}(印星转化) → ${dayElement}(日主受益)`,
      description: `外部压力通过学习和积累转化为成长动力。身弱时这是最好的支持结构——压力不直接砸到你身上，而是被印星缓冲后变成营养。`,
      isPositive: true
    });
  }

  if (scores[shiShangEl].total >= 3) {
    chains.push({
      type: "食伤过旺泄气",
      chain: `${dayElement}(日主) → ${shiShangEl}(食伤×${scores[shiShangEl].total})`,
      description: `食伤过多会泄气太过——想法多但精力分散，或者表达过度得罪人。需要适度控制输出节奏。`,
      isPositive: false
    });
  }

  return chains;
}

export function analyzeLuckCycleLayers(
  ganZhi: string,
  dayMaster: { value: string; element: Element },
  isStrong: boolean
): LuckCycleLayers {
  const [stem, branch] = [...ganZhi];
  const stemElement = STEM_META[stem].element;
  const branchMeta = { "子": "水", "丑": "土", "寅": "木", "卯": "木", "辰": "土", "巳": "火", "午": "火", "未": "土", "申": "金", "酉": "金", "戌": "土", "亥": "水" } as Record<string, Element>;
  const branchElement = branchMeta[branch] || "土";

  const stemTenGod = computeTenGod(dayMaster.value, stem);
  const interaction = getElementInteraction(dayMaster.element, stemElement);

  const favorableInteractions = isStrong
    ? ["generate", "control", "controlled-by"]
    : ["generated-by", "same"];

  const stemIsPositive = favorableInteractions.includes(interaction);
  const branchInteraction = getElementInteraction(dayMaster.element, branchElement);
  const branchIsPositive = favorableInteractions.includes(branchInteraction);

  const stemDesc = stemIsPositive
    ? `天干${stem}(${stemTenGod})为喜用透出——前5年主题明朗、机会在明面。`
    : `天干${stem}(${stemTenGod})为忌神透出——前5年需要应对的挑战在明面。`;

  const branchDesc = branchIsPositive
    ? `地支${branch}(${branchElement})为喜——后5年底层环境支持。`
    : `地支${branch}(${branchElement})为忌——后5年底层环境有压力。`;

  return {
    stemElement,
    branchElement,
    stemTenGod,
    branchMainTenGod: computeTenGod(dayMaster.value, stem),
    stemAnalysis: stemDesc,
    branchAnalysis: branchDesc,
    stemIsPositive,
    branchIsPositive
  };
}
