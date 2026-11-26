// ============================================================
// 货币和汇率
//   - 默认有欧元、丹麦克朗、瑞典克朗、挪威克朗；在预算页可以添加、更换、删除货币（例如人民币、港币、美元）
//   - 汇率统一按“1 欧元 = 多少外币”存在设置表里；换算表最上面的货币是基准，显示“1 基准货币 = 多少”
//   - 「更新汇率」从欧洲央行的参考汇率（Frankfurter，免费、不需要 key）获取；没网时用上次的；也可以手动改
//   - 预算的总额统一换算成欧元显示
// ============================================================

// 引入实时查询钩子
import { useLiveQuery } from 'dexie-react-hooks'
// 引入数据库
import { db } from '../db/db'
// 引入数据结构
import type { Currency, Expense, ExpenseCategory } from '../db/schema'
// 引入图标名
import type { IconName } from '../components/Icon'

// 可以选的货币：代码 → 中文名（常用的排前面）
export const CURRENCY_ZH: Record<string, string> = {
  EUR: '欧元',
  CNY: '人民币',
  HKD: '港币',
  USD: '美元',
  GBP: '英镑',
  DKK: '丹麦克朗',
  SEK: '瑞典克朗',
  NOK: '挪威克朗',
  ISK: '冰岛克朗',
  CHF: '瑞士法郎',
  CZK: '捷克克朗',
  PLN: '波兰兹罗提',
  HUF: '匈牙利福林',
  RON: '罗马尼亚列伊',
  TRY: '土耳其里拉',
  JPY: '日元',
  KRW: '韩元',
  TWD: '新台币',
  SGD: '新加坡元',
  THB: '泰铢',
  MYR: '马来西亚林吉特',
  IDR: '印尼盾',
  PHP: '菲律宾比索',
  INR: '印度卢比',
  AUD: '澳元',
  NZD: '新西兰元',
  CAD: '加元',
  MXN: '墨西哥比索',
  BRL: '巴西雷亚尔',
  ZAR: '南非兰特',
  ILS: '以色列新谢克尔',
}

// 所有可选货币的代码
export const ALL_CURRENCIES: Currency[] = Object.keys(CURRENCY_ZH)

// 默认汇率（1 欧元 = 多少）：丹麦克朗和欧元挂钩，很稳定；其他是大约值，点「更新汇率」获取最新
export const DEFAULT_RATES: Record<string, number> = {
  EUR: 1,
  DKK: 7.46,
  SEK: 11.0,
  NOK: 10.6,
  CNY: 8.3,
  HKD: 9.0,
  USD: 1.16,
  GBP: 0.87,
  ISK: 143,
  CHF: 0.93,
  CZK: 24.4,
  PLN: 4.25,
  HUF: 390,
  RON: 5.1,
  TRY: 48,
  JPY: 175,
  KRW: 1650,
  TWD: 35,
  SGD: 1.5,
  THB: 37.5,
  MYR: 4.9,
  IDR: 19300,
  PHP: 66,
  INR: 102,
  AUD: 1.78,
  NZD: 2.0,
  CAD: 1.62,
  MXN: 21.5,
  BRL: 6.3,
  ZAR: 20.5,
  ILS: 3.9,
}

// 默认的换算表（第一个是基准）
const DEFAULT_LIST: Currency[] = ['EUR', 'DKK', 'SEK', 'NOK']

// 设置名：汇率、换算表里的货币、上次更新
const RATES_KEY = 'fxRates'
const LIST_KEY = 'fxList'
const UPDATED_KEY = 'fxUpdated'

// 汇率和换算表（实时）
export interface Fx {
  // 1 欧元 = 多少（所有货币）
  rates: Record<string, number>
  // 换算表里的货币，第一个是基准
  list: Currency[]
  // 上次在线更新（时间、欧洲央行的日期）
  updated?: { at: number; date: string }
}

// 读取汇率和换算表（实时）
export function useFx(): Fx {
  // 读设置
  const recs = useLiveQuery(() => db.settings.bulkGet([RATES_KEY, LIST_KEY, UPDATED_KEY]))
  // 合并：设置里有的覆盖默认值
  const rates = { ...DEFAULT_RATES, ...((recs?.[0]?.value as Record<string, number> | undefined) ?? {}) }
  const list = (recs?.[1]?.value as Currency[] | undefined) ?? DEFAULT_LIST
  const updated = recs?.[2]?.value as Fx['updated']
  // 返回
  return { rates, list, updated }
}

// 只要汇率（旧的写法，预算页和记账表单用）
export function useRates(): Record<string, number> {
  return useFx().rates
}

// 读设置里的换算表
async function getList(): Promise<Currency[]> {
  return ((await db.settings.get(LIST_KEY))?.value as Currency[] | undefined) ?? DEFAULT_LIST
}

// 读设置里的汇率（只有改过的）
async function getRates(): Promise<Record<string, number>> {
  return ((await db.settings.get(RATES_KEY))?.value as Record<string, number> | undefined) ?? {}
}

// 修改汇率：“1 基准货币 = value 个 code”
export async function setRelativeRate(code: Currency, base: Currency, value: number) {
  // 不合法的数字不保存
  if (!(value > 0) || code === base) return
  // 现有汇率（含默认）
  const cur = { ...DEFAULT_RATES, ...(await getRates()) }
  // 改过的部分
  const saved = await getRates()
  // code 是欧元：欧元固定为 1，改的是基准货币对欧元的汇率（1 基准 = value 欧元 → 1 欧元 = 1/value 基准）
  if (code === 'EUR') saved[base] = 1 / value
  // 其他：1 欧元 = value × (1 欧元 = 多少基准)
  else saved[code] = value * (cur[base] ?? 1)
  // 保存
  await db.settings.put({ key: RATES_KEY, value: saved })
}

