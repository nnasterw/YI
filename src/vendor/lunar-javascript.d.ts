declare module "lunar-javascript" {
  export interface SolarInstance {
    getLunar(): LunarInstance;
    toYmd(): string;
    toYmdHms(): string;
    getYear(): number;
    getMonth(): number;
    getDay(): number;
    getHour(): number;
    getMinute(): number;
    getSecond(): number;
  }

  export interface LunarInstance {
    getSolar(): SolarInstance;
    getEightChar(): EightCharInstance;
    toString(): string;
  }

  export interface LiuNianInstance {
    getYear(): number;
    getAge(): number;
    getGanZhi(): string;
  }

  export interface DaYunInstance {
    getIndex(): number;
    getStartYear(): number;
    getEndYear(): number;
    getStartAge(): number;
    getEndAge(): number;
    getGanZhi(): string;
    getLiuNian(n?: number): LiuNianInstance[];
  }

  export interface YunInstance {
    getStartYear(): number;
    getStartMonth(): number;
    getStartDay(): number;
    getStartHour(): number;
    isForward(): boolean;
    getStartSolar(): SolarInstance;
    getDaYun(n?: number): DaYunInstance[];
  }

  export interface EightCharInstance {
    setSect(sect: number): void;
    getYear(): string;
    getMonth(): string;
    getDay(): string;
    getTime(): string;
    getYearGan(): string;
    getYearZhi(): string;
    getMonthGan(): string;
    getMonthZhi(): string;
    getDayGan(): string;
    getDayZhi(): string;
    getTimeGan(): string;
    getTimeZhi(): string;
    getYearHideGan(): string[] | string;
    getMonthHideGan(): string[] | string;
    getDayHideGan(): string[] | string;
    getTimeHideGan(): string[] | string;
    getYearShiShenGan(): string;
    getMonthShiShenGan(): string;
    getDayShiShenGan(): string;
    getTimeShiShenGan(): string;
    getYearShiShenZhi(): string[] | string;
    getMonthShiShenZhi(): string[] | string;
    getDayShiShenZhi(): string[] | string;
    getTimeShiShenZhi(): string[] | string;
    getYearNaYin(): string;
    getMonthNaYin(): string;
    getDayNaYin(): string;
    getTimeNaYin(): string;
    getYearDiShi(): string;
    getMonthDiShi(): string;
    getDayDiShi(): string;
    getTimeDiShi(): string;
    getYearXun(): string;
    getMonthXun(): string;
    getDayXun(): string;
    getTimeXun(): string;
    getYearXunKong(): string;
    getMonthXunKong(): string;
    getDayXunKong(): string;
    getTimeXunKong(): string;
    getTaiYuan(): string;
    getMingGong(): string;
    getShenGong(): string;
    getYun(gender: number, sect?: number): YunInstance;
  }

  export const Solar: {
    fromYmd(y: number, m: number, d: number): SolarInstance;
    fromYmdHms(
      y: number,
      m: number,
      d: number,
      hour: number,
      minute: number,
      second: number
    ): SolarInstance;
  };

  export const Lunar: {
    fromYmdHms(
      y: number,
      m: number,
      d: number,
      hour: number,
      minute: number,
      second: number
    ): LunarInstance;
  };
}

