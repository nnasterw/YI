import {
  SELF_PUNISHMENTS,
  STEM_COMBINATIONS,
  findBranchHalfTripleRelations,
  findBranchPairRelation,
  findBranchTripleRelations,
  getElementInteraction
} from "./constants";
import type { PillarDetails, RelationRecord } from "./types";

function buildEarthlyRelation(
  type: string,
  members: string[],
  result?: string
): RelationRecord {
  const description = result
    ? `${members.join("、")}形成${type}，归于${result}。`
    : `${members.join("、")}形成${type}关系。`;

  return {
    category: "earthly-branch",
    type,
    members,
    result,
    description
  };
}

export function analyzeNatalRelations(pillars: PillarDetails[]): RelationRecord[] {
  const relations: RelationRecord[] = [];
  const stems = pillars.map((pillar) => pillar.stem.value);
  const branches = pillars.map((pillar) => pillar.branch.value);
  const dayMasterStem = pillars.find((pillar) => pillar.key === "day")?.stem.value;

  for (const combo of STEM_COMBINATIONS) {
    if (combo.members.every((member) => stems.includes(member))) {
      relations.push({
        category: "heavenly-stem",
        type: combo.label,
        members: [...combo.members],
        result: combo.result,
        description: `${combo.members.join("、")}形成${combo.label}，化${combo.result}。`
      });
    }
  }

  // 命盘中某地支重复出现时（如两柱皆为“午”），会与同一个第三方地支各自构成
  // 完全相同的六合/六冲/六害关系（文案也相同），此处按“关系类型+地支组合”去重，
  // 避免报告中出现两条一模一样的关系描述。
  const seenPairKeys = new Set<string>();
  for (let i = 0; i < branches.length; i += 1) {
    for (let j = i + 1; j < branches.length; j += 1) {
      // 原局内相同地支重复出现（如两柱皆为“酉”）不在此处判定，
      // 自刑关系统一交由下方 branchCounts 逻辑处理，避免重复生成同一条自刑记录。
      if (branches[i] === branches[j]) {
        continue;
      }
      const match = findBranchPairRelation(branches[i], branches[j]);
      if (!match) {
        continue;
      }
      const pairKey = `${match.type}:${[branches[i], branches[j]].sort().join(",")}`;
      if (seenPairKeys.has(pairKey)) {
        continue;
      }
      seenPairKeys.add(pairKey);
      relations.push(
        buildEarthlyRelation(match.type, [branches[i], branches[j]], match.result)
      );
    }
  }

  for (const triple of findBranchTripleRelations(branches)) {
    relations.push(buildEarthlyRelation(triple.type, triple.members, triple.result));
  }

  for (const half of findBranchHalfTripleRelations(branches)) {
    relations.push(buildEarthlyRelation(half.type, half.members, half.result));
  }

  const branchCounts = branches.reduce<Record<string, number>>((accumulator, branch) => {
    accumulator[branch] = (accumulator[branch] ?? 0) + 1;
    return accumulator;
  }, {});

  for (const [branch, count] of Object.entries(branchCounts)) {
    if (count > 1 && SELF_PUNISHMENTS.has(branch)) {
      relations.push(buildEarthlyRelation("自刑", [branch, branch]));
    }
  }

  if (dayMasterStem) {
    const dayMasterPillar = pillars.find((pillar) => pillar.key === "day");
    const keyLabel: Record<string, string> = {
      year: "年",
      month: "月",
      day: "日",
      time: "时"
    };
    const typeMap = {
      same: "同气",
      generate: "我生",
      "generated-by": "生我",
      control: "我克",
      "controlled-by": "克我"
    } as const;
    for (const pillar of pillars) {
      if (pillar.key === "day") {
        continue;
      }
      const interaction = getElementInteraction(dayMasterPillar!.stem.element, pillar.stem.element);
      const label = keyLabel[pillar.key] ?? pillar.key;
      relations.push({
        category: "five-element",
        type: typeMap[interaction],
        members: [dayMasterStem, pillar.stem.value],
        description: `日主${dayMasterStem}与${label}干${pillar.stem.value}呈“${typeMap[interaction]}”关系。`
      });
    }
  }

  return relations;
}
