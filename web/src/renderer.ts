import { HIDDEN_STEM_WEIGHTS, MONTH_ELEMENT_STATE, STEM_META, computeTenGod, getElementInteraction } from "@core/constants";
import type { BaziProfile, Element, FlowAnalysis, LuckCycle, PillarDetails } from "@core/types";

const ELEMENT_COLOR: Record<string, string> = {
  "木": "#4caf50", "火": "#f44336", "土": "#ffc107", "金": "#e0e0e0", "水": "#2196f3"
};

interface ElementScores {
  totals: Record<Element, number>;
  stemScores: Record<Element, number>;
  branchScores: Record<Element, number>;
  strongValue: number;
  weakValue: number;
  isStrong: boolean;
}

interface FavorableElements {
  most: Element[];
  good: Element[];
  neutral: Element[];
  bad: Element[];
  worst: Element[];
}

function computeElementScores(profile: BaziProfile): ElementScores {
  const totals: Record<Element, number> = { "木": 0, "火": 0, "土": 0, "金": 0, "水": 0 };
  const stemScores: Record<Element, number> = { "木": 0, "火": 0, "土": 0, "金": 0, "水": 0 };
  const branchScores: Record<Element, number> = { "木": 0, "火": 0, "土": 0, "金": 0, "水": 0 };

  for (const pillar of profile.chart.pillars) {
    stemScores[pillar.stem.element] += 5;
    totals[pillar.stem.element] += 5;
  }

  const branches = profile.chart.pillars.map(p => p.branch.value);
  const monthBranch = profile.chart.pillars[1].branch.value;
  const allBranches = [...branches, monthBranch];

  for (const branch of allBranches) {
    const weights = HIDDEN_STEM_WEIGHTS[branch];
    if (!weights) continue;
    for (const [stem, weight] of Object.entries(weights)) {
      const el = STEM_META[stem].element;
      branchScores[el] += weight;
      totals[el] += weight;
    }
  }

  const dayElement = profile.chart.dayMaster.element;
  const generating = getGeneratingElement(dayElement);

  const strongValue = totals[dayElement] + totals[generating];
  const weakValue = Object.values(totals).reduce((a, b) => a + b, 0) - strongValue;
  const isStrong = strongValue > 29;

  return { totals, stemScores, branchScores, strongValue, weakValue, isStrong };
}

function getGeneratingElement(el: Element): Element {
  const map: Record<Element, Element> = { "木": "水", "火": "木", "土": "火", "金": "土", "水": "金" };
  return map[el];
}

function getGeneratedElement(el: Element): Element {
  const map: Record<Element, Element> = { "木": "火", "火": "土", "土": "金", "金": "水", "水": "木" };
  return map[el];
}

function getControlledElement(el: Element): Element {
  const map: Record<Element, Element> = { "木": "土", "火": "金", "土": "水", "金": "木", "水": "火" };
  return map[el];
}

function getControllingElement(el: Element): Element {
  const map: Record<Element, Element> = { "木": "金", "火": "水", "土": "木", "金": "火", "水": "土" };
  return map[el];
}

function judgeFavorable(dayElement: Element, isStrong: boolean): FavorableElements {
  if (isStrong) {
    return {
      most: [getGeneratedElement(dayElement)],
      good: [getControlledElement(dayElement), getControllingElement(dayElement)],
      neutral: [],
      bad: [getGeneratingElement(dayElement)],
      worst: [dayElement]
    };
  }
  return {
    most: [getGeneratingElement(dayElement)],
    good: [dayElement],
    neutral: [getControllingElement(dayElement)],
    bad: [getGeneratedElement(dayElement)],
    worst: [getControlledElement(dayElement)]
  };
}

function toneLabel(tone: string): string {
  if (tone === "supportive") return "<span class='tone-good'>好</span>";
  if (tone === "challenging") return "<span class='tone-bad'>差</span>";
  return "<span class='tone-mid'>中</span>";
}

function elSpan(el: string): string {
  return `<span style="color:${ELEMENT_COLOR[el] || '#ccc'}">${el}</span>`;
}

