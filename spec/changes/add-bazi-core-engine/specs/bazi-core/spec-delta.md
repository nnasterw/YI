# 规范差异：四柱八字核心能力

本文件包含对 `spec/specs/bazi-core/spec.md` 的规范变更。

## ADDED Requirements

### Requirement: Structured BaZi Chart Generation
WHEN 用户提交有效的阳历或农历出生时间与性别,
系统 SHALL 生成完整的四柱八字命盘。

#### Scenario: Generate chart from solar birth time
GIVEN 用户输入有效的阳历出生年月日时分
WHEN 系统执行排盘
THEN 系统返回年柱、月柱、日柱、时柱
AND 返回对应的命宫、身宫与胎元

#### Scenario: Generate chart from lunar birth time
GIVEN 用户输入有效的农历出生年月日时分
WHEN 系统执行排盘
THEN 系统将农历生日转换为对应命盘
AND 返回对应的阳历时间表示

### Requirement: Pillar Metadata Extraction
WHEN 系统生成四柱命盘,
系统 SHALL 提取每柱的天干、地支、藏干、十神、纳音、地势、旬与旬空。

#### Scenario: Extract full pillar metadata
GIVEN 一个成功生成的四柱命盘
WHEN 系统构建结构化输出
THEN 每一柱都包含天干与地支元信息
AND 每一柱都包含藏干与对应十神

#### Scenario: Preserve day master semantics
GIVEN 日柱已经生成
WHEN 系统标注日干十神
THEN 系统将日干标记为“日主”
AND 不将日干误标为其他十神

### Requirement: Natal Relation Analysis
WHEN 用户请求命盘分析,
系统 SHALL 输出命盘内部的核心关系，包括五行分布、十神分布、合冲刑害、三合与三会。

#### Scenario: Detect earthly branch relations
GIVEN 命盘地支之间存在六合、六冲、六害或相刑
WHEN 系统执行关系分析
THEN 系统返回关系类型、涉及成员与文字说明

#### Scenario: Detect heavenly stem combinations
GIVEN 命盘天干之间存在五合
WHEN 系统执行关系分析
THEN 系统返回对应的合化关系与结果元素

### Requirement: Luck Cycle Projection
WHEN 用户请求大运与流年信息,
系统 SHALL 计算起运时间、行运方向以及结构化大运/流年序列。

#### Scenario: Build major luck cycles
GIVEN 一个成功生成的命盘
WHEN 系统计算大运
THEN 系统返回起运偏移与起运公历时间
AND 返回按顺行或逆行展开的大运列表

#### Scenario: Build annual pillars within each major cycle
GIVEN 系统已经生成大运列表
WHEN 用户请求流年结构
THEN 系统在每个大运下返回流年干支序列
AND 返回对应的年份与年龄

### Requirement: CLI JSON Output
WHEN 用户通过命令行调用系统,
系统 SHALL 输出可机器读取的 JSON 结果。

#### Scenario: Pretty-print CLI response
GIVEN 用户提供完整的命令行参数并启用 pretty 模式
WHEN CLI 执行成功
THEN 系统输出格式化 JSON
AND 结果包含命盘、关系分析与大运结构

#### Scenario: Reject incomplete CLI input
GIVEN 用户缺少必要参数
WHEN CLI 执行
THEN 系统返回明确的参数错误信息
AND 不输出不完整命盘

