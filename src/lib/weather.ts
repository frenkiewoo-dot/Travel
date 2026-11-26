// ============================================================
// 天气：用免费的 Open-Meteo（不需要 key；欧洲各国用的是当地气象局的模型，例如丹麦 DMI、德国 DWD）
//   - 今天（按手机日期）：现在的温度、体感、天气、风、降水概率、日出日落，以及接下来 24 小时
//   - 未来：一直到有预报的最后一天（最多 16 天）
//   - 结果存在手机里，1 小时内不重复请求；没网时显示上次的预报
//   - 每个国家的官方天气网站（例如丹麦 DMI、瑞典 SMHI、意大利 Aeronautica Militare）
// ============================================================

// 引入数据库（缓存）
import { db } from '../db/db'
// 引入图标名
import type { IconName } from '../components/Icon'

// 预报接口
const API = 'https://api.open-meteo.com/v1/forecast'
// 最多预报几天（Open-Meteo 最多 16 天）
export const FORECAST_DAYS = 16
// 缓存多久（毫秒）
const FRESH_MS = 60 * 60 * 1000

// 一天的预报
export interface DayWeather {
  // 日期 'YYYY-MM-DD'（当地）
  date: string
  // 天气代码（WMO）
  code: number
  // 最高 / 最低气温（°C）
  max: number
  min: number
  // 降水概率（%）
  rainChance: number | null
  // 降水量（mm）
  rainSum: number | null
  // 最大风速（km/h）
  windMax: number | null
  // 日出 / 日落（当地时间 'HH:mm'）
  sunrise: string
  sunset: string
}

// 一个小时的预报
export interface HourWeather {
  // 当地时间 'YYYY-MM-DDTHH:mm'
  time: string
  temp: number
  code: number
  rainChance: number | null
}

// 一个地方的天气
export interface Weather {
  // 现在
  current: { temp: number; feels: number; code: number; wind: number; humidity: number; isDay: boolean; time: string }
  // 每小时（从现在开始的 24 小时）
  hours: HourWeather[]
  // 每天（从今天到有预报的最后一天）
  days: DayWeather[]
  // 当地时区
  timezone: string
  // 获取时间
  fetchedAt: number
}

// 缓存的设置名
const keyOf = (lat: number, lng: number) => `weather:${lat.toFixed(2)},${lng.toFixed(2)}`

// 读取天气：有 1 小时内的缓存就用缓存；force = 强制刷新；没网时返回旧缓存（stale = true）
export async function getWeather(lat: number, lng: number, force = false): Promise<{ weather: Weather; stale: boolean }> {
  // 缓存
  const cached = (await db.settings.get(keyOf(lat, lng)))?.value as Weather | undefined
  // 新鲜的缓存直接用
  if (cached && !force && Date.now() - cached.fetchedAt < FRESH_MS) return { weather: cached, stale: false }
  try {
    // 请求参数
    const q = new URLSearchParams({
      latitude: lat.toFixed(4),
      longitude: lng.toFixed(4),
      current: 'temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m,is_day',
      hourly: 'temperature_2m,weather_code,precipitation_probability',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,sunrise,sunset',
      timezone: 'auto',
      forecast_days: String(FORECAST_DAYS),
    })
    // 10 秒超时
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 10000)
    const res = await fetch(`${API}?${q}`, { signal: ctrl.signal })
    clearTimeout(t)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    // 转成我们的格式
    const weather = parse(await res.json())
    // 存缓存
    await db.settings.put({ key: keyOf(lat, lng), value: weather })
    return { weather, stale: false }
  } catch (e) {
    // 没网：有旧的就用旧的
    if (cached) return { weather: cached, stale: true }
    throw e
  }
}

// Open-Meteo 返回的格式（只列用到的）
interface Raw {
  timezone: string
  current: { time: string; temperature_2m: number; apparent_temperature: number; weather_code: number; wind_speed_10m: number; relative_humidity_2m: number; is_day: number }
  hourly: { time: string[]; temperature_2m: number[]; weather_code: number[]; precipitation_probability: (number | null)[] }
  daily: {
    time: string[]
    weather_code: number[]
    temperature_2m_max: number[]
    temperature_2m_min: number[]
    precipitation_probability_max: (number | null)[]
    precipitation_sum: (number | null)[]
    wind_speed_10m_max: (number | null)[]
    sunrise: string[]
    sunset: string[]
  }
}

// 转换
function parse(r: Raw): Weather {
  // 现在是第几个小时（从当前小时开始取 24 小时）
  const nowHour = r.current.time.slice(0, 13)
  const start = Math.max(0, r.hourly.time.findIndex((t) => t.slice(0, 13) === nowHour))
  // 每小时
  const hours = r.hourly.time.slice(start, start + 24).map((time, i) => ({
    time,
    temp: r.hourly.temperature_2m[start + i],
    code: r.hourly.weather_code[start + i],
    rainChance: r.hourly.precipitation_probability[start + i] ?? null,
  }))
  // 每天（有些模型最后几天没有数据，去掉气温为空的）
  const days = r.daily.time
    .map((date, i) => ({
      date,
      code: r.daily.weather_code[i],
      max: r.daily.temperature_2m_max[i],
      min: r.daily.temperature_2m_min[i],
      rainChance: r.daily.precipitation_probability_max[i] ?? null,
      rainSum: r.daily.precipitation_sum[i] ?? null,
      windMax: r.daily.wind_speed_10m_max[i] ?? null,
      sunrise: r.daily.sunrise[i]?.slice(11, 16) ?? '',
      sunset: r.daily.sunset[i]?.slice(11, 16) ?? '',
    }))
    .filter((d) => d.max != null && d.min != null)
  // 返回
  return {
    current: {
      temp: r.current.temperature_2m,
      feels: r.current.apparent_temperature,
      code: r.current.weather_code,
      wind: r.current.wind_speed_10m,
      humidity: r.current.relative_humidity_2m,
      isDay: r.current.is_day === 1,
      time: r.current.time,
    },
    hours,
    days,
    timezone: r.timezone,
    fetchedAt: Date.now(),
  }
}