function renderBasicInfo(profile: BaziProfile): string {
  const dm = profile.chart.dayMaster;
  const dayPillar = profile.chart.pillars.find(p => p.key === "day")!;
  return `
    <div class="card">
      <h2>基本信息</h2>
      <table class="info-table">
        <tr><td>阳历</td><td>${profile.birth.solar}</td></tr>
        <tr><td>农历</td><td>${profile.birth.lunar}</td></tr>
        <tr><td>日主</td><td>${elSpan(dm.element)} ${dm.value}${dm.element}（${dm.yinYang}）</td></tr>
        <tr><td>纳音</td><td>${dayPillar.naYin}</td></tr>
        <tr><td>胎元</td><td>${profile.chart.taiYuan}</td></tr>
        <tr><td>命宫</td><td>${profile.chart.mingGong}</td></tr>
        <tr><td>身宫</td><td>${profile.chart.shenGong}</td></tr>
        <tr><td>性别</td><td>${profile.input.gender === "male" ? "男" : "女"}</td></tr>
      </table>
    </div>`;
}

function renderPillars(profile: BaziProfile): string {
  const labels = ["年柱", "月柱", "日柱", "时柱"];
  let rows = "";

  rows += "<tr><th></th>" + labels.map(l => `<th>${l}</th>`).join("") + "</tr>";
  rows += "<tr><td>干支</td>" + profile.chart.pillars.map(p => `<td class="ganzhi">${p.ganZhi}</td>`).join("") + "</tr>";
  rows += "<tr><td>天干</td>" + profile.chart.pillars.map(p => `<td>${elSpan(p.stem.element)} ${p.stem.value}${p.stem.element}${p.stem.yinYang}</td>`).join("") + "</tr>";
  rows += "<tr><td>十神</td>" + profile.chart.pillars.map(p => `<td>${p.stem.tenGod}</td>`).join("") + "</tr>";
  rows += "<tr><td>地支</td>" + profile.chart.pillars.map(p => `<td>${elSpan(p.branch.element)} ${p.branch.value}${p.branch.element}${p.branch.yinYang}</td>`).join("") + "</tr>";
  rows += "<tr><td>藏干</td>" + profile.chart.pillars.map(p =>
    `<td>${p.branch.hiddenStems.map(h => `${h.value}(${h.tenGod})`).join(" ")}</td>`
  ).join("") + "</tr>";
  rows += "<tr><td>纳音</td>" + profile.chart.pillars.map(p => `<td>${p.naYin}</td>`).join("") + "</tr>";
  rows += "<tr><td>地势</td>" + profile.chart.pillars.map(p => `<td>${p.diShi}</td>`).join("") + "</tr>";
  rows += "<tr><td>旬空</td>" + profile.chart.pillars.map(p => `<td>${p.xunKong}</td>`).join("") + "</tr>";

  return `
    <div class="card">
      <h2>四柱排盘</h2>
      <table class="pillars-table">${rows}</table>
    </div>`;
}

function renderElementScores(scores: ElementScores, dayElement: Element): string {
  const maxScore = Math.max(...Object.values(scores.totals));
  const bars = (["木", "火", "土", "金", "水"] as Element[]).map(el => {
    const pct = maxScore > 0 ? (scores.totals[el] / maxScore) * 100 : 0;
    return `
      <div class="bar-row">
        <span class="bar-label" style="color:${ELEMENT_COLOR[el]}">${el}</span>
        <div class="bar-track">
          <div class="bar-fill" style="width:${pct}%;background:${ELEMENT_COLOR[el]}"></div>
        </div>
        <span class="bar-value">${scores.totals[el]}</span>
      </div>`;
  }).join("");

  return `
    <div class="card">
      <h2>五行分布</h2>
      <div class="bar-chart">${bars}</div>
      <div class="strength-summary">
        <div class="strength-item">
          <span>身强值（${dayElement}+${getGeneratingElement(dayElement)}）</span>
          <strong>${scores.strongValue}</strong>
        </div>
        <div class="strength-item">
          <span>克泄耗值</span>
          <strong>${scores.weakValue}</strong>
        </div>
        <div class="strength-item">
          <span>中值</span>
          <strong>29</strong>
        </div>
        <div class="strength-result ${scores.isStrong ? 'strong' : 'weak'}">
          ${scores.isStrong ? "身旺" : "身弱"}
        </div>
      </div>
    </div>`;
}

