// ============================================================
// 预算（底部导航“预算”）
//   - 顶部：已花多少（换算成欧元）、预算还剩多少
//   - 分类：交通 / 住宿 / 餐饮 / 门票 / 购物 / 其他，计划 vs 实际
//   - 汇率：可以手动改（1 欧元 = 多少外币）
//   - 每一笔花费，按日期分组；右下角“记一笔”
//   预算总额和计划都可以不填、随时改
// ============================================================

// 引入 React 钩子
import { useState } from 'react'
// 引入数据钩子
import { useItinerary, useTripData } from '../db/hooks'
// 引入数据结构
import type { Currency, Expense, ExpenseCategory } from '../db/schema'
// 引入数据操作
import { updateTrip } from '../db/trip'
// 引入行程工具
import { toISODate } from '../lib/itinerary'
// 引入货币工具
import { CATEGORIES, CATEGORY, COUNTRY_CURRENCY, CURRENCIES, CURRENCY_ZH, DEFAULT_RATES, expenseEUR, formatEUR, formatMoney, setRate, useRates } from '../lib/money'
// 引入组件
import { Icon } from '../components/Icon'
import { Meter } from '../components/Meter'
import { ExpenseForm } from '../components/ExpenseForm'
import { Field, INPUT, Sheet } from '../components/Sheet'
// 引入加载画面
import { Loading } from './HomePage'

// 星期几
const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

