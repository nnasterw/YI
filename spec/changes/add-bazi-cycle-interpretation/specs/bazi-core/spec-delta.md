# 规范差异：四柱八字核心能力

本文件包含对 `spec/specs/bazi-core/spec.md` 的规范变更。

## ADDED Requirements

### Requirement: Major Luck Cycle Interpretation
WHEN 系统返回大运结构,
系统 SHALL 为每个大运补充分维度解读。

#### Scenario: Interpret each major cycle
GIVEN 系统已经生成大运列表
WHEN 系统构建结构化输出
THEN 每个大运都包含 overall、career、relationships、health、wealth 五个维度
AND 每个维度都以可直接消费的文本数组表示

#### Scenario: Include natal interaction signals in cycle analysis
GIVEN 某个大运与原局存在明显的冲合刑害或五行互动
WHEN 系统分析该大运
THEN 系统在大运解读中体现这些触发信号

### Requirement: Annual Luck Interpretation
WHEN 系统返回流年结构,
系统 SHALL 为每个流年补充分维度解读。

#### Scenario: Interpret each annual pillar
GIVEN 某个大运下的流年列表已经生成
WHEN 系统构建流年输出
THEN 每个流年都包含 overall、career、relationships、health、wealth 五个维度
AND 每个流年都包含与原局或所属大运相关的信号摘要

#### Scenario: Keep annual interpretation machine-readable
GIVEN 用户通过 CLI 获取 JSON 输出
WHEN 系统返回流年解读
THEN 解读字段保持结构化对象
AND 不把全部内容压平成单段字符串

### Requirement: Flow Signal Classification
WHEN 系统分析大运或流年,
系统 SHALL 识别并分类关键触发信号。

#### Scenario: Detect ten-god and element interactions
GIVEN 流运干支相对日主形成特定十神和五行关系
WHEN 系统执行分析
THEN 系统记录这些关系信号
AND 将其转译到对应的人事维度中

#### Scenario: Detect branch relation impact
GIVEN 流运地支与原局地支形成六合、六冲、六害、相刑、三合或三会
WHEN 系统执行分析
THEN 系统在信号列表和对应维度解读中体现这些影响