function renderStrengthJudgment(profile: BaziProfile, scores: ElementScores): string {
  const dayElement = profile.chart.dayMaster.element;
  const monthBranch = profile.chart.pillars[1].branch.value;
  const monthState = MONTH_ELEMENT_STATE[monthBranch]?.[dayElement] || "";
  const deLing = monthState === "旺" || monthState === "相";

  const dayBranch = profile.chart.pillars[2].branch.value;
  const diShi = profile.chart.pillars[2].diShi;
  const strongRoots = ["临官", "帝旺", "长生", "冠带"];
  const deDi = strongRoots.includes(diShi);

  const generating = getGeneratingElement(dayElement);
  const deSheng = profile.chart.pillars.some(p => p.stem.element === generating);

  const deZhu = profile.chart.pillars.filter(p => p.key !== "day" && p.stem.element === dayElement).length > 0;

  const checks = [
    { label: "得令", result: deLing, detail: `月支${monthBranch}，${dayElement}在月令为"${monthState}"` },
    { label: "得地", result: deDi, detail: `日支${dayBranch}，地势为"${diShi}"` },
    { label: "得生", result: deSheng, detail: deSheng ? `有${generating}(印星)透干` : `无${generating}透干` },
    { label: "得助", result: deZhu, detail: deZhu ? `有${dayElement}(比肩)透干` : `无${dayElement}(比肩)透干` }
  ];

  const rows = checks.map(c => `
    <tr>
      <td>${c.label}</td>
      <td class="${c.result ? 'check-pass' : 'check-fail'}">${c.result ? "✓" : "✗"}</td>
      <td>${c.detail}</td>
    </tr>`).join("");

  return `
    <div class="card">
      <h2>身旺身弱判定</h2>
      <table class="judge-table">
        <tr><th>条件</th><th>结果</th><th>说明</th></tr>
        ${rows}
      </table>
      <p class="judge-conclusion">
        四诀 ${checks.filter(c => c.result).length}/4 通过 + 数值法身强值 ${scores.strongValue} > 中值29 →
        <strong class="${scores.isStrong ? 'strong' : 'weak'}">${scores.isStrong ? "身旺" : "身弱"}</strong>
      </p>
    </div>`;
}

function renderFavorable(dayElement: Element, favorable: FavorableElements, isStrong: boolean): string {
  const tenGodMap: Record<string, string> = {
    [getGeneratedElement(dayElement)]: "食伤（我生）",
    [getControlledElement(dayElement)]: "财星（我克）",
    [getControllingElement(dayElement)]: "官杀（克我）",
    [getGeneratingElement(dayElement)]: "印星（生我）",
    [dayElement]: "比劫（帮我）"
  };

  const allElements = [...favorable.most, ...favorable.good, ...favorable.neutral, ...favorable.bad, ...favorable.worst];
  const levelMap = new Map<string, string>();
  favorable.most.forEach(e => levelMap.set(e, "最喜"));
  favorable.good.forEach(e => levelMap.set(e, "喜"));
  favorable.neutral.forEach(e => levelMap.set(e, "中"));
  favorable.bad.forEach(e => levelMap.set(e, "忌"));
  favorable.worst.forEach(e => levelMap.set(e, "大忌"));

  const rows = allElements.map(el => {
    const level = levelMap.get(el) || "中";
    const cls = level.includes("喜") || level === "最喜" ? "fav-good" : level.includes("忌") ? "fav-bad" : "fav-mid";
    return `<tr class="${cls}"><td>${level}</td><td>${elSpan(el)}</td><td>${tenGodMap[el] || ""}</td><td>${isStrong ? "泄/耗/克" : "生/帮"}所需</td></tr>`;
  }).join("");

  return `
    <div class="card">
      <h2>喜忌用神</h2>
      <p>身${isStrong ? "旺" : "弱"}取用：${isStrong ? "需泄（食伤）、耗（财星）、克（官杀）" : "需生（印星）、帮（比劫）"}</p>
      <table class="fav-table">
        <tr><th>喜忌</th><th>五行</th><th>十神</th><th>原因</th></tr>
        ${rows}
      </table>
    </div>`;
}

