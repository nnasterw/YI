export type CalendarType = "solar" | "lunar";
export type Gender = "male" | "female";
export type Element = "木" | "火" | "土" | "金" | "水";
export type YinYang = "阴" | "阳";
export type PillarKey = "year" | "month" | "day" | "time";

export interface BaziInput {
  calendarType: CalendarType;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute?: number;
  second?: number;
  isLeapMonth?: boolean;
  gender: Gender;
  sect?: 1 | 2;
  luckSect?: 1 | 2;
  luckCycleCount?: number;
  annualCycleCount?: number;
  metadata?: {
    timezone?: string;
    notes?: string;
  };
}

export interface NormalizedBaziInput {
  calendarType: CalendarType;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  isLeapMonth: boolean;
  gender: Gender;
  sect: 1 | 2;
  luckSect?: 1 | 2;
  luckCycleCount: number;
  annualCycleCount: number;
  metadata?: {
    timezone?: string;
    notes?: string;
  };
}

export interface StemDetails {
  value: string;
  element: Element;
  yinYang: YinYang;
  tenGod: string;
}

export interface HiddenStemDetails {
  value: string;
  element: Element;
  yinYang: YinYang;
  tenGod: string;
}

export interface BranchDetails {
  value: string;
  element: Element;
  yinYang: YinYang;
  hiddenStems: HiddenStemDetails[];
  tenGods: string[];
}

export interface PillarDetails {
  key: PillarKey;
  ganZhi: string;
  stem: StemDetails;
  branch: BranchDetails;
  naYin: string;
  diShi: string;
  xun: string;
  xunKong: string;
}

export interface RelationRecord {
  category: "heavenly-stem" | "earthly-branch" | "five-element";
  type: string;
  members: string[];
  result?: string;
  description: string;
}

export interface ElementCount {
  visibleStems: number;
  hiddenStems: number;
  total: number;
}

export interface ElementBalance {
  counts: Record<Element, ElementCount>;
  strongest: Element[];
  weakest: Element[];
  observations: string[];
}

export interface TenGodDistribution {
  counts: Record<string, number>;
  dominant: string[];
  observations: string[];
}

export interface AnnualCycle {
  year: number;
  age: number;
  ganZhi: string;
  analysis: FlowAnalysis;
}

export interface LuckCycle {
  index: number;
  ganZhi: string;
  startYear: number;
  endYear: number;
  startAge: number;
  endAge: number;
  analysis: FlowAnalysis;
  annuals: AnnualCycle[];
}

export interface LuckCycles {
  startOffset: {
    years: number;
    months: number;
    days: number;
  };
  startSolar: string;
  direction: "forward" | "backward";
  cycles: LuckCycle[];
}

export interface BaziAnalysis {
  overview: string[];
  career: string[];
  relationships: string[];
  health: string[];
  wealth: string[];
}

export type AnalysisTone = "supportive" | "mixed" | "challenging";

export interface FlowSignal {
  category: "ten-god" | "element" | "branch-relation" | "cycle-link";
  type: string;
  tone: AnalysisTone;
  description: string;
  members: string[];
  result?: string;
}

export interface FlowDimensionAnalysis {
  tone: AnalysisTone;
  summary: string[];
}

export interface FlowAnalysis {
  signals: FlowSignal[];
  overall: FlowDimensionAnalysis;
  career: FlowDimensionAnalysis;
  relationships: FlowDimensionAnalysis;
  health: FlowDimensionAnalysis;
  wealth: FlowDimensionAnalysis;
}

export interface BaziProfile {
  input: NormalizedBaziInput;
  birth: {
    solar: string;
    lunar: string;
  };
  chart: {
    pillars: PillarDetails[];
    dayMaster: StemDetails & {
      ganZhi: string;
    };
    taiYuan: string;
    mingGong: string;
    shenGong: string;
  };
  relations: RelationRecord[];
  elementBalance: ElementBalance;
  tenGodDistribution: TenGodDistribution;
  luckCycles: LuckCycles;
  analysis: BaziAnalysis;
}
