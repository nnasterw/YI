# 四柱八字核心引擎

这个仓库当前专注在“四柱八字”第一阶段实现，目标是先做出一个可靠、可测试、可扩展的命盘内核，再逐步叠加更细的流年解读、长报告生成和多体系扩展。

## 当前能力

- 支持阳历/农历出生时间输入
- 生成四柱八字、日主、命宫、身宫、胎元
- 输出天干地支、藏干、十神、纳音、地势、旬空
- 统计五行与十神分布
- 检测命盘内的合、冲、刑、害、三合、三会等关系
- 计算起运时间与结构化大运/流年序列
- 为每个大运和流年生成分维度解读（overall / career / relationships / health / wealth）
- 识别流运与原局的十神、五行交互及冲合刑害信号
- 通过 CLI 输出结构化 JSON

## 快速开始

```bash
npm install
npm run build
node dist/cli.js \
  --calendar solar \
  --year 2005 \
  --month 12 \
  --day 23 \
  --hour 8 \
  --minute 37 \
  --gender male \
  --pretty
```

农历输入示例：

```bash
node dist/cli.js \
  --calendar lunar \
  --year 2019 \
  --month 12 \
  --day 12 \
  --hour 11 \
  --minute 22 \
  --gender female \
  --pretty
```

## 开发命令

```bash
npm run check
npm run test
npm run build
```

## OpenSpec

当前活动变更：

- `spec/changes/add-bazi-core-engine`

这个变更完成后，可以再执行归档流程，把 `spec-delta` 合并进 living spec。

