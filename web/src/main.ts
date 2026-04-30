import { generateBaziProfile } from "@core/bazi";
import type { BaziInput } from "@core/types";
import { renderReport } from "./renderer";
import "./style.css";

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
    reportDiv.innerHTML = renderReport(profile);
    outputSection.style.display = "block";
    outputSection.scrollIntoView({ behavior: "smooth" });
  } catch (err) {
    reportDiv.innerHTML = `<div class="error">排盘错误：${err instanceof Error ? err.message : String(err)}</div>`;
    outputSection.style.display = "block";
  }
});
