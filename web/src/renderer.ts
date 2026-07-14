import { analyzeDayBranch, analyzeElementFlow, analyzeLuckCycleLayers, detectCombinations } from "@core/combinations";
import { HIDDEN_STEM_WEIGHTS, MONTH_ELEMENT_STATE, STEM_META, TEN_GOD_CONCRETE, computeTenGod, getElementInteraction } from "@core/constants";
import type { DayBranchAnalysis, ElementFlowChain, TenGodCombination } from "@core/combinations";
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
  // 旺衰结论统一采用核心引擎的三维旺衰标准（profile.strength，与大运流年分析同源，
  // 即 得令/得地/得势 细判 + supportRatio 中和态兵底），不再用本地单一阈值
  // strongValue > 29 重新判定，避免网页展示结论与后端真实计算结论不一致。
  const isStrong = profile.strength.level === "身旺" || profile.strength.level === "身强"
    ? true
    : profile.strength.level === "身弱" || profile.strength.level === "身极弱"
      ? false
      : profile.strength.supportRatio >= 0.5;

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

function normalizeReportLine(line: string): string {
  return line.replace(/\s+/g, " ").trim();
}

function isFallbackLine(line: string): boolean {
  return [
    "建议结合",
    "更适合结合",
    "暂无单一强信号",
    "后续如果做更细报告",
    "可以把",
    "建议重点看",
    "趋势提示"
  ].some(keyword => line.includes(keyword));
}

function pickReportLines(lines: string[] = [], maxItems = 2): string[] {
  const unique = Array.from(new Set(lines.map(normalizeReportLine).filter(Boolean)));
  return unique
    .sort((a, b) => {
      const fallbackDelta = Number(isFallbackLine(a)) - Number(isFallbackLine(b));
      if (fallbackDelta !== 0) return fallbackDelta;
      return a.length - b.length;
    })
    .slice(0, maxItems);
}

function summarizeDimension(lines: string[] = []): string {
  return pickReportLines(lines, 1)[0] || "";
}

