import { describe, expect, it } from "vitest";
import { generateBaziProfile } from "../src/bazi";
import { renderReport } from "../web/src/renderer";

// 回归测试背景：renderLuckCyclesOverview（大运总览表格）、renderKeyYears（关键年份）、
// renderLifeRhythm（人生节奏）三处都用 computeCorrectedTone（40%透出+25%十神+
// 20%冲合刑害+10%调候）综合口径展示"整体"结论；renderLuckCycleDetails（点开
// 大运详情）与 renderAnnualDetail（点开流年详情）此前分别遗漏了这一统一，仍读
// 引擎原始 overall.tone，导致用户从总览点开同一个大运/流年时看到相反结论。
// 抽样显示大运层约 26% 的矛盾率、流年层同样存在。这里用批量真实样本端到端
// 渲染 HTML，断言总览表格与详情区块的"整体"tone 必须一致，防止两处口径再次分叉。
const TONE_CLASS_TO_KEY: Record<string, string> = {
  "tone-good": "supportive",
  "tone-bad": "challenging",
  "tone-mid": "mixed"
};

function samplesGrid(): Array<{ year: number; month: number; day: number; hour: number; gender: "male" | "female" }> {
  const samples: Array<{ year: number; month: number; day: number; hour: number; gender: "male" | "female" }> = [];
  const years = [1956, 1975, 1988, 1997, 1999, 2003, 2012];
  const months = [1, 4, 7, 11];
  const hours = [0, 7, 12, 16, 23];
  let i = 0;
  for (const year of years) {
    for (const month of months) {
      const day = 6 + (i % 20);
      const hour = hours[i % hours.length];
      const gender = i % 2 === 0 ? "male" : "female";
      samples.push({ year, month, day, hour, gender });
      i++;
    }
  }
  return samples;
}

describe("renderReport tone consistency", () => {
  it("大运总览表格与「大运流年详情」的整体tone必须一致", () => {
    for (const s of samplesGrid()) {
      const profile = generateBaziProfile({ calendarType: "solar", ...s, minute: 0 });
      const html = renderReport(profile);

      const overviewBlock = html.match(/<h2>大运总览<\/h2>[\s\S]*?<\/table>/)?.[0] ?? "";
      const overviewRows = [...overviewBlock.matchAll(
        /<td>(\d+)<\/td>\s*<td class="ganzhi">([^<]+)<\/td>[\s\S]*?<td><span class='(tone-\w+)'>/g
      )];
      expect(overviewRows.length).toBeGreaterThan(0);

      const detailBlock = html.match(/大运流年详情[\s\S]*/)?.[0] ?? "";
      const detailSummaries = [...detailBlock.matchAll(
        /第(\d+)运 <span class="ganzhi">([^<]+)<\/span>[\s\S]*?<span class='(tone-\w+)'>/g
      )];

      for (const [, idx, gz, ovToneClass] of overviewRows) {
        const detail = detailSummaries.find(d => d[1] === idx);
        expect(detail, `第${idx}运(${gz}) 应该在详情区块中找到对应 summary — 样本 ${JSON.stringify(s)}`).toBeTruthy();
        expect(
          detail![3],
          `第${idx}运(${gz}) 总览tone=${ovToneClass} 但详情summary tone=${detail![3]} — 样本 ${JSON.stringify(s)}`
        ).toBe(ovToneClass);
      }
    }
  });

  it("流年卡片顶部tone与展开后「整体」维度卡片tone必须一致", () => {
    for (const s of samplesGrid()) {
      const profile = generateBaziProfile({ calendarType: "solar", ...s, minute: 0 });
      const html = renderReport(profile);

      const annualBlocks = [...html.matchAll(/<details class="annual-detail">[\s\S]*?<\/details>/g)];
      expect(annualBlocks.length).toBeGreaterThan(0);

      for (const [block] of annualBlocks) {
        const topToneMatch = block.match(/<span class="annual-tones">\s*<span class='(tone-\w+)'>/);
        const dimOverallMatch = block.match(
          /<div class="annual-dim (\w+)">\s*<div class="annual-dim-header">\s*<span class="dim-icon">🔮/
        );
        expect(topToneMatch, `未找到顶部tone — 样本 ${JSON.stringify(s)}`).toBeTruthy();
        expect(dimOverallMatch, `未找到「整体」维度卡片 — 样本 ${JSON.stringify(s)}`).toBeTruthy();

        const topToneKey = TONE_CLASS_TO_KEY[topToneMatch![1]];
        const dimToneKey = dimOverallMatch![1];
        expect(
          dimToneKey,
          `顶部tone=${topToneMatch![1]}(${topToneKey}) 但「整体」维度卡片tone=${dimToneKey} — 样本 ${JSON.stringify(s)}`
        ).toBe(topToneKey);
      }
    }
  });
});