// 恢复某个货币的默认汇率
export async function resetRate(code: Currency) {
  const saved = await getRates()
  delete saved[code]
  await db.settings.put({ key: RATES_KEY, value: saved })
}

// 修改汇率（旧的写法：1 欧元 = rate）
export async function setRate(c: Currency, rate: number) {
  if (!(rate > 0)) return
  await db.settings.put({ key: RATES_KEY, value: { ...(await getRates()), [c]: rate } })
}

// 换算表：添加货币（加在最后）
export async function addCurrency(code: Currency) {
  const list = await getList()
  if (!list.includes(code)) await db.settings.put({ key: LIST_KEY, value: [...list, code] })
}

// 换算表：把某一行换成另一种货币（换成的货币已经在表里的话，两行互换位置）
export async function replaceCurrency(old: Currency, code: Currency) {
  const list = await getList()
  const i = list.indexOf(old)
  if (i < 0 || old === code) return
  const j = list.indexOf(code)
  const next = [...list]
  next[i] = code
  if (j >= 0) next[j] = old
  await db.settings.put({ key: LIST_KEY, value: next })
}

// 换算表：删除一种货币（至少留两种）
export async function removeCurrency(code: Currency) {
  const list = await getList()
  if (list.length <= 2) return
  await db.settings.put({ key: LIST_KEY, value: list.filter((c) => c !== code) })
}

// 在线更新汇率（欧洲央行参考汇率，每个工作日下午更新）；成功返回日期，失败抛错
export async function fetchRates(): Promise<string> {
  // 两个地址，第一个不行就试第二个
  const urls = ['https://api.frankfurter.dev/v1/latest?base=EUR', 'https://api.frankfurter.app/latest?from=EUR']
  let lastErr: unknown
  for (const url of urls) {
    try {
      // 10 秒超时
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 10000)
      const res = await fetch(url, { signal: ctrl.signal })
      clearTimeout(t)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      // 结果：{ base: 'EUR', date: '2026-11-27', rates: { USD: 1.16, ... } }
      const data = (await res.json()) as { date: string; rates: Record<string, number> }
      // 保存：在线汇率覆盖（欧洲央行没有的货币，例如新台币，保留原来的）
      await db.settings.put({ key: RATES_KEY, value: { ...(await getRates()), ...data.rates, EUR: 1 } })
      await db.settings.put({ key: UPDATED_KEY, value: { at: Date.now(), date: data.date } })
      return data.date
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('更新失败')
}

// 换算成欧元
export function toEUR(amount: number, c: Currency, rates: Record<string, number>): number {
  // 金额 ÷ 汇率
  return amount / (rates[c] || 1)
}

// 一笔花费换算成欧元
export function expenseEUR(e: Expense, rates: Record<string, number>): number {
  // 换算
  return toEUR(e.amount, e.currency, rates)
}

// 显示金额：欧元写 “€12.5”，其他写 “120 DKK”
export function formatMoney(amount: number, c: Currency): string {
  // 最多两位小数，整数不显示小数
  const n = amount.toLocaleString('zh-CN', { maximumFractionDigits: 2, minimumFractionDigits: 0 })
  // 欧元用符号，其他用代码
  return c === 'EUR' ? `€${n}` : `${n} ${c}`
}

// 显示欧元（取整，用于总额）
export function formatEUR(amount: number): string {
  // 四舍五入到整数
  return `€${Math.round(amount).toLocaleString('zh-CN')}`
}

// 汇率数字的显示：大的少写小数，小的多写几位
export function formatRate(v: number): string {
  return v >= 100 ? v.toFixed(1) : v >= 1 ? v.toFixed(3) : v.toPrecision(4)
}

// 分类的中文名和图标
export const CATEGORY: Record<ExpenseCategory, { label: string; icon: IconName }> = {
  transport: { label: '交通', icon: 'train' },
  lodging: { label: '住宿', icon: 'bed' },
  food: { label: '餐饮', icon: 'food' },
  tickets: { label: '门票', icon: 'ticket' },
  shopping: { label: '购物', icon: 'bag' },
  other: { label: '其他', icon: 'more' },
}

// 分类顺序
export const CATEGORIES: ExpenseCategory[] = ['transport', 'lodging', 'food', 'tickets', 'shopping', 'other']

// 国家 → 当地货币（记账时默认用当地货币；没列出的欧元区国家用欧元）
export const COUNTRY_CURRENCY: Record<string, Currency> = {
  DK: 'DKK',
  SE: 'SEK',
  NO: 'NOK',
  IS: 'ISK',
  CH: 'CHF',
  GB: 'GBP',
  CZ: 'CZK',
  PL: 'PLN',
  HU: 'HUF',
  RO: 'RON',
  TR: 'TRY',
  US: 'USD',
  CN: 'CNY',
  HK: 'HKD',
  JP: 'JPY',
  KR: 'KRW',
  TW: 'TWD',
  SG: 'SGD',
  TH: 'THB',
  AU: 'AUD',
  CA: 'CAD',
}
