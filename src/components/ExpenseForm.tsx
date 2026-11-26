// ============================================================
// 记一笔 / 编辑花费
//   金额、币种（默认当地货币）、分类、备注、日期
// ============================================================

// 引入 React 钩子
import { useState } from 'react'
// 引入数据库
import { db } from '../db/db'
// 引入生成 ID 的工具
import { newId } from '../db/pins'
// 引入数据结构
import type { Currency, Expense, ExpenseCategory } from '../db/schema'
// 引入货币工具
import { CATEGORIES, CATEGORY, CURRENCIES, formatMoney, toEUR, useRates } from '../lib/money'
// 引入组件
import { Icon } from './Icon'
import { Field, INPUT, Segmented, Sheet } from './Sheet'

// 表单组件
export function ExpenseForm({
  tripId,
  initial,
  defaultCurrency,
  defaultDate,
  onClose,
}: {
  // 旅行 ID
  tripId: string
  // 要编辑的花费（新建时为 null）
  initial: Expense | null
  // 新建时默认的币种
  defaultCurrency: Currency
  // 新建时默认的日期
  defaultDate: string
  // 关闭
  onClose: () => void
}) {
  // 金额（字符串，方便输入）
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '')
  // 币种
  const [currency, setCurrency] = useState<Currency>(initial?.currency ?? defaultCurrency)
  // 分类
  const [category, setCategory] = useState<ExpenseCategory>(initial?.category ?? 'food')
  // 备注
  const [note, setNote] = useState(initial?.note ?? '')
  // 日期
  const [date, setDate] = useState(initial?.date ?? defaultDate)
  // 出错
  const [error, setError] = useState<string | null>(null)
  // 汇率
  const rates = useRates()

  // 解析金额（支持逗号小数点，例如 12,50）
  const value = Number(amount.replace(',', '.'))

  // 保存
  const save = async () => {
    // 金额要大于 0
    if (!(value > 0)) {
      setError('请输入金额')
      return
    }
    // 要保存的数据
    const e: Expense = {
      id: initial?.id ?? newId('exp'),
      tripId,
      category,
      amount: value,
      currency,
      date,
      note: note.trim() || undefined,
      createdAt: initial?.createdAt ?? Date.now(),
    }
    // 写入
    await db.expenses.put(e)
    // 关闭
    onClose()
  }

  // 删除
  const remove = async () => {
    // 没有可删的
    if (!initial) return
    // 确认
    if (!window.confirm('删除这一笔？')) return
    // 删除
    await db.expenses.delete(initial.id)
    // 关闭
    onClose()
  }

  // 返回表单
  return (
    <Sheet
      title={initial ? '编辑这一笔' : '记一笔'}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          {/* 编辑时可以删除 */}
          {initial ? (
            <button onClick={remove} aria-label="删除这一笔" className="flex h-12 w-12 items-center justify-center rounded-2xl border border-line-strong text-muted">
              <Icon name="trash" size={18} />
            </button>
          ) : (
            <button onClick={onClose} className="h-12 flex-1 rounded-2xl border border-line-strong text-[15px]">
              取消
            </button>
          )}
          <button onClick={save} className="h-12 flex-[2] rounded-2xl bg-ink text-[15px] text-paper">
            保存
          </button>
        </div>
      }
    >
      {/* 金额：大字号，打开就能输入 */}
      <Field label="金额">
        <input
          // 数字键盘（带小数点）
          inputMode="decimal"
          // 打开就聚焦
          autoFocus
          // 当前值
          value={amount}
          // 只允许数字和小数点
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.,]/g, ''))}
          placeholder="0"
          className="h-16 w-full rounded-xl border border-line-strong bg-paper px-4 text-[32px] font-semibold text-ink outline-none focus:border-accent"
        />
      </Field>
      {/* 换算提示 */}
      {value > 0 && currency !== 'EUR' && <p className="mt-1 text-[12px] text-muted">≈ {formatMoney(Math.round(toEUR(value, currency, rates) * 100) / 100, 'EUR')}（按当前汇率）</p>}

      {/* 币种 */}
      <Field label="币种" group>
        <Segmented label="币种" value={currency} options={CURRENCIES.map((c) => ({ value: c, label: c }))} onChange={setCurrency} />
      </Field>

      {/* 分类 */}
      <Field label="分类" group>
        <div className="grid grid-cols-3 gap-1.5">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={category === c}
              onClick={() => setCategory(c)}
              className={`flex h-11 items-center justify-center gap-1.5 rounded-xl text-[13px] ${category === c ? 'bg-ink text-paper' : 'bg-oat'}`}
            >
              <Icon name={CATEGORY[c].icon} size={15} />
              {CATEGORY[c].label}
            </button>
          ))}
        </div>
      </Field>

      {/* 备注 */}
      <Field label="备注">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="例如 午饭、地铁 72 小时票" className={INPUT} />
      </Field>

      {/* 日期 */}
      <Field label="日期">
        <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className={INPUT} />
      </Field>

      {/* 出错 */}
      {error && <p className="mt-3 rounded-xl bg-accent-soft px-3 py-2 text-[13px] text-accent">{error}</p>}
    </Sheet>
  )
}
