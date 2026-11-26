// ============================================================
// 货币和汇率
//   - 支持欧元、丹麦克朗、瑞典克朗、挪威克朗
//   - 汇率可以手动改，存在设置表里（1 欧元 = 多少外币）
//   - 所有总额统一换算成欧元显示
// ============================================================

// 引入实时查询钩子
import { useLiveQuery } from 'dexie-react-hooks'
// 引入数据库
import { db } from '../db/db'
// 引入数据结构
import type { Currency, Expense, ExpenseCategory } from '../db/schema'
// 引入图标名
import type { IconName } from '../components/Icon'

// 支持的货币（按显示顺序）
export const CURRENCIES: Currency[] = ['EUR', 'DKK', 'SEK', 'NOK']

// 货币的中文名
export const CURRENCY_ZH: Record<Currency, string> = { EUR: '欧元', DKK: '丹麦克朗', SEK: '瑞典克朗', NOK: '挪威克朗' }

// 默认汇率（1 欧元 = 多少）：丹麦克朗和欧元挂钩，很稳定；瑞典、挪威克朗是 2026 年 11 月的大约值
export const DEFAULT_RATES: Record<Currency, number> = { EUR: 1, DKK: 7.46, SEK: 11.0, NOK: 10.6 }

// 存汇率的设置名
const RATES_KEY = 'fxRates'

// 读取汇率（实时）；没设置过就用默认值
export function useRates(): Record<Currency, number> {
  // 读设置
  const rec = useLiveQuery(() => db.settings.get(RATES_KEY))
  // 合并：设置里有的覆盖默认值
  return { ...DEFAULT_RATES, ...((rec?.value as Partial<Record<Currency, number>> | undefined) ?? {}) }
}

// 修改某个货币的汇率
export async function setRate(c: Currency, rate: number) {
  // 不合法的数字不保存
  if (!(rate > 0)) return
  // 读现有设置
  const cur = ((await db.settings.get(RATES_KEY))?.value as Partial<Record<Currency, number>> | undefined) ?? {}
  // 保存
  await db.settings.put({ key: RATES_KEY, value: { ...cur, [c]: rate } })
}

// 换算成欧元
export function toEUR(amount: number, c: Currency, rates: Record<Currency, number>): number {
  // 金额 ÷ 汇率
  return amount / (rates[c] || 1)
}

// 一笔花费换算成欧元
export function expenseEUR(e: Expense, rates: Record<Currency, number>): number {
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

// 国家 → 当地货币（记账时默认用当地货币）
export const COUNTRY_CURRENCY: Record<string, Currency> = { DK: 'DKK', SE: 'SEK', NO: 'NOK' }