function renderTenGods(profile: BaziProfile): string {
  const dist = profile.tenGodDistribution;
  const rows = Object.entries(dist.counts)
    .sort((a, b) => b[1] - a[1])
    .map(([god, count]) => {
      const isDom = dist.dominant.includes(god);
      return `<tr class="${isDom ? 'dominant' : ''}"><td>${god}</td><td>${count}</td></tr>`;
    }).join("");

  return `
    <div class="card">
      <h2>十神分布</h2>
      <table class="ten-god-table">
        <tr><th>十神</th><th>次数</th></tr>
        ${rows}
      </table>
      <p>主轴：<strong>${dist.dominant.join("、")}</strong></p>
      <p>${dist.observations.join(" ")}</p>
    </div>`;
}

function renderRelations(profile: BaziProfile): string {
  const rows = profile.relations.map(r => {
    const isGood = ["六合", "三合", "三会", "天干五合"].includes(r.type);
    const isBad = ["六冲", "六害", "相刑", "自刑"].includes(r.type);
    const cls = isGood ? "rel-good" : isBad ? "rel-bad" : "";
    return `<tr class="${cls}"><td>${r.category === "heavenly-stem" ? "天干" : r.category === "earthly-branch" ? "地支" : "五行"}</td><td>${r.type}</td><td>${r.description}</td></tr>`;
  }).join("");

  return `
    <div class="card">
      <h2>命盘关系</h2>
      <table class="relations-table">
        <tr><th>类别</th><th>关系</th><th>说明</th></tr>
        ${rows}
      </table>
    </div>`;
}

function renderNarrativeAnalysis(profile: BaziProfile): string {
  const a = profile.analysis;
  const dimensions = [
    { key: "overview", label: "总览" },
    { key: "career", label: "事业" },
    { key: "relationships", label: "感情" },
    { key: "health", label: "健康" },
    { key: "wealth", label: "财富" }
  ];

  const sections = dimensions.map(d => {
    const lines = (a as Record<string, string[]>)[d.key] || [];
    return `<div class="analysis-dim"><h3>${d.label}</h3><ul>${lines.map(l => `<li>${l}</li>`).join("")}</ul></div>`;
  }).join("");

  return `<div class="card"><h2>命盘分析</h2>${sections}</div>`;
}

function renderLuckCyclesOverview(profile: BaziProfile): string {
  const lc = profile.luckCycles;
  const rows = lc.cycles.map(c => `
    <tr>
      <td>${c.index}</td>
      <td class="ganzhi">${c.ganZhi}</td>
      <td>${c.startAge}-${c.endAge}</td>
      <td>${c.startYear}-${c.endYear}</td>
      <td>${toneLabel(c.analysis.overall.tone)}</td>
      <td>${toneLabel(c.analysis.career.tone)}</td>
      <td>${toneLabel(c.analysis.relationships.tone)}</td>
      <td>${toneLabel(c.analysis.health.tone)}</td>
      <td>${toneLabel(c.analysis.wealth.tone)}</td>
    </tr>`).join("");

  return `
    <div class="card">
      <h2>大运总览</h2>
      <p>起运：${lc.startSolar}（${lc.startOffset.years}年${lc.startOffset.months}月${lc.startOffset.days}日）| 方向：${lc.direction === "forward" ? "顺行" : "逆行"}</p>
      <table class="luck-table">
        <tr><th>运</th><th>干支</th><th>年龄</th><th>年份</th><th>整体</th><th>事业</th><th>感情</th><th>健康</th><th>财富</th></tr>
        ${rows}
      </table>
    </div>`;
}

