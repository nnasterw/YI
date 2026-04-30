import {
  SELF_PUNISHMENTS,
  STEM_COMBINATIONS,
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

  for (let i = 0; i < branches.length; i += 1) {
    for (let j = i + 1; j < branches.length; j += 1) {
      const match = findBranchPairRelation(branches[i], branches[j]);
      if (match) {
        relations.push(
          buildEarthlyRelation(match.type, [branches[i], branches[j]], match.result)
        );
      }
    }
  }

  for (const triple of findBranchTripleRelations(branches)) {
    relations.push(buildEarthlyRelation(triple.type, triple.members, triple.result));
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