// 页面组件
export default function BudgetPage() {
  // 旅行数据
  const data = useTripData()
  // 每天概况
  const itin = useItinerary(data)
  // 汇率
  const rates = useRates()
  // 记账表单：null 不显示；expense 为 null 是新建
  const [form, setForm] = useState<{ expense: Expense | null } | null>(null)
  // 正在设置计划的分类（'total' 表示总预算）
  const [planFor, setPlanFor] = useState<ExpenseCategory | 'total' | null>(null)

  // 加载中
  if (!data || !itin) return <Loading />
  // 旅行
  const trip = data.trip
  // 预算设置
  const budget = trip.budget ?? {}
  // 分类计划
  const plans = budget.byCategory ?? {}
  // 所有分类计划加起来
  const planSum = CATEGORIES.reduce((sum, c) => sum + (plans[c] ?? 0), 0)
  // 总预算：填了总额用总额，否则用分类计划之和（都没有就是 0）
  const total = budget.total ?? planSum
  // 每个分类实际花了多少（欧元）
  const spentBy = Object.fromEntries(CATEGORIES.map((c) => [c, data.expenses.filter((e) => e.category === c).reduce((sum, e) => sum + expenseEUR(e, rates), 0)])) as Record<ExpenseCategory, number>
  // 总共花了多少
  const spent = CATEGORIES.reduce((sum, c) => sum + spentBy[c], 0)
  // 还剩
  const left = total - spent

  // 记账默认币种：旅途中用当地货币，否则欧元
  const todayStop = itin.today.kind === 'during' ? itin.days[itin.today.dayIndex - 1]?.stop : undefined
  const defaultCurrency: Currency = (todayStop && COUNTRY_CURRENCY[todayStop.country]) || 'EUR'

  // 花费按日期分组（新的在上）
  const byDate = new Map<string, Expense[]>()
  // 排序后分组
  for (const e of [...data.expenses].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)) {
    // 这天的列表
    const list = byDate.get(e.date) ?? []
    // 加进去
    list.push(e)
    byDate.set(e.date, list)
  }

  // 保存计划（欧元）；空的就清除
  const savePlan = async (key: ExpenseCategory | 'total', v: number | null) => {
    // 新的预算设置
    const next = { ...budget, byCategory: { ...plans } }
    // 总预算
    if (key === 'total') next.total = v ?? undefined
    // 分类计划
    else if (v === null) delete next.byCategory[key]
    else next.byCategory[key] = v
    // 保存
    await updateTrip(trip.id, { budget: next })
  }

  // 页面内容
  return (
    <div className="relative h-full overflow-y-auto bg-paper px-5 pt-[max(env(safe-area-inset-top),24px)] pb-28">
      {/* 标题 */}
      <div className="font-serif text-[16px] italic text-muted">Budget</div>
      <h1 className="text-[28px] font-semibold">预算</h1>

      {/* ===== 总览 ===== */}
      <section className="mt-4 rounded-2xl border border-line bg-card p-5">
        {/* 已花 */}
        <div className="text-[13px] text-muted">已花（换算成欧元）</div>
        <div className="mt-0.5 flex items-baseline justify-between gap-3">
          <span className="text-[34px] leading-none font-semibold">{formatEUR(spent)}</span>
          {/* 预算 */}
          <button onClick={() => setPlanFor('total')} className="flex items-center gap-1 text-[13px] text-muted">
            {total > 0 ? `预算 ${formatEUR(total)}` : '设置预算'}
            <Icon name="edit" size={13} />
          </button>
        </div>
        {/* 有预算：进度条 + 剩余 */}
        {total > 0 ? (
          <>
            <div className="mt-3">
              <Meter value={spent} max={total} label="总预算使用情况" />
            </div>
            <div className={`mt-2 flex items-center gap-1 text-[13px] ${left < 0 ? 'text-accent' : 'text-muted'}`}>
              {left < 0 && <Icon name="alert" size={14} />}
              {left < 0 ? `超支 ${formatEUR(-left)}` : `还剩 ${formatEUR(left)}`}
              {budget.total === undefined && <span className="text-muted"> · 预算按分类计划相加</span>}
            </div>
          </>
        ) : (
          <p className="mt-2 text-[12px] leading-relaxed text-muted">预算还没定也没关系，先记账；之后点右上角随时设置总预算，或者给每个分类设计划。</p>
        )}
      </section>

      {/* ===== 分类 ===== */}
      <h2 className="mt-6 text-[15px] font-semibold">分类：计划 vs 实际</h2>
      <ul className="mt-2 flex flex-col gap-2">
        {CATEGORIES.map((c) => {
          // 计划
          const plan = plans[c]
          // 实际
          const actual = spentBy[c]
          // 一行（点一下设计划）
          return (
            <li key={c}>
              <button onClick={() => setPlanFor(c)} className="w-full rounded-2xl border border-line bg-card px-4 py-3 text-left">
                <div className="flex items-center gap-3">
                  {/* 图标 */}
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-oat">
                    <Icon name={CATEGORY[c].icon} size={16} />
                  </span>
                  {/* 名称 */}
                  <span className="flex-1 text-[14px] font-medium">{CATEGORY[c].label}</span>
                  {/* 实际 / 计划 */}
                  <span className="text-[14px] font-semibold">{formatEUR(actual)}</span>
                  <span className="w-[88px] text-right text-[12px] text-muted">{plan !== undefined ? `/ ${formatEUR(plan)}` : '未设计划'}</span>
                </div>
                {/* 有计划才显示进度条 */}
                {plan !== undefined && plan > 0 && (
                  <div className="mt-2 pl-11">
                    <Meter value={actual} max={plan} label={`${CATEGORY[c].label}预算使用情况`} thin />
                    {actual > plan && (
                      <div className="mt-1 flex items-center gap-1 text-[11px] text-accent">
                        <Icon name="alert" size={12} />
                        超支 {formatEUR(actual - plan)}
                      </div>
                    )}
                  </div>
                )}
              </button>
            </li>
          )
        })}
      </ul>

      {/* ===== 花费记录 ===== */}
      <h2 className="mt-6 text-[15px] font-semibold">花费记录</h2>
      {data.expenses.length === 0 && <p className="mt-2 text-[13px] text-muted">还没有记录。点右下角「记一笔」，买东西、吃饭、坐车都可以随手记。</p>}
      {[...byDate.entries()].map(([date, list]) => {
        // 这天的日期文字
        const d = new Date(`${date}T12:00:00`)
        // 这天一共花了多少
        const daySum = list.reduce((sum, e) => sum + expenseEUR(e, rates), 0)
        // 一组
        return (
          <section key={date} className="mt-3">
            {/* 日期 + 当天合计 */}
            <div className="flex items-baseline justify-between text-[12px] text-muted">
              <span>
                {d.getMonth() + 1}月{d.getDate()}日 {WEEK[d.getDay()]}
              </span>
              <span>合计 {formatEUR(daySum)}</span>
            </div>
            {/* 当天的每一笔 */}
            <ul className="mt-1.5 overflow-hidden rounded-2xl border border-line bg-card">
              {list.map((e) => (
                <li key={e.id} className="border-b border-line last:border-b-0">
                  <button onClick={() => setForm({ expense: e })} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                    {/* 分类图标 */}
                    <Icon name={CATEGORY[e.category].icon} size={16} className="shrink-0 text-muted" />
                    {/* 备注或分类 */}
                    <span className="min-w-0 flex-1 truncate text-[14px]">{e.note ?? CATEGORY[e.category].label}</span>
                    {/* 金额（原币种 + 欧元） */}
                    <span className="shrink-0 text-right">
                      <span className="block text-[14px] font-semibold">{formatMoney(e.amount, e.currency)}</span>
                      {e.currency !== 'EUR' && <span className="block text-[11px] text-muted">≈ {formatEUR(expenseEUR(e, rates))}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )
      })}

      {/* ===== 汇率 ===== */}
      <section className="mt-6 rounded-2xl border border-line bg-card p-4">
        <h2 className="text-[15px] font-semibold">汇率（1 欧元 = ）</h2>
        <p className="mt-1 text-[12px] leading-relaxed text-muted">丹麦克朗和欧元挂钩，基本不变；瑞典、挪威克朗是 2026 年 11 月的大约值，出发前可以按银行或 XE 的汇率改一下。</p>
        <div className="mt-2 flex flex-col gap-2">
          {CURRENCIES.filter((c) => c !== 'EUR').map((c) => (
            <label key={c} className="flex items-center gap-3">
              {/* 币种 */}
              <span className="w-28 text-[14px]">
                {c} <span className="text-[12px] text-muted">{CURRENCY_ZH[c]}</span>
              </span>
              {/* 汇率（离开输入框时保存） */}
              <input
                inputMode="decimal"
                defaultValue={String(rates[c])}
                key={`${c}-${rates[c]}`}
                onBlur={(e) => setRate(c, Number(e.target.value.replace(',', '.')))}
                className={`${INPUT} h-10 flex-1`}
              />
              {/* 恢复默认 */}
              {rates[c] !== DEFAULT_RATES[c] && (
                <button type="button" onClick={() => setRate(c, DEFAULT_RATES[c])} className="shrink-0 text-[12px] text-muted underline">
                  默认
                </button>
              )}
            </label>
          ))}
        </div>
      </section>

      {/* ===== 记一笔（右下角浮动按钮） ===== */}
      <button
        onClick={() => setForm({ expense: null })}
        className="fixed right-5 bottom-[calc(max(env(safe-area-inset-bottom),8px)+76px)] z-30 flex h-14 items-center gap-2 rounded-full bg-ink px-5 text-[15px] text-paper shadow-[0_6px_18px_var(--shadow)]"
      >
        <Icon name="plus" size={18} />
        记一笔
      </button>

      {/* 记账表单 */}
      {form && <ExpenseForm tripId={trip.id} initial={form.expense} defaultCurrency={defaultCurrency} defaultDate={toISODate(new Date())} onClose={() => setForm(null)} />}

      {/* 设置计划 */}
      {planFor && (
        <PlanSheet
          title={planFor === 'total' ? '总预算（欧元）' : `${CATEGORY[planFor].label}的计划（欧元）`}
          hint={planFor === 'total' ? '不填就按各分类计划相加。' : '不填就是没有计划，只记实际花了多少。'}
          value={planFor === 'total' ? budget.total : plans[planFor]}
          onClose={() => setPlanFor(null)}
          onSave={async (v) => {
            await savePlan(planFor, v)
            setPlanFor(null)
          }}
        />
      )}
    </div>
  )
}

// 设置计划的小面板
function PlanSheet({ title, hint, value, onClose, onSave }: { title: string; hint: string; value?: number; onClose: () => void; onSave: (v: number | null) => void }) {
  // 输入内容
  const [text, setText] = useState(value !== undefined ? String(value) : '')
  // 返回面板
  return (
    <Sheet
      title={title}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          {/* 清除 */}
          <button onClick={() => onSave(null)} className="h-12 flex-1 rounded-2xl border border-line-strong text-[15px]">
            清除
          </button>
          {/* 保存 */}
          <button
            onClick={() => {
              // 解析数字
              const v = Number(text.replace(',', '.'))
              // 合法就保存，否则清除
              onSave(v > 0 ? v : null)
            }}
            className="h-12 flex-[2] rounded-2xl bg-ink text-[15px] text-paper"
          >
            保存
          </button>
        </div>
      }
    >
      <Field label="金额（€）" hint={hint}>
        <input inputMode="decimal" autoFocus value={text} onChange={(e) => setText(e.target.value.replace(/[^0-9.,]/g, ''))} placeholder="例如 600" className={`${INPUT} h-14 text-[24px] font-semibold`} />
      </Field>
    </Sheet>
  )
}