function renderLuckCycleDetails(profile: BaziProfile): string {
  const sections = profile.luckCycles.cycles.map(cycle => {
    const annualRows = cycle.annuals.map(a => `
      <tr>
        <td>${a.year}</td>
        <td>${a.age}</td>
        <td class="ganzhi">${a.ganZhi}</td>
        <td>${toneLabel(a.analysis.overall.tone)}</td>
        <td>${toneLabel(a.analysis.career.tone)}</td>
        <td>${toneLabel(a.analysis.relationships.tone)}</td>
        <td>${toneLabel(a.analysis.health.tone)}</td>
        <td>${toneLabel(a.analysis.wealth.tone)}</td>
      </tr>`).join("");

    return `
      <details class="cycle-detail">
        <summary>
          第${cycle.index}运 <span class="ganzhi">${cycle.ganZhi}</span>
          （${cycle.startAge}-${cycle.endAge}岁，${cycle.startYear}-${cycle.endYear}）
          ${toneLabel(cycle.analysis.overall.tone)}
        </summary>
        <div class="cycle-analysis">
          <p><strong>整体</strong>：${cycle.analysis.overall.summary.join(" ")}</p>
          <p><strong>事业</strong>：${cycle.analysis.career.summary.join(" ")}</p>
          <p><strong>感情</strong>：${cycle.analysis.relationships.summary.join(" ")}</p>
          <p><strong>健康</strong>：${cycle.analysis.health.summary.join(" ")}</p>
          <p><strong>财富</strong>：${cycle.analysis.wealth.summary.join(" ")}</p>
        </div>
        <table class="annual-table">
          <tr><th>年</th><th>龄</th><th>干支</th><th>整体</th><th>事业</th><th>感情</th><th>健康</th><th>财富</th></tr>
          ${annualRows}
        </table>
      </details>`;
  }).join("");

  return `<div class="card"><h2>大运流年详情</h2>${sections}</div>`;
}

function renderPersonality(profile: BaziProfile, scores: ElementScores, favorable: FavorableElements): string {
  const dm = profile.chart.dayMaster;
  const dayBranch = profile.chart.pillars[2].branch.value;
  const diShi = profile.chart.pillars[2].diShi;

  const dayMasterDescriptions: Record<string, string> = {
    "甲": "甲木为阳木，象征参天大树。性格正直、有主见、有担当，但也固执、不易变通。",
    "乙": "乙木为阴木，象征花草藤蔓。柔韧灵活、善于适应环境，但决断力稍弱。",
    "丙": "丙火为阳火，象征太阳。热情开朗、慷慨大方、有感染力，但容易急躁。",
    "丁": "丁火为阴火，象征灯烛星光。细腻敏锐、专注力强、有洞察力，但容易多虑。",
    "戊": "戊土为阳土，象征高山大地。厚重稳定、包容力强、值得信赖，但也固执不变通。",
    "己": "己土为阴土，象征田园沃土。温和务实、善于养育、有耐心，但容易优柔寡断。",
    "庚": "庚金为阳金，象征刀剑钢铁。果断锐利、执行力强、重义气，但容易刚愎自用。",
    "辛": "辛金为阴金，象征珠宝首饰。精致讲究、审美力高、善于表达，但容易挑剔。",
    "壬": "壬水为阳水，象征江河大海。智慧深广、足智多谋、有远见，但容易不安定。",
    "癸": "癸水为阴水，象征雨露溪流。聪明细腻、感受力强、直觉好，但容易多愁善感。"
  };

  const strengthDesc = scores.isStrong
    ? "身旺之人自信心强、执行力强、不轻易被外界动摇。但也容易固执己见、独断专行。"
    : "身弱之人适应力强、善于借力、心思细腻。但容易犹豫不决、需要外部支持。";

  const tenGodPersonality: string[] = [];
  const dist = profile.tenGodDistribution;
  if ((dist.counts["比肩"] ?? 0) + (dist.counts["劫财"] ?? 0) >= 3) {
    tenGodPersonality.push("比劫旺：独立意识强，不喜欢被安排，竞争心重但不外显。社交上重质不重量。");
  }
  if ((dist.counts["食神"] ?? 0) + (dist.counts["伤官"] ?? 0) >= 3) {
    tenGodPersonality.push("食伤旺：表达欲强，有创造力和审美力，追求品质。适合创作和输出型工作。");
  }
  if ((dist.counts["正财"] ?? 0) + (dist.counts["偏财"] ?? 0) >= 3) {
    tenGodPersonality.push("财星旺：务实、有经营意识、对资源敏感。做事注重结果和回报。");
  }
  if ((dist.counts["正官"] ?? 0) + (dist.counts["七杀"] ?? 0) >= 3) {
    tenGodPersonality.push("官杀旺：责任感重、对自己要求高、在压力下反而出色。但容易给自己太大压力。");
  }
  if ((dist.counts["正印"] ?? 0) + (dist.counts["偏印"] ?? 0) >= 3) {
    tenGodPersonality.push("印星旺：学习力强、有人缘、善于吸收。但容易想太多做太少。");
  }

  return `
    <div class="card">
      <h2>性格分析</h2>
      <div class="personality-section">
        <h3>日主特质：${dm.value}${dm.element}</h3>
        <p>${dayMasterDescriptions[dm.value] || ""}</p>
        <p>日支${dayBranch}（${diShi}位）：${strengthDesc}</p>
      </div>
      <div class="personality-section">
        <h3>十神性格色彩</h3>
        ${tenGodPersonality.length > 0 ? `<ul>${tenGodPersonality.map(t => `<li>${t}</li>`).join("")}</ul>` : "<p>十神分布较均匀，性格较为平衡。</p>"}
      </div>
      <div class="personality-section">
        <h3>喜好倾向</h3>
        <ul>
          <li><strong>适合方向</strong>：${favorable.most.map(e => elSpan(e)).join("")}${favorable.good.map(e => elSpan(e)).join("")} 相关行业和环境</li>
          <li><strong>颜色偏好</strong>：${[...favorable.most, ...favorable.good].map(e => `<span style="color:${ELEMENT_COLOR[e]}">${e}色(${ELEMENT_COLOR[e]})</span>`).join(" ")}</li>
          <li><strong>方位</strong>：${[...favorable.most, ...favorable.good].map(e => ({"木":"东方","火":"南方","土":"中央","金":"西方","水":"北方"}[e])).join("、")}</li>
        </ul>
      </div>
    </div>`;
}

