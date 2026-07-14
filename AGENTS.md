# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## 项目概述

四柱八字（BaZi）核心引擎，TypeScript 实现。输入阳历/农历出生时间，输出结构化命盘 JSON（四柱、十神、藏干、纳音、地势、旬空、五行分布、命盘关系、大运/流年序列及多维度解读）。

## 常用命令

```bash
npm run check          # 类型检查（tsc --noEmit）
npm run test           # 运行测试（vitest run）
npm run build          # 编译到 dist/（tsc）
npm run dev:cli -- ... # 开发时直接运行 CLI（tsx）
```

CLI 示例：
```bash
node dist/cli.js --calendar solar --year 2005 --month 12 --day 23 --hour 8 --minute 37 --gender male --pretty
```

## 架构

```
src/
  index.ts        — 库入口，导出 generateBaziProfile、buildFlowAnalysis、analyzeNatalRelations 及所有类型
  bazi.ts         — 主引擎：调 lunar-javascript 取八字原始数据 → 组装四柱 → 算大运/流年 → 生成 BaziProfile
  constants.ts    — 天干/地支元数据表、十神计算、五行生克关系、合冲刑害三合三会定义、共享关系匹配函数
  relations.ts    — 命盘关系检测：天干五合、地支六合/六冲/六害/三合/三会/相刑/自刑、五行交互
  analysis.ts     — 五行统计、十神分布、命盘叙事分析（buildNarrativeAnalysis）、流运分析（buildFlowAnalysis）
  input.ts        — 输入校验与默认值填充（normalizeBaziInput）
  types.ts        — 所有接口/类型定义
  cli.ts          — CLI 入口（parseArgs → generateBaziProfile → JSON 输出）
  vendor/lunar-javascript.d.ts — lunar-javascript 库的类型声明
```

### 数据流

`BaziInput` → `normalizeBaziInput` → `resolveChart`（Solar/Lunar → EightChar） → `buildPillar` ×4 → `analyzeNatalRelations` → `buildElementBalance` / `buildTenGodDistribution` → `buildNarrativeAnalysis` → `BaziProfile`

大运/流年：`EightChar.getYun()` → `buildLuckCycles` → 每个 cycle 包含 `AnnualCycle[]`。流运分析通过 `buildFlowAnalysis` 为每个大运/流年生成信号和多维度评分。

### 核心依赖

- **lunar-javascript**（本地 tgz）：农历/阳历转换、八字排盘底层计算。类型声明在 `src/vendor/lunar-javascript.d.ts`。

## 领域术语映射

| 代码概念 | 八字术语 |
|---------|--------|
| PillarDetails | 年柱/月柱/日柱/时柱 |
| dayMaster | 日主（日干） |
| StemDetails | 天干信息 |
| BranchDetails + hiddenStems | 地支 + 藏干 |
| tenGod | 十神 |
| naYin / diShi / xunKong | 纳音 / 地势（十二长生） / 旬空 |
| RelationRecord | 合冲刑害等关系记录 |
| FlowAnalysis / FlowSignal | 流运分析 / 流运信号 |
| taiYuan / mingGong / shenGong | 胎元 / 命宫 / 身宫 |

## OpenSpec

项目使用 OpenSpec 管理规范与变更。规范在 `spec/specs/`，变更提案在 `spec/changes/`。

## 注意事项

- lunar-javascript 的某些方法返回 `string[] | string`，用 `toStringArray()` 统一处理
- `sect` 参数控制子时划分规则（早子时/晚子时），默认值 2
- `buildFlowAnalysis` 已接入 `generateBaziProfile`，每个大运和流年都会自动生成分维度解读
- 所有中文术语（天干地支、十神名称等）在 constants.ts 中作为字面量类型使用