// 天气代码 → 中文和图标（WMO 标准）
export function describe(code: number): { label: string; icon: IconName } {
  if (code === 0) return { label: '晴', icon: 'sun' }
  if (code === 1) return { label: '晴间少云', icon: 'wPartly' }
  if (code === 2) return { label: '多云', icon: 'wPartly' }
  if (code === 3) return { label: '阴', icon: 'wCloud' }
  if (code === 45 || code === 48) return { label: '雾', icon: 'wFog' }
  if (code >= 51 && code <= 55) return { label: '毛毛雨', icon: 'wRain' }
  if (code === 56 || code === 57) return { label: '冻毛毛雨', icon: 'wRain' }
  if (code === 61) return { label: '小雨', icon: 'wRain' }
  if (code === 63) return { label: '中雨', icon: 'wRain' }
  if (code === 65) return { label: '大雨', icon: 'wRain' }
  if (code === 66 || code === 67) return { label: '冻雨', icon: 'wRain' }
  if (code === 71) return { label: '小雪', icon: 'wSnow' }
  if (code === 73) return { label: '中雪', icon: 'wSnow' }
  if (code === 75) return { label: '大雪', icon: 'wSnow' }
  if (code === 77) return { label: '雪粒', icon: 'wSnow' }
  if (code >= 80 && code <= 82) return { label: '阵雨', icon: 'wRain' }
  if (code === 85 || code === 86) return { label: '阵雪', icon: 'wSnow' }
  if (code === 95) return { label: '雷雨', icon: 'wStorm' }
  if (code === 96 || code === 99) return { label: '雷雨伴冰雹', icon: 'wStorm' }
  return { label: '—', icon: 'wCloud' }
}

// 各国官方气象机构的网站（国家代码 → 名称、网址）
export const OFFICIAL_WEATHER: Record<string, { name: string; nameZh: string; url: string }> = {
  DK: { name: 'DMI', nameZh: '丹麦气象局', url: 'https://www.dmi.dk/' },
  SE: { name: 'SMHI', nameZh: '瑞典气象水文局', url: 'https://www.smhi.se/' },
  NO: { name: 'Yr / MET Norway', nameZh: '挪威气象局', url: 'https://www.yr.no/' },
  FI: { name: 'Ilmatieteen laitos', nameZh: '芬兰气象局', url: 'https://en.ilmatieteenlaitos.fi/' },
  IS: { name: 'Veðurstofa Íslands', nameZh: '冰岛气象局', url: 'https://en.vedur.is/' },
  DE: { name: 'DWD', nameZh: '德国气象局', url: 'https://www.dwd.de/' },
  NL: { name: 'KNMI', nameZh: '荷兰皇家气象研究所', url: 'https://www.knmi.nl/' },
  BE: { name: 'IRM / KMI', nameZh: '比利时皇家气象研究所', url: 'https://www.meteo.be/' },
  FR: { name: 'Météo-France', nameZh: '法国气象局', url: 'https://meteofrance.com/' },
  IT: { name: 'Aeronautica Militare – Servizio Meteo', nameZh: '意大利空军气象局', url: 'https://www.meteoam.it/' },
  ES: { name: 'AEMET', nameZh: '西班牙气象局', url: 'https://www.aemet.es/' },
  PT: { name: 'IPMA', nameZh: '葡萄牙气象局', url: 'https://www.ipma.pt/' },
  GB: { name: 'Met Office', nameZh: '英国气象局', url: 'https://www.metoffice.gov.uk/' },
  IE: { name: 'Met Éireann', nameZh: '爱尔兰气象局', url: 'https://www.met.ie/' },
  CH: { name: 'MeteoSchweiz', nameZh: '瑞士气象局', url: 'https://www.meteoswiss.admin.ch/' },
  AT: { name: 'GeoSphere Austria', nameZh: '奥地利气象局', url: 'https://www.geosphere.at/' },
  CZ: { name: 'ČHMÚ', nameZh: '捷克水文气象局', url: 'https://www.chmi.cz/' },
  PL: { name: 'IMGW', nameZh: '波兰气象水文局', url: 'https://meteo.imgw.pl/' },
  HU: { name: 'HungaroMet', nameZh: '匈牙利气象局', url: 'https://www.met.hu/' },
  GR: { name: 'EMY / HNMS', nameZh: '希腊气象局', url: 'http://www.emy.gr/' },
  CN: { name: '中国气象局', nameZh: '中国气象局', url: 'https://weather.cma.cn/' },
  HK: { name: '香港天文台', nameZh: '香港天文台', url: 'https://www.hko.gov.hk/' },
  JP: { name: '気象庁', nameZh: '日本气象厅', url: 'https://www.jma.go.jp/' },
  US: { name: 'National Weather Service', nameZh: '美国国家气象局', url: 'https://www.weather.gov/' },
}