function renderLifetimeLookup(dayElement: Element, favorable: FavorableElements): string {
  const directionMap: Record<string, string> = { "木": "东方", "火": "南方", "土": "中央", "金": "西方", "水": "北方" };
  const colorMap: Record<string, string> = { "木": "绿/青", "火": "红/紫/橙", "土": "黄/棕", "金": "白/银/金", "水": "黑/蓝" };
  const industryMap: Record<string, string> = { "木": "教育/法律/环保/出版", "火": "科技/能源/餐饮/传媒", "土": "房地产/建筑/农业", "金": "金融/制造/IT/刀笔", "水": "物流/旅游/贸易/水产" };
  const numberMap: Record<string, string> = { "木": "3、8", "火": "2、7", "土": "5、0", "金": "4、9", "水": "1、6" };

  const allEls = [...favorable.most, ...favorable.good, ...favorable.neutral, ...favorable.bad, ...favorable.worst];
  const rows = allEls.map(el => {
    const level = favorable.most.includes(el) ? "最喜" : favorable.good.includes(el) ? "喜" : favorable.bad.includes(el) ? "忌" : favorable.worst.includes(el) ? "大忌" : "中";
    const cls = level.includes("喜") || level === "最喜" ? "fav-good" : level.includes("忌") ? "fav-bad" : "";
    return `<tr class="${cls}"><td>${level}</td><td>${elSpan(el)}</td><td>${colorMap[el]}</td><td>${directionMap[el]}</td><td>${numberMap[el]}</td><td>${industryMap[el]}</td></tr>`;
  }).join("");

  return `
    <div class="card">
      <h2>终生喜忌速查</h2>
      <table class="lookup-table">
        <tr><th>喜忌</th><th>五行</th><th>颜色</th><th>方位</th><th>数字</th><th>行业</th></tr>
        ${rows}
      </table>
    </div>`;
}

export function renderReport(profile: BaziProfile): string {
  const scores = computeElementScores(profile);
  const dayElement = profile.chart.dayMaster.element;
  const favorable = judgeFavorable(dayElement, scores.isStrong);

  return [
    renderBasicInfo(profile),
    renderPillars(profile),
    renderElementScores(scores, dayElement),
    renderStrengthJudgment(profile, scores),
    renderFavorable(dayElement, favorable, scores.isStrong),
    renderPersonality(profile, scores, favorable),
    renderTenGods(profile),
    renderRelations(profile),
    renderNarrativeAnalysis(profile),
    renderLuckCyclesOverview(profile),
    renderLuckCycleDetails(profile),
    renderLifetimeLookup(dayElement, favorable)
  ].join("");
}
