import { generateBaziProfile } from "@core/bazi";
import type { BaziInput, BaziProfile } from "@core/types";
import { renderReport } from "./renderer";
import "./style.css";

let currentProfile: BaziProfile | null = null;

const form = document.getElementById("bazi-form") as HTMLFormElement;
const outputSection = document.getElementById("output-section") as HTMLElement;
const reportDiv = document.getElementById("report") as HTMLElement;
const calendarSelect = document.getElementById("calendar") as HTMLSelectElement;
const lunarOptions = document.getElementById("lunar-options") as HTMLElement;

calendarSelect.addEventListener("change", () => {
  lunarOptions.style.display = calendarSelect.value === "lunar" ? "flex" : "none";
});

form.addEventListener("submit", (e) => {
  e.preventDefault();

  const yearVal = (document.getElementById("year") as HTMLInputElement).value;
  const monthVal = (document.getElementById("month") as HTMLInputElement).value;
  const dayVal = (document.getElementById("day") as HTMLInputElement).value;
  const hourVal = (document.getElementById("hour") as HTMLInputElement).value;

  if (!yearVal || !monthVal || !dayVal || !hourVal) {
    reportDiv.innerHTML = `<div class="error">请填写完整的出生年、月、日、时</div>`;
    outputSection.style.display = "block";
    return;
  }

  const input: BaziInput = {
    calendarType: calendarSelect.value as "solar" | "lunar",
    year: Number(yearVal),
    month: Number(monthVal),
    day: Number(dayVal),
    hour: Number(hourVal),
    minute: Number((document.getElementById("minute") as HTMLInputElement).value || "0"),
    gender: (document.getElementById("gender") as HTMLSelectElement).value as "male" | "female",
    sect: Number((document.getElementById("sect") as HTMLSelectElement).value) as 1 | 2,
    isLeapMonth: (document.getElementById("leap-month") as HTMLInputElement).checked
  };

  try {
    const profile = generateBaziProfile(input);
    currentProfile = profile;
    reportDiv.innerHTML = renderReport(profile);
    outputSection.style.display = "block";
    outputSection.scrollIntoView({ behavior: "smooth" });
    initAiChat(profile);
  } catch (err) {
    reportDiv.innerHTML = `<div class="error">排盘错误：${err instanceof Error ? err.message : String(err)}</div>`;
    outputSection.style.display = "block";
  }
});

function buildSystemPrompt(profile: BaziProfile): string {
  const p = profile;
  const pillars = p.chart.pillars.map(pi => `${pi.key === "year" ? "年" : pi.key === "month" ? "月" : pi.key === "day" ? "日" : "时"}柱${pi.ganZhi}(${pi.stem.tenGod})`).join(" ");
  const elements = Object.entries(p.elementBalance.counts).map(([el, c]) => `${el}${(c as {total:number}).total}`).join(" ");
  const relations = p.relations.map(r => r.description).join("；");
  const favorable = p.chart.dayMaster.element;

  return `你是一位专业的八字命理分析师。以下是用户的命盘数据，请基于这些数据回答命理相关问题。

## 命盘基本信息
- 阳历：${p.birth.solar}
- 农历：${p.birth.lunar}
- 性别：${p.input.gender === "male" ? "男" : "女"}
- 四柱：${pillars}
- 日主：${p.chart.dayMaster.value}${p.chart.dayMaster.element}（${p.chart.dayMaster.yinYang}）
- 五行分数：${elements}
- 命盘关系：${relations}
- 十神主轴：${p.tenGodDistribution.dominant.join("、")}
- 大运方向：${p.luckCycles.direction === "forward" ? "顺行" : "逆行"}，起运${p.luckCycles.startSolar}

## 分析原则
1. 先判定身旺身弱（此命盘已判定），基于此确定喜忌
2. 身旺喜：食伤泄秀 > 财星耗身 > 官杀制身；忌：印星生身、比劫帮身
3. 身弱喜：印星生身 > 比劫帮身；忌：食伤泄气、财星耗身、官杀克身
4. 流年分析综合五维度：五行喜忌(30%) + 十神作用(25%) + 冲合刑害(25%) + 调候(10%) + 大运联动(10%)
5. 回答要具体、务实、可操作，避免空泛的"注意身体"式回答
6. 用中文回答，语言简洁直接`;
}

function initAiChat(profile: BaziProfile): void {
  const messagesDiv = document.getElementById("ai-messages");
  const inputEl = document.getElementById("ai-input") as HTMLInputElement;
  const sendBtn = document.getElementById("ai-send-btn") as HTMLButtonElement;
  if (!messagesDiv || !inputEl || !sendBtn) return;

  const chatHistory: Array<{ role: string; content: string }> = [];

  function addMessage(role: "user" | "assistant" | "system", content: string): void {
    const div = document.createElement("div");
    div.className = `ai-msg ${role}`;
    div.innerHTML = content.replace(/\n/g, "<br>");
    messagesDiv!.appendChild(div);
    messagesDiv!.scrollTop = messagesDiv!.scrollHeight;
  }

  async function sendMessage(): Promise<void> {
    const question = inputEl.value.trim();
    if (!question) return;

    const apiKey = (document.getElementById("ai-api-key") as HTMLInputElement)?.value?.trim();
    const apiUrl = (document.getElementById("ai-api-url") as HTMLInputElement)?.value?.trim() || "https://api.anthropic.com";
    const model = (document.getElementById("ai-model") as HTMLInputElement)?.value?.trim() || "claude-sonnet-4-5-20250514";

    if (!apiKey) {
      addMessage("system", "请先在 API 设置中填入你的 API Key");
      return;
    }

    inputEl.value = "";
    sendBtn.disabled = true;
    addMessage("user", question);
    chatHistory.push({ role: "user", content: question });

    try {
      const systemPrompt = buildSystemPrompt(profile);
      const response = await fetch(`${apiUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true"
        },
        body: JSON.stringify({
          model,
          max_tokens: 2048,
          system: systemPrompt,
          messages: chatHistory
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const errorMsg = errorData?.error?.message || `HTTP ${response.status}`;
        addMessage("system", `API 错误：${errorMsg}`);
        chatHistory.pop();
        sendBtn.disabled = false;
        return;
      }

      const data = await response.json();
      const reply = data.content?.[0]?.text || "（无回复）";
      addMessage("assistant", reply);
      chatHistory.push({ role: "assistant", content: reply });
    } catch (err) {
      addMessage("system", `请求失败：${err instanceof Error ? err.message : String(err)}`);
      chatHistory.pop();
    } finally {
      sendBtn.disabled = false;
      inputEl.focus();
    }
  }

  sendBtn.addEventListener("click", sendMessage);
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
}
