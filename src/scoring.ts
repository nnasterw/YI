import { HIDDEN_STEM_WEIGHTS, MONTH_ELEMENT_STATE, STEM_META } from "./constants";
import type { Element, PillarDetails } from "./types";

export interface ElementScores {
  counts: Record<Element, number>;
  strongest: Element[];
  weakest: Element[];
  strongValue: number;
  weakValue: number;
  isStrong: boolean;
}

const GENERATING: Record<Element, Element> = { "木": "水", "火": "木", "土": "火", "金": "土", "水": "金" };

export function computeStrength(pillars: PillarDetails[], dayElement: Element): ElementScores {
  const counts: Record<Element, number> = { "木": 0, "火": 0, "土": 0, "金": 0, "水": 0 };

  for (const pillar of pillars) {
    counts[pillar.stem.element] += 5;
  }

  const branches = pillars.map(p => p.branch.value);
  const monthBranch = pillars[1].branch.value;
  const allBranches = [...branches, monthBranch];

  for (const branch of allBranches) {
    const weights = HIDDEN_STEM_WEIGHTS[branch];
    if (!weights) continue;
    for (const [stem, weight] of Object.entries(weights)) {
      counts[STEM_META[stem].element] += weight;
    }
  }

  const generating = GENERATING[dayElement];
  const strongValue = counts[dayElement] + counts[generating];
  const weakValue = Object.values(counts).reduce((a, b) => a + b, 0) - strongValue;
  const isStrong = strongValue > 29;

  const max = Math.max(...Object.values(counts));
  const min = Math.min(...Object.values(counts));
  const strongest = (Object.entries(counts) as [Element, number][])
    .filter(([, v]) => v === max).map(([e]) => e);
  const weakest = (Object.entries(counts) as [Element, number][])
    .filter(([, v]) => v === min).map(([e]) => e);

  return { counts, strongest, weakest, strongValue, weakValue, isStrong };
}

export function getMonthElementState(monthBranch: string, element: Element): string {
  return MONTH_ELEMENT_STATE[monthBranch]?.[element] || "";
}
