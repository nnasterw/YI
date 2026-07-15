import { generateBaziProfile } from "@core/bazi";
import type { BaziInput, BaziProfile } from "@core/types";
import { renderReport } from "./renderer";
import "./style.css";

let currentProfile: BaziProfile | null = null;

// ---- 表单持久化：将填写内容存到 localStorage，页面刷新/重连后自动恢复 ----
const STORAGE_KEY = "bazi-form-state";
const FORM_FIELDS = ["calendar", "year", "month", "day", "hour", "minute", "gender", "sect"] as const;

function saveFormState(): void {
  const state: Record<string, string> = {};
  for (const id of FORM_FIELDS) {
    const el = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null;
    if (el) state[id] = el.value;
  }
  const leapEl = document.getElementById("leap-month") as HTMLInputElement | null;
  if (leapEl) state["leap-month"] = String(leapEl.checked);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

function restoreFormState(): void {
  let raw: string | null = null;
  try { raw = localStorage.getItem(STORAGE_KEY); } catch {}
  if (!raw) return;
  try {
    const state: Record<string, string> = JSON.parse(raw);
    for (const id of FORM_FIELDS) {
      const el = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null;
      if (el && state[id] !== undefined) el.value = state[id];
    }
    const leapEl = document.getElementById("leap-month") as HTMLInputElement | null;
    if (leapEl && state["leap-month"] !== undefined) leapEl.checked = state["leap-month"] === "true";
    // 同步农历选项显示状态
    const calendarEl = document.getElementById("calendar") as HTMLSelectElement | null;
    const lunarOptsEl = document.getElementById("lunar-options") as HTMLElement | null;
    if (calendarEl && lunarOptsEl) {
      lunarOptsEl.style.display = calendarEl.value === "lunar" ? "flex" : "none";
    }
  } catch {}
}
// ---- 持久化工具函数结束 ----

const form = document.getElementById("bazi-form") as HTMLFormElement;
const outputSection = document.getElementById("output-section") as HTMLElement;
const reportDiv = document.getElementById("report") as HTMLElement;
const calendarSelect = document.getElementById("calendar") as HTMLSelectElement;
const lunarOptions = document.getElementById("lunar-options") as HTMLElement;

// 页面加载时立即恢复上次填写的表单内容
restoreFormState();

calendarSelect.addEventListener("change", () => {
  lunarOptions.style.display = calendarSelect.value === "lunar" ? "flex" : "none";
  saveFormState();
});

// 所有表单字段的 change/input 事件均触发保存，确保实时持久化
for (const id of FORM_FIELDS) {
  const el = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null;
  if (el) {
    el.addEventListener("input", saveFormState);
    el.addEventListener("change", saveFormState);
  }
}
const leapMonthEl = document.getElementById("leap-month") as HTMLInputElement | null;
if (leapMonthEl) leapMonthEl.addEventListener("change", saveFormState);

form.addEventListener("submit", (e) => {
  e.preventDefault();
  saveFormState();

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

    const apiKey = (document.getElementById("ai-api-key") as HTMLInputElement)?.value?.trim() || "dummy";
    const apiUrl = (document.getElementById("ai-api-url") as HTMLInputElement)?.value?.trim() || "http://127.0.0.1:3456/friday-thinking-highTemp";
    const model = (document.getElementById("ai-model") as HTMLInputElement)?.value?.trim() || "claude-opus-4-6";

    inputEl.value = "";
    sendBtn.disabled = true;
    addMessage("user", question);
    chatHistory.push({ role: "user", content: question });

    const assistantDiv = document.createElement("div");
    assistantDiv.className = "ai-msg assistant";
    assistantDiv.textContent = "思考中...";
    messagesDiv!.appendChild(assistantDiv);
    messagesDiv!.scrollTop = messagesDiv!.scrollHeight;

    try {
      const systemPrompt = buildSystemPrompt(profile);
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01"
      };
      if (apiKey && apiKey !== "dummy") {
        headers["x-api-key"] = apiKey;
        headers["anthropic-dangerous-direct-browser-access"] = "true";
      }

      const response = await fetch(`${apiUrl}/v1/messages`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          stream: true,
          system: systemPrompt,
          messages: chatHistory
        })
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        let errorMsg = `HTTP ${response.status}`;
        try { errorMsg = JSON.parse(errorText)?.error?.message || errorMsg; } catch {}
        assistantDiv.textContent = "";
        addMessage("system", `API 错误：${errorMsg}`);
        chatHistory.pop();
        assistantDiv.remove();
        sendBtn.disabled = false;
        return;
      }

      // Parse SSE stream
      const reader = response.body?.getReader();
      if (!reader) {
        assistantDiv.textContent = "（无法读取流）";
        sendBtn.disabled = false;
        return;
      }

      const decoder = new TextDecoder();
      let fullText = "";
      let buffer = "";
      assistantDiv.textContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr);
            if (event.type === "content_block_delta") {
              if (event.delta?.type === "text_delta" && event.delta.text) {
                fullText += event.delta.text;
                assistantDiv.innerHTML = fullText.replace(/\n/g, "<br>");
                messagesDiv!.scrollTop = messagesDiv!.scrollHeight;
              }
            }
          } catch {}
        }
      }

      if (!fullText) {
        assistantDiv.textContent = "（无回复）";
      }
      chatHistory.push({ role: "assistant", content: fullText || "" });
    } catch (err) {
      assistantDiv.textContent = "";
      assistantDiv.remove();
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