function pickSignalTags(signals: FlowAnalysis["signals"] = [], maxItems = 4): FlowAnalysis["signals"] {
  const seen = new Set<string>();

  return signals.filter(signal => {
    const key = `${signal.category}:${signal.type}:${signal.tone}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, maxItems);
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
          ${scores.isStrong ? "身旺偏强" : "身弱偏耐"}
        </div>
      </div>
      <p class="hint">注：此处为五行总分的粗略参考值，最终旺衰结论以下方《身旺身弱判定》中的得令/得地/得势三维细判为准。</p>
    </div>`;
}

function renderStrengthJudgment(profile: BaziProfile, scores: ElementScores): string {
  const dayElement = profile.chart.dayMaster.element;
  const s = profile.strength;
  const monthBranch = profile.chart.pillars[1].branch.value;
  const monthState = MONTH_ELEMENT_STATE[monthBranch]?.[dayElement] || "休囚";

  // 与核心引擎 src/scoring.ts 中 assessStrength 同源的三维细判（得令/得地/得势），
  // 不再用本地重算的旧版四诀（得令/得地/得生/得助），确保页面展示的判据与真实结论一致。
  const checks = [
    { label: "得令", result: s.deLing, detail: `月支${monthBranch}，${dayElement}在月令处"${monthState}"势` },
    { label: "得地", result: s.deDi, detail: `地支藏干通根权重合计${s.rootWeight.toFixed(1)}（≥5为得地）` },
    { label: "得势", result: s.deShi, detail: `天干比劫/印星帮扶${s.helpingStemCount}位（≥2为得势）` }
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
        三诀 ${checks.filter(c => c.result).length}/3 通过，扶抵力占比 ${Math.round(s.supportRatio * 100)}% →
        <strong class="${scores.isStrong ? 'strong' : 'weak'}">${s.level}</strong>
      </p>
      <p class="hint">${s.reasons.join("")}</p>
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
      const info = TEN_GOD_CONCRETE[god];
      const tooltip = info ? `${info.career}` : "";
      return `<tr class="${isDom ? 'dominant' : ''}"><td>${god}</td><td>${count}</td><td class="tengod-desc">${tooltip}</td></tr>`;
    }).join("");

  const dominantDetails = dist.dominant.map(god => {
    const info = TEN_GOD_CONCRETE[god];
    if (!info) return "";
    return `
      <div class="tengod-detail">
        <h4>${god}（主轴）</h4>
        <ul>
          <li><strong>事业</strong>：${info.career}</li>
          <li><strong>性格</strong>：${info.personality}</li>
          <li><strong>感情</strong>：${info.relationship}</li>
          <li><strong>财富</strong>：${info.wealth}</li>
        </ul>
      </div>`;
  }).join("");

  return `
    <div class="card">
      <h2>十神分布</h2>
      <table class="ten-god-table">
        <tr><th>十神</th><th>次数</th><th>具象含义</th></tr>
        ${rows}
      </table>
      <p>主轴：<strong>${dist.dominant.join("、")}</strong></p>
      <p>${dist.observations.join(" ")}</p>
      ${dominantDetails}
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
  const sections = [
    { key: "overview", label: "命局主线" },
    { key: "career", label: "事业" },
    { key: "relationships", label: "感情" },
    { key: "wealth", label: "财富" },
    { key: "health", label: "健康" }
  ].map(d => {
    const lines = pickReportLines((a as Record<string, string[]>)[d.key] || [], d.key === "overview" ? 2 : 1);
    return `
      <div class="analysis-dim">
        <h3>${d.label}</h3>
        <ul>${lines.map(l => `<li>${l}</li>`).join("")}</ul>
      </div>`;
  }).join("");

  return `
    <div class="card">
      <h2>核心结论</h2>
      <p class="hint">先看主线，再回到各章节查看依据与细节。</p>
      ${sections}
    </div>`;
}

function renderLuckCyclesOverview(profile: BaziProfile, dayElement: Element, isStrong: boolean): string {
  const lc = profile.luckCycles;
  const monthBranch = profile.chart.pillars[1].branch.value;
  const rows = lc.cycles.map(c => {
    const corrected = computeCorrectedTone(c.ganZhi, dayElement, isStrong, monthBranch, c.analysis);
    return `
    <tr>
      <td>${c.index}</td>
      <td class="ganzhi">${c.ganZhi}</td>
      <td>${c.startAge}-${c.endAge}</td>
      <td>${c.startYear}-${c.endYear}</td>
      <td>${toneLabel(corrected.tone)}</td>
      <td>${toneLabel(c.analysis.career.tone)}</td>
      <td>${toneLabel(c.analysis.relationships.tone)}</td>
      <td>${toneLabel(c.analysis.health.tone)}</td>
      <td>${toneLabel(c.analysis.wealth.tone)}</td>
    </tr>`;
  }).join("");

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

function computeCorrectedTone(
  ganZhi: string,
  dayElement: Element,
  isStrong: boolean,
  monthBranch: string,
  analysis: FlowAnalysis
): { tone: string; score: number; breakdown: string } {
  const [stem, branch] = [...ganZhi];
  const stemEl = STEM_META[stem]?.element;
  if (!stemEl) return { tone: analysis.overall.tone, score: 0, breakdown: "" };

  const genMap: Record<Element, Element> = { "木": "火", "火": "土", "土": "金", "金": "水", "水": "木" };
  const ctlMap: Record<Element, Element> = { "木": "土", "火": "金", "土": "水", "金": "木", "水": "火" };
  const genByMap: Record<Element, Element> = { "木": "水", "火": "木", "土": "火", "金": "土", "水": "金" };
  const ctlByMap: Record<Element, Element> = { "木": "金", "火": "水", "土": "木", "金": "火", "水": "土" };

  // 1. 透出喜忌 (40%)
  let touchu = 0;
  if (isStrong) {
    if (stemEl === genMap[dayElement]) touchu = 3;        // 食伤泄秀
    else if (stemEl === ctlMap[dayElement]) touchu = 2;   // 财星耗身
    else if (stemEl === ctlByMap[dayElement]) touchu = 1; // 官杀制身
    else if (stemEl === genByMap[dayElement]) touchu = -2; // 印星生身(忌)
    else if (stemEl === dayElement) touchu = -3;          // 比劫帮身(忌)
  } else {
    if (stemEl === genByMap[dayElement]) touchu = 3;      // 印星生身
    else if (stemEl === dayElement) touchu = 2;           // 比劫帮身
    else if (stemEl === ctlByMap[dayElement]) touchu = -1; // 官杀克身
    else if (stemEl === genMap[dayElement]) touchu = -1;  // 食伤泄气
    else if (stemEl === ctlMap[dayElement]) touchu = -2;  // 财星耗身
  }

  // 2. 十神作用 (25%) - 从引擎信号中提取
  const signals = analysis.signals || [];
  let tenGodScore = 0;
  for (const s of signals) {
    if (s.tone === "supportive") tenGodScore += 1;
    else if (s.tone === "challenging") tenGodScore -= 1;
  }
  tenGodScore = Math.max(-3, Math.min(3, tenGodScore));

  // 3. 冲合刑害 (20%) - 从信号中提取
  let chongHe = 0;
  for (const s of signals) {
    if (s.category === "branch-relation") {
      if (s.type === "六合" || s.type === "三合" || s.type === "三会") chongHe += 1;
      else if (s.type === "六冲" || s.type === "六害" || s.type === "相刑") chongHe -= 1;
    }
  }
  chongHe = Math.max(-3, Math.min(3, chongHe));

  // 4. 调候 (10%) - 冬月生人见火+, 夏月生人见水+
  let tiaohou = 0;
  const coldMonths = ["亥", "子", "丑"];
  const hotMonths = ["巳", "午", "未"];
  if (coldMonths.includes(monthBranch) && (stemEl === "火")) tiaohou = 1;
  if (hotMonths.includes(monthBranch) && (stemEl === "水")) tiaohou = 1;

  // 5. 综合评分
  const totalScore = touchu * 0.4 + tenGodScore * 0.25 + chongHe * 0.2 + tiaohou * 0.1;
  const tone = totalScore >= 1 ? "supportive" : totalScore <= -1 ? "challenging" : "mixed";
  const breakdown = `透出${touchu > 0 ? '+' : ''}${touchu}×40% 十神${tenGodScore > 0 ? '+' : ''}${tenGodScore}×25% 冲合${chongHe > 0 ? '+' : ''}${chongHe}×20% 调候${tiaohou > 0 ? '+' : ''}${tiaohou}×10% = ${totalScore.toFixed(1)}`;

  return { tone, score: totalScore, breakdown };
}

function renderAnnualDetail(a: { year: number; age: number; ganZhi: string; analysis: FlowAnalysis }, dayElement?: Element, isStrong?: boolean, monthBranch?: string): string {
  const corrected = (dayElement && isStrong !== undefined && monthBranch)
    ? computeCorrectedTone(a.ganZhi, dayElement, isStrong, monthBranch, a.analysis)
    : null;

  const dims = [
    { key: "overall", label: "整体", icon: "🔮" },
    { key: "career", label: "事业", icon: "💼" },
    { key: "relationships", label: "感情", icon: "❤️" },
    { key: "health", label: "健康", icon: "🏥" },
    { key: "wealth", label: "财富", icon: "💰" }
  ];

  const dimSections = dims.map(d => {
    const dim = (a.analysis as Record<string, { tone: string; summary: string[] }>)[d.key];
    if (!dim) return "";
    const summaries = pickReportLines(dim.summary, d.key === "overall" ? 2 : 1);
    return `
      <div class="annual-dim ${dim.tone}">
        <div class="annual-dim-header">
          <span class="dim-icon">${d.icon}</span>
          <span class="dim-label">${d.label}</span>
          ${toneLabel(dim.tone)}
        </div>
        <ul class="dim-details">
          ${summaries.map(s => `<li>${s}</li>`).join("")}
        </ul>
      </div>`;
  }).join("");

  const signals = pickSignalTags(a.analysis.signals || [], 4);
  const signalHtml = signals.length > 0 ? `
    <div class="annual-signals">
      <h5>触发信号</h5>
      <div class="signal-list">
        ${signals.map(s => `<span class="signal-tag ${s.tone}" title="${s.description}">${s.type}</span>`).join("")}
      </div>
    </div>` : "";

  const overallTone = corrected ? corrected.tone : a.analysis.overall.tone;
  const breakdownHtml = corrected ? `<div class="score-breakdown"><span class="score-value">${corrected.score >= 0 ? '+' : ''}${corrected.score.toFixed(1)}</span> <span class="score-formula">${corrected.breakdown}</span></div>` : "";

  return `
    <details class="annual-detail">
      <summary class="annual-summary">
        <span class="annual-year">${a.year}</span>
        <span class="annual-age">${a.age}岁</span>
        <span class="ganzhi">${a.ganZhi}</span>
        <span class="annual-tones">
          ${toneLabel(overallTone)}
          ${toneLabel(a.analysis.career.tone)}
          ${toneLabel(a.analysis.relationships.tone)}
          ${toneLabel(a.analysis.health.tone)}
          ${toneLabel(a.analysis.wealth.tone)}
        </span>
      </summary>
      <div class="annual-expanded">
        ${breakdownHtml}
        ${signalHtml}
        <div class="annual-dims-grid">
          ${dimSections}
        </div>
      </div>
    </details>`;
}

function renderLuckCycleDetails(profile: BaziProfile, dayElement: Element, isStrong: boolean): string {
  const monthBranch = profile.chart.pillars[1].branch.value;
  const sections = profile.luckCycles.cycles.map(cycle => {
    const annualItems = cycle.annuals.map(a => renderAnnualDetail(a, dayElement, isStrong, monthBranch)).join("");

    return `
      <details class="cycle-detail">
        <summary>
          第${cycle.index}运 <span class="ganzhi">${cycle.ganZhi}</span>
          （${cycle.startAge}-${cycle.endAge}岁，${cycle.startYear}-${cycle.endYear}）
          ${toneLabel(cycle.analysis.overall.tone)}
        </summary>
        <div class="cycle-analysis">
          <div class="cycle-dims">
            <div class="cycle-dim"><span class="dim-icon">🔮</span><strong>整体</strong> ${toneLabel(cycle.analysis.overall.tone)}：${pickReportLines(cycle.analysis.overall.summary, 2).join(" ")}</div>
            <div class="cycle-dim"><span class="dim-icon">💼</span><strong>事业</strong> ${toneLabel(cycle.analysis.career.tone)}：${summarizeDimension(cycle.analysis.career.summary)}</div>
            <div class="cycle-dim"><span class="dim-icon">❤️</span><strong>感情</strong> ${toneLabel(cycle.analysis.relationships.tone)}：${summarizeDimension(cycle.analysis.relationships.summary)}</div>
            <div class="cycle-dim"><span class="dim-icon">🏥</span><strong>健康</strong> ${toneLabel(cycle.analysis.health.tone)}：${summarizeDimension(cycle.analysis.health.summary)}</div>
            <div class="cycle-dim"><span class="dim-icon">💰</span><strong>财富</strong> ${toneLabel(cycle.analysis.wealth.tone)}：${summarizeDimension(cycle.analysis.wealth.summary)}</div>
          </div>
        </div>
        <div class="annual-list">
          <div class="annual-list-header">
            <span>年份</span><span>年龄</span><span>干支</span>
            <span>整体 / 事业 / 感情 / 健康 / 财富</span>
          </div>
          ${annualItems}
        </div>
      </details>`;
  }).join("");

  return `<div class="card"><h2>大运流年详情</h2><p class="hint">点击每一年可展开查看各维度详细分析和触发信号</p>${sections}</div>`;
}

function renderPersonality(profile: BaziProfile, scores: ElementScores, favorable: FavorableElements): string {
  const dm = profile.chart.dayMaster;
  const dayBranch = profile.chart.pillars[2].branch.value;
  const diShi = profile.chart.pillars[2].diShi;
  const dist = profile.tenGodDistribution;

  const dayMasterInfo: Record<string, { symbol: string; nature: string; positive: string; negative: string; style: string }> = {
    "甲": { symbol: "参天大树", nature: "阳木", positive: "正直、有主见、有担当、目标明确", negative: "固执、不易变通、过于直接", style: "领导者型——先定方向再行动，宁折不弯" },
    "乙": { symbol: "花草藤蔓", nature: "阴木", positive: "柔韧、灵活、善于适应、有亲和力", negative: "决断力弱、容易依附、缺乏主见", style: "协调者型——善于绕道前行，以柔克刚" },
    "丙": { symbol: "太阳烈火", nature: "阳火", positive: "热情、开朗、慷慨、有感染力和号召力", negative: "急躁、不持久、容易过度消耗", style: "表演者型——自带光环，喜欢被关注" },
    "丁": { symbol: "灯烛星光", nature: "阴火", positive: "细腻、敏锐、专注、有洞察力和持久力", negative: "多虑、内耗、不易释怀", style: "分析者型——深入钻研，追求极致" },
    "戊": { symbol: "高山大地", nature: "阳土", positive: "厚重、稳定、包容、值得信赖、有格局", negative: "固执、迟钝、不够灵活、难以改变", style: "守护者型——不动如山，以稳制变" },
    "己": { symbol: "田园沃土", nature: "阴土", positive: "温和、务实、善于养育、有耐心、接地气", negative: "优柔寡断、过于退让、缺乏野心", style: "服务者型——默默付出，水到渠成" },
    "庚": { symbol: "刀剑钢铁", nature: "阳金", positive: "果断、锐利、执行力强、重义气、有魄力", negative: "刚愎自用、不近人情、过于强势", style: "行动者型——说干就干，斩钉截铁" },
    "辛": { symbol: "珠宝首饰", nature: "阴金", positive: "精致、讲究、审美高、善于表达、有品位", negative: "挑剔、矫情、过于敏感、容易受伤", style: "鉴赏者型——追求精致，注重细节" },
    "壬": { symbol: "江河大海", nature: "阳水", positive: "智慧、深广、足智多谋、有远见、包容万物", negative: "不安定、难以聚焦、过于多变", style: "策略者型——善于谋划，运筹帷幄" },
    "癸": { symbol: "雨露溪流", nature: "阴水", positive: "聪明、细腻、感受力强、直觉好、滋养他人", negative: "多愁善感、缺乏行动力、容易消极", style: "感受者型——心思缜密，善解人意" }
  };

  const info = dayMasterInfo[dm.value];

  // 十神性格分析 - 带权重计算
  const biJie = (dist.counts["比肩"] ?? 0) + (dist.counts["劫财"] ?? 0);
  const shiShang = (dist.counts["食神"] ?? 0) + (dist.counts["伤官"] ?? 0);
  const caiXing = (dist.counts["正财"] ?? 0) + (dist.counts["偏财"] ?? 0);
  const guanSha = (dist.counts["正官"] ?? 0) + (dist.counts["七杀"] ?? 0);
  const yinXing = (dist.counts["正印"] ?? 0) + (dist.counts["偏印"] ?? 0);
  const totalTenGods = biJie + shiShang + caiXing + guanSha + yinXing;

  const tenGodWeights = [
    { name: "比劫", count: biJie, pct: totalTenGods > 0 ? Math.round(biJie / totalTenGods * 100) : 0, traits: "独立、竞争、自我主张", detail: "比肩=同性相助（合作中的竞争），劫财=异性相夺（主动争取）" },
    { name: "食伤", count: shiShang, pct: totalTenGods > 0 ? Math.round(shiShang / totalTenGods * 100) : 0, traits: "表达、创造、享受", detail: "食神=温和输出（享受过程），伤官=锐利表达（追求极致）" },
    { name: "财星", count: caiXing, pct: totalTenGods > 0 ? Math.round(caiXing / totalTenGods * 100) : 0, traits: "务实、经营、资源", detail: "正财=稳定收入（踏实积累），偏财=灵活运作（投资经营）" },
    { name: "官杀", count: guanSha, pct: totalTenGods > 0 ? Math.round(guanSha / totalTenGods * 100) : 0, traits: "责任、压力、约束", detail: "正官=秩序规则（自律），七杀=外部压力（被推着走）" },
    { name: "印星", count: yinXing, pct: totalTenGods > 0 ? Math.round(yinXing / totalTenGods * 100) : 0, traits: "学习、支持、保护", detail: "正印=正统学习（系统性），偏印=偏门灵感（非主流思路）" }
  ].sort((a, b) => b.count - a.count);

  const tenGodRows = tenGodWeights.map(t => {
    const barWidth = totalTenGods > 0 ? (t.count / totalTenGods * 100) : 0;
    const level = t.pct >= 30 ? "dominant" : t.pct >= 20 ? "" : "weak";
    return `
      <tr class="${level}">
        <td>${t.name}</td>
        <td>${t.count}</td>
        <td>${t.pct}%</td>
        <td><div class="mini-bar"><div class="mini-bar-fill" style="width:${barWidth}%"></div></div></td>
        <td>${t.traits}</td>
      </tr>`;
  }).join("");

  // 性格综合画像 - 基于多维度
  const personalityTraits: Array<{ dimension: string; weight: string; analysis: string; formula: string }> = [];

  // 维度1: 日主本性 (30%)
  personalityTraits.push({
    dimension: "日主本性",
    weight: "30%",
    analysis: info ? `${info.nature}（${info.symbol}）→ ${info.style}` : "",
    formula: "日干五行 + 阴阳属性 → 基础性格底色"
  });

  // 维度2: 身旺身弱 (20%)，展示用的比例仍取自总分值，但 scores.isStrong 已与
  // profile.strength（得令/得地/得势三维细判）同源，不再是固定阈值判定。
  const strengthRatio = scores.strongValue / (scores.strongValue + scores.weakValue);
  personalityTraits.push({
    dimension: "身强弱度",
    weight: "20%",
    analysis: scores.isStrong
      ? `${profile.strength.level}（扶抵力占比${Math.round(profile.strength.supportRatio * 100)}%）→ 自信、执行力强、不易动摇、容易固执`
      : `${profile.strength.level}（扶抵力占比${Math.round(profile.strength.supportRatio * 100)}%）→ 灵活、善借力、需支持、容易犹豫`,
    formula: "身强值 = 比劫分 + 印星分；旺衰结论以得令/得地/得势三维细判为准"
  });

  // 维度3: 十神主轴 (25%)
  const dominant = tenGodWeights[0];
  const secondary = tenGodWeights[1];
  personalityTraits.push({
    dimension: "十神主轴",
    weight: "25%",
    analysis: `第一主轴「${dominant.name}」(${dominant.pct}%) + 第二主轴「${secondary.name}」(${secondary.pct}%) → 性格色彩由此组合决定`,
    formula: "各类十神出现次数 / 总十神数 → 占比最高者为主轴"
  });

  // 维度4: 日支（内心世界）(15%)
  const dayBranchTenGods = profile.chart.pillars[2].branch.hiddenStems.map(h => h.tenGod).join("、");
  personalityTraits.push({
    dimension: "日支内心",
    weight: "15%",
    analysis: `日支${dayBranch}（藏${dayBranchTenGods}）坐${diShi}位 → 内心深处的需求和伴侣期待`,
    formula: "日支藏干十神 = 潜意识需求；地势 = 内在能量状态"
  });

  // 维度5: 冲合动态 (10%)
  const clashes = profile.relations.filter(r => ["六冲", "六害", "相刑"].includes(r.type));
  const combines = profile.relations.filter(r => ["六合", "三合", "三会", "天干五合"].includes(r.type));
  personalityTraits.push({
    dimension: "冲合动态",
    weight: "10%",
    analysis: `合${combines.length}个 / 冲刑害${clashes.length}个 → ${clashes.length > combines.length ? "动态型性格，变动多、闲不住" : clashes.length === 0 ? "静态型性格，稳定安逸" : "动静结合"}`,
    formula: "冲刑害数 > 合数 → 好动；反之 → 安稳"
  });

  const formulaRows = personalityTraits.map(t => `
    <tr>
      <td>${t.dimension}</td>
      <td>${t.weight}</td>
      <td>${t.analysis}</td>
      <td class="formula-cell">${t.formula}</td>
    </tr>`).join("");

  // 详细性格描述
  const detailSections: string[] = [];

  if (info) {
    detailSections.push(`
      <div class="personality-detail">
        <h4>日主「${dm.value}」—— ${info.symbol}</h4>
        <div class="trait-grid">
          <div class="trait-item positive"><span class="trait-label">优势</span>${info.positive}</div>
          <div class="trait-item negative"><span class="trait-label">阴影</span>${info.negative}</div>
          <div class="trait-item style"><span class="trait-label">行事风格</span>${info.style}</div>
        </div>
      </div>`);
  }

  // 身旺弱对性格的具体影响
  if (scores.isStrong) {
    detailSections.push(`
      <div class="personality-detail">
        <h4>身旺特征（强度 ${Math.round(strengthRatio * 100)}%）</h4>
        <ul>
          <li><strong>决策风格</strong>：倾向先做再想，执行力强但可能忽略他人意见</li>
          <li><strong>社交模式</strong>：选择性社交，重视对等关系，不轻易示弱</li>
          <li><strong>抗压能力</strong>：高。外部压力不容易击垮你，但可能忽视身体信号</li>
          <li><strong>核心课题</strong>：学会倾听、适当示弱、接纳不同观点</li>
        </ul>
      </div>`);
  } else {
    detailSections.push(`
      <div class="personality-detail">
        <h4>身弱特征（强度 ${Math.round(strengthRatio * 100)}%）</h4>
        <ul>
          <li><strong>决策风格</strong>：倾向深思熟虑，善于借力但可能错过时机</li>
          <li><strong>社交模式</strong>：善于维护关系，有亲和力，但容易被消耗</li>
          <li><strong>抗压能力</strong>：中等。需要支持系统（贵人、平台），孤军奋战容易疲劳</li>
          <li><strong>核心课题</strong>：建立自信、敢于拒绝、减少对外部认可的依赖</li>
        </ul>
      </div>`);
  }

  // 十神组合性格描述
  const comboDescriptions: string[] = [];
  if (dominant.name === "比劫" && dominant.pct >= 25) {
    comboDescriptions.push(`<li><strong>比劫主导(${dominant.pct}%)</strong>：独立意识极强。宁可自己多走弯路，也不愿照别人的路线走。表面随和但内心有明确的评判标准。朋友不多但每个都深交。</li>`);
  }
  if (dominant.name === "食伤" || (secondary.name === "食伤" && secondary.pct >= 20)) {
    const shiPct = tenGodWeights.find(t => t.name === "食伤")!.pct;
    comboDescriptions.push(`<li><strong>食伤活跃(${shiPct}%)</strong>：天生的创作者和表达者。对品质有追求，做事讲究"调性"。享受从零到一的过程快感。有口福和审美力。</li>`);
  }
  if (dominant.name === "官杀" || (secondary.name === "官杀" && secondary.pct >= 20)) {
    const guanPct = tenGodWeights.find(t => t.name === "官杀")!.pct;
    comboDescriptions.push(`<li><strong>官杀压力(${guanPct}%)</strong>：对自己要求高，责任感重。在压力下反而发挥好。但容易给自己太大负担，需要学会放松和"够好就行"。</li>`);
  }
  if (dominant.name === "财星" || (secondary.name === "财星" && secondary.pct >= 20)) {
    const caiPct = tenGodWeights.find(t => t.name === "财星")!.pct;
    comboDescriptions.push(`<li><strong>财星务实(${caiPct}%)</strong>：天生的资源整合者。对"值不值"有直觉判断力。做事看结果，不做无意义的消耗。</li>`);
  }
  if (dominant.name === "印星" || (secondary.name === "印星" && secondary.pct >= 20)) {
    const yinPct = tenGodWeights.find(t => t.name === "印星")!.pct;
    comboDescriptions.push(`<li><strong>印星好学(${yinPct}%)</strong>：学习吸收力极强，接受新事物快。有人缘和贵人运。但容易"想太多做太少"，需要食伤来推动输出。</li>`);
  }

  if (comboDescriptions.length > 0) {
    detailSections.push(`
      <div class="personality-detail">
        <h4>十神性格色彩</h4>
        <ul>${comboDescriptions.join("")}</ul>
      </div>`);
  }

  // 冲合对性格的影响
  if (clashes.length > 0 || combines.length > 0) {
    const dynamicTraits: string[] = [];
    if (clashes.length >= 2) dynamicTraits.push("内心躁动、闲不住、需要变化和新刺激");
    if (clashes.length === 1) dynamicTraits.push("有动态因子但可控，适度变化中成长");
    if (combines.length >= 2) dynamicTraits.push("善于建立连接、有合作天赋、容易被人牵动");
    const dayBranchClash = clashes.find(r => r.members.includes(dayBranch));
    if (dayBranchClash) dynamicTraits.push(`日支逢${dayBranchClash.type}——亲密关系中容易有摩擦和波动`);

    detailSections.push(`
      <div class="personality-detail">
        <h4>冲合对性格的塑造</h4>
        <p>命盘中 ${combines.length} 合 / ${clashes.length} 冲刑害：</p>
        <ul>${dynamicTraits.map(t => `<li>${t}</li>`).join("")}</ul>
      </div>`);
  }

  // 喜好与生活偏好
  const prefSections = `
    <div class="personality-detail">
      <h4>生活喜好推导</h4>
      <table class="pref-table">
        <tr><th>维度</th><th>偏好</th><th>推导逻辑</th></tr>
        <tr><td>做事风格</td><td>${scores.isStrong ? "先做后想、追求效率" : "深思熟虑、追求稳妥"}</td><td>身${scores.isStrong ? "旺" : "弱"} → ${scores.isStrong ? "执行力导向" : "安全感导向"}</td></tr>
        <tr><td>学习方式</td><td>${shiShang >= biJie ? "动手型——做中学最快" : yinXing >= 2 ? "吸收型——读书听课效率高" : "混合型"}</td><td>${shiShang >= biJie ? "食伤≥比劫 → 输出即学习" : yinXing >= 2 ? "印星≥2 → 被动接收型" : "均衡分布"}</td></tr>
        <tr><td>社交风格</td><td>${biJie >= 3 ? "少而精，重质不重量" : caiXing >= 3 ? "广而浅，资源型社交" : "选择性社交"}</td><td>${biJie >= 3 ? "比劫≥3 → 独立型社交" : caiXing >= 3 ? "财星≥3 → 经营型社交" : "无极端偏向"}</td></tr>
        <tr><td>消费偏好</td><td>${shiShang >= 2 ? "追求品质和体验" : caiXing >= 3 ? "注重性价比和回报" : "量入为出"}</td><td>${shiShang >= 2 ? "食伤旺 → 品质导向" : caiXing >= 3 ? "财星旺 → 投资导向" : "中性"}</td></tr>
        <tr><td>适合方向</td><td>${[...favorable.most, ...favorable.good].map(e => elSpan(e)).join(" ")} 相关</td><td>喜用神五行 → 对应行业和环境</td></tr>
        <tr><td>颜色方位</td><td>${[...favorable.most, ...favorable.good].map(e => `<span style="color:${ELEMENT_COLOR[e]}">${e}</span>`).join(" ")} / ${[...favorable.most, ...favorable.good].map(e => ({"木":"东","火":"南","土":"中","金":"西","水":"北"}[e])).join("")}</td><td>喜用五行 → 对应颜色和方位</td></tr>
      </table>
    </div>`;

  return `
    <div class="card">
      <h2>性格深度分析</h2>

      <div class="methodology-box">
        <h3>分析方法论</h3>
        <p>性格由以下五个维度综合推导，各维度带权重：</p>
        <table class="method-table">
          <tr><th>维度</th><th>权重</th><th>本命分析</th><th>计算公式</th></tr>
          ${formulaRows}
        </table>
      </div>

      <div class="personality-section">
        <h3>十神占比分布</h3>
        <table class="tengod-weight-table">
          <tr><th>类别</th><th>次数</th><th>占比</th><th>强度</th><th>性格关键词</th></tr>
          ${tenGodRows}
        </table>
        <p class="note">注：占比≥30%为主导（高亮），≥20%为显著，＜15%为偏弱。十神细分含义见右列。</p>
      </div>

      ${detailSections.join("")}
      ${prefSections}
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

function renderAiChat(): string {
  return `
    <div class="card ai-chat-card">
      <h2>AI 命理问询</h2>
      <p class="hint">基于你的命盘数据，向 AI 提问关于运势、选择、性格等任何命理相关问题。</p>
      <details class="ai-config">
        <summary>API 设置</summary>
        <div class="ai-config-content">
          <label>API Key（留空则使用本地代理）
            <input type="password" id="ai-api-key" placeholder="留空 = 本地 friday-proxy" />
          </label>
          <label style="margin-top:0.5rem;display:block">API 地址
            <input type="text" id="ai-api-url" placeholder="http://127.0.0.1:3456/friday-thinking-highTemp" value="http://127.0.0.1:3456/friday-thinking-highTemp" />
          </label>
          <label style="margin-top:0.5rem;display:block">模型
            <input type="text" id="ai-model" placeholder="claude-opus-4-6" value="claude-opus-4-6" />
          </label>
        </div>
      </details>
      <div class="ai-chat-messages" id="ai-messages">
        <div class="ai-msg system">排盘完成后可以在这里提问，AI 会结合你的命盘数据回答。</div>
      </div>
      <div class="ai-input-row">
        <input type="text" id="ai-input" placeholder="问一下：今年适合换工作吗？/ 我的性格适合做什么？" />
        <button id="ai-send-btn">发送</button>
      </div>
    </div>`;
}

function renderCombinations(combos: TenGodCombination[]): string {
  if (combos.length === 0) return "";

  const items = combos.map(c => `
    <details class="combo-item">
      <summary>
        <span class="combo-name">${c.type}</span>
        <span class="combo-strength">力度 ${'●'.repeat(Math.round(c.strength / 2))}${'○'.repeat(5 - Math.round(c.strength / 2))}</span>
      </summary>
      <div class="combo-details">
        <div class="combo-dim"><span class="dim-icon">🧠</span><strong>性格</strong><p>${c.personality}</p></div>
        <div class="combo-dim"><span class="dim-icon">💼</span><strong>事业</strong><p>${c.career}</p></div>
        <div class="combo-dim"><span class="dim-icon">❤️</span><strong>感情</strong><p>${c.relationship}</p></div>
        <div class="combo-dim"><span class="dim-icon">⚠️</span><strong>风险</strong><p>${c.risk}</p></div>
      </div>
    </details>`).join("");

  return `
    <div class="card">
      <h2>十神组合分析</h2>
      <p class="hint">十神不是孤立的标签——组合决定了你的行为模式和人生主题。点击展开查看详情。</p>
      ${items}
    </div>`;
}

function renderDayBranch(analysis: DayBranchAnalysis): string {
  return `
    <div class="card">
      <h2>日支深度分析（配偶宫·内心世界）</h2>
      <table class="info-table">
        <tr><td>日支</td><td>${analysis.branch}（${analysis.element}）</td></tr>
        <tr><td>地势</td><td>${analysis.diShi}</td></tr>
        <tr><td>阳刃</td><td>${analysis.isYangRen ? '<span class="tone-bad">是 — 对配偶缺乏耐心</span>' : '否'}</td></tr>
        <tr><td>藏干十神</td><td>${analysis.hiddenTenGods.join("、")}</td></tr>
      </table>
      <div class="personality-detail" style="margin-top:1rem">
        <h4>配偶宫解读</h4>
        <p>${analysis.spousePalace}</p>
      </div>
      <div class="personality-detail">
        <h4>内心世界（${analysis.diShi}位）</h4>
        <p>${analysis.innerWorld}</p>
      </div>
      <div class="personality-detail">
        <h4>冲合风险</h4>
        <p>${analysis.clashRisk}</p>
      </div>
    </div>`;
}

function renderElementFlow(chains: ElementFlowChain[]): string {
  if (chains.length === 0) return "";

  const items = chains.map(c => `
    <div class="flow-chain ${c.isPositive ? 'flow-positive' : 'flow-negative'}">
      <div class="flow-type">${c.isPositive ? '✓' : '✗'} ${c.type}</div>
      <div class="flow-path">${c.chain}</div>
      <div class="flow-desc">${c.description}</div>
    </div>`).join("");

  return `
    <div class="card">
      <h2>五行流通分析</h2>
      <p class="hint">五行不是静态的数量对比——关键看能量是否形成流通链路。</p>
      ${items}
    </div>`;
}

function renderLuckCycleLayered(profile: BaziProfile, isStrong: boolean): string {
  const rows = profile.luckCycles.cycles.map(c => {
    const layers = analyzeLuckCycleLayers(c.ganZhi, profile.chart.dayMaster, isStrong);
    return `
      <tr>
        <td>${c.index}</td>
        <td class="ganzhi">${c.ganZhi}</td>
        <td>${c.startAge}-${c.endAge}</td>
        <td class="${layers.stemIsPositive ? 'check-pass' : 'tone-bad'}">${layers.stemTenGod}(${layers.stemElement})</td>
        <td class="${layers.branchIsPositive ? 'check-pass' : 'tone-bad'}">${layers.branchElement}</td>
        <td style="font-size:0.8rem">${layers.stemAnalysis}</td>
      </tr>`;
  }).join("");

  return `
    <div class="card">
      <h2>大运分层分析</h2>
      <p class="hint">天干主前5年（明面主题），地支主后5年（底层环境）。透出力量 &gt; 暗藏力量。</p>
      <table class="luck-table">
        <tr><th>运</th><th>干支</th><th>年龄</th><th>天干(前5年)</th><th>地支(后5年)</th><th>分析</th></tr>
        ${rows}
      </table>
    </div>`;
}

function renderPortrait(profile: BaziProfile, scores: ElementScores, combos: TenGodCombination[]): string {
  const dm = profile.chart.dayMaster;
  const diShi = profile.chart.pillars[2].diShi;
  const dayMasterNames: Record<string, string> = {
    "甲": "参天大树", "乙": "花草藤蔓", "丙": "太阳烈火", "丁": "灯烛星光",
    "戊": "高山大地", "己": "田园沃土", "庚": "刀剑钢铁", "辛": "珠宝首饰",
    "壬": "江河大海", "癸": "雨露溪流"
  };
  const symbol = dayMasterNames[dm.value] || "";
  const comboNames = combos.map(c => c.type).join("、");
  const clashes = profile.relations.filter(r => ["六冲","六害","相刑"].includes(r.type));

  const portrait = scores.isStrong
    ? `${dm.value}${dm.element}身旺——${symbol}之象。内在能量充沛，自信到固执的程度。坐${diShi}位，根基极稳。`
    : `${dm.value}${dm.element}身弱——${symbol}之象。柔韧善借力，需要外部支持才能发挥最大价值。`;

  const dynamicDesc = clashes.length >= 2
    ? "命盘动态极强——冲合交织，一生闲不住，变动多、经历多。"
    : clashes.length === 1
    ? "命盘有动态因子，适度变化中成长。"
    : "命盘相对安定，偏向稳扎稳打。";

  return `
    <div class="card portrait-card">
      <h2>人物画像</h2>
      <div class="portrait-main">
        <div class="portrait-symbol">${dm.value}</div>
        <div class="portrait-text">
          <p class="portrait-line">${portrait}</p>
          <p class="portrait-line">${dynamicDesc}</p>
          ${comboNames ? `<p class="portrait-combo">核心组合：${comboNames}</p>` : ""}
        </div>
      </div>
    </div>`;
}

function renderKeyYears(profile: BaziProfile, dayElement: Element, isStrong: boolean): string {
  const monthBranch = profile.chart.pillars[1].branch.value;
  const allAnnuals: Array<{year:number; age:number; ganZhi:string; analysis:FlowAnalysis; cycleGz:string}> = [];

  for (const cycle of profile.luckCycles.cycles) {
    for (const a of cycle.annuals) {
      allAnnuals.push({...a, cycleGz: cycle.ganZhi});
    }
  }

  const scored = allAnnuals.map(a => {
    const c = computeCorrectedTone(a.ganZhi, dayElement, isStrong, monthBranch, a.analysis);
    return { ...a, score: c.score, tone: c.tone, breakdown: c.breakdown };
  });

  const extreme = scored.filter(a => Math.abs(a.score) >= 1.2).sort((a, b) => Math.abs(b.score) - Math.abs(a.score)).slice(0, 12);

  if (extreme.length === 0) return "";

  const rows = extreme.map(a => {
    const icon = a.score >= 1.2 ? "🟢" : a.score <= -1.2 ? "🔴" : "🟡";
    const [stem] = [...a.ganZhi];
    const tenGod = computeTenGod(profile.chart.dayMaster.value, stem);
    return `
      <div class="key-year ${a.score > 0 ? 'key-positive' : 'key-negative'}">
        <div class="key-year-header">
          <span class="key-icon">${icon}</span>
          <span class="key-info"><strong>${a.year}年</strong>（${a.age}岁）${a.ganZhi} · ${tenGod}</span>
          <span class="key-score">${a.score >= 0 ? '+' : ''}${a.score.toFixed(1)}</span>
        </div>
        <div class="key-year-detail">
          <p>${a.analysis.overall.summary[0] || ''}</p>
          <p class="score-formula">${a.breakdown}</p>
        </div>
      </div>`;
  }).join("");

  return `
    <div class="card">
      <h2>关键年份（需要特别注意）</h2>
      <p class="hint">不分好坏——无论得分正负，这些年份都需要你主动做出应对。好年是兑现窗口，差年是成长催化剂。</p>
      ${rows}
    </div>`;
}

function renderLifeRhythm(profile: BaziProfile, isStrong: boolean): string {
  const cycles = profile.luckCycles.cycles;
  const monthBranch = profile.chart.pillars[1].branch.value;
  const dayElement = profile.chart.dayMaster.element;

  const rows = cycles.map(c => {
    const corrected = computeCorrectedTone(c.ganZhi, dayElement, isStrong, monthBranch, c.analysis);
    const layers = analyzeLuckCycleLayers(c.ganZhi, profile.chart.dayMaster, isStrong);
    const barClass = corrected.tone === "supportive" ? "rhythm-good" : corrected.tone === "challenging" ? "rhythm-bad" : "rhythm-mid";
    return `
      <div class="rhythm-row">
        <div class="rhythm-age">${c.startAge}-${c.endAge}岁</div>
        <div class="rhythm-bar-wrap">
          <div class="rhythm-bar ${barClass}"></div>
        </div>
        <div class="rhythm-gz ganzhi">${c.ganZhi}</div>
        <div class="rhythm-desc">${layers.stemTenGod}(${layers.stemIsPositive ? '喜' : '忌'}) · ${c.analysis.overall.summary[0]?.substring(0, 25) || ''}</div>
      </div>`;
  }).join("");

  return `
    <div class="card">
      <h2>终生节奏</h2>
      <p class="hint">绿=用神透出期（顺），红=忌神透出期（逆），灰=中性。</p>
      <div class="rhythm-chart">${rows}</div>
    </div>`;
}

function renderRelationshipWindow(profile: BaziProfile, dayElement: Element, isStrong: boolean): string {
  const dm = profile.chart.dayMaster;
  const dayBranchAnalysis = analyzeDayBranch(profile);
  const gender = profile.input.gender;
  const relationshipSummary = summarizeDimension(profile.analysis.relationships) || dayBranchAnalysis.spousePalace;

  const targetTenGods = gender === "male" ? ["正财", "偏财"] : ["正官", "七杀"];
  const windows: string[] = [];

  for (const cycle of profile.luckCycles.cycles) {
    for (const a of cycle.annuals) {
      const [stem] = [...a.ganZhi];
      const tenGod = computeTenGod(dm.value, stem);
      if (targetTenGods.includes(tenGod)) {
        windows.push(`${a.year}年(${a.age}岁) ${a.ganZhi} — ${tenGod}透出`);
      }
    }
  }

  return `
    <div class="card">
      <h2>感情专项</h2>
      <div class="personality-detail">
        <h4>关系主线</h4>
        <p>${relationshipSummary}</p>
      </div>
      <div class="personality-detail">
        <h4>感情活跃窗口（${gender === "male" ? "财星" : "官星"}透出年）</h4>
        <ul>${windows.slice(0, 8).map(w => `<li>${w}</li>`).join("")}</ul>
      </div>
    </div>`;
}

function renderCareerPath(profile: BaziProfile, scores: ElementScores, favorable: FavorableElements): string {
  const dm = profile.chart.dayMaster;
  const dist = profile.tenGodDistribution;
  const shiShang = (dist.counts["食神"] ?? 0) + (dist.counts["伤官"] ?? 0);
  const guanSha = (dist.counts["正官"] ?? 0) + (dist.counts["七杀"] ?? 0);
  const caiXing = (dist.counts["正财"] ?? 0) + (dist.counts["偏财"] ?? 0);

  const directions: Array<{name: string; stars: number; reason: string}> = [];
  if (shiShang >= 2) directions.push({name: "创作/技术/表达", stars: 5, reason: "食伤泄秀=核心通道"});
  if (caiXing >= 2) directions.push({name: "经营/投资/商贸", stars: 4, reason: "财星活跃"});
  if (guanSha >= 2) directions.push({name: "管理/体制/法律", stars: 3, reason: "官杀制身"});
  if (directions.length === 0) directions.push({name: "综合发展", stars: 3, reason: "十神均衡"});

  const dirRows = directions.map(d => `<li><strong>${d.name}</strong> ${'⭐'.repeat(d.stars)} <span class="hint">${d.reason}</span></li>`).join("");

  const explosionYears: string[] = [];
  for (const cycle of profile.luckCycles.cycles) {
    for (const a of cycle.annuals) {
      const [stem] = [...a.ganZhi];
      const tenGod = computeTenGod(dm.value, stem);
      if (["食神", "伤官"].includes(tenGod) && scores.isStrong) {
        explosionYears.push(`${a.year}(${a.age}岁) ${a.ganZhi}`);
      }
    }
  }

  return `
    <div class="card">
      <h2>事业路径</h2>
      <div class="personality-detail">
        <h4>适合方向</h4>
        <ul>${dirRows}</ul>
      </div>
      ${explosionYears.length > 0 ? `
      <div class="personality-detail">
        <h4>事业爆发窗口（食伤透出年）</h4>
        <p class="hint">身旺命局，食伤透出=用神到位=出成绩的最佳时机</p>
        <ul>${explosionYears.slice(0, 10).map(y => `<li>${y}</li>`).join("")}</ul>
      </div>` : ""}
    </div>`;
}

export function renderReport(profile: BaziProfile): string {
  const scores = computeElementScores(profile);
  const dayElement = profile.chart.dayMaster.element;
  const favorable = judgeFavorable(dayElement, scores.isStrong);
  const combos = detectCombinations(profile, scores.isStrong);
  const dayBranch = analyzeDayBranch(profile);
  const flowChains = analyzeElementFlow(profile, scores.isStrong);

  return [
    // === 第一区：画像与性格（叙事优先）===
    renderNarrativeAnalysis(profile),
    renderPortrait(profile, scores, combos),
    renderPersonality(profile, scores, favorable),
    renderCombinations(combos),

    // === 第二区：命盘结构 ===
    renderBasicInfo(profile),
    renderPillars(profile),
    renderElementScores(scores, dayElement),
    renderStrengthJudgment(profile, scores),
    renderFavorable(dayElement, favorable, scores.isStrong),

    // === 第三区：人生主题 ===
    renderRelationshipWindow(profile, dayElement, scores.isStrong),
    renderCareerPath(profile, scores, favorable),
    renderDayBranch(dayBranch),
    renderElementFlow(flowChains),

    // === 第四区：运势时间线 ===
    renderLifeRhythm(profile, scores.isStrong),
    renderKeyYears(profile, dayElement, scores.isStrong),
    renderLuckCycleLayered(profile, scores.isStrong),
    renderLuckCyclesOverview(profile, dayElement, scores.isStrong),
    renderLuckCycleDetails(profile, dayElement, scores.isStrong),

    // === 第五区：速查 ===
    renderTenGods(profile),
    renderRelations(profile),
    renderLifetimeLookup(dayElement, favorable)
  ].join("");
}
