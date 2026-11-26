// ============================================================
// 汇率换算表（预算页）
//   - 最上面一行是基准货币（例如 1 欧元），下面每一行显示“1 基准 = 多少这种货币”
//   - 点货币代码：换成别的货币（点最上面的就是换基准）
//   - 数字可以直接改（手动汇率）；× 删除这一行；「添加货币」
//   - 「更新汇率」：从欧洲央行参考汇率获取最新（每个工作日更新）
// ============================================================

// 引入 React 钩子
import { useState } from 'react'
// 引入货币工具
import { ALL_CURRENCIES, CURRENCY_ZH, DEFAULT_RATES, addCurrency, fetchRates, formatRate, removeCurrency, replaceCurrency, resetRate, setRelativeRate, useFx } from '../lib/money'
// 引入组件
import { Icon } from './Icon'
import { INPUT, Sheet } from './Sheet'

// 换算表组件
export function CurrencyTable() {
  // 汇率和换算表
  const { rates, list, updated } = useFx()
  // 选货币的面板：add = 添加；其他 = 要换掉的那个货币
  const [picking, setPicking] = useState<{ mode: 'add' } | { mode: 'replace'; code: string } | null>(null)
  // 更新状态
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)
  // 正在更新
  const [busy, setBusy] = useState(false)

  // 基准货币
  const base = list[0]
  // 1 基准 = 多少 code
  const rel = (code: string) => (rates[code] ?? 1) / (rates[base] ?? 1)

  // 在线更新
  const update = async () => {
    setBusy(true)
    setStatus(null)
    try {
      const date = await fetchRates()
      setStatus({ ok: true, text: `已更新为欧洲央行 ${date} 的参考汇率` })
    } catch {
      setStatus({ ok: false, text: '更新失败（可能没网），继续用现在的汇率' })
    } finally {
      setBusy(false)
    }
  }

  // 返回
  return (
    <section className="mt-6 rounded-2xl border border-line bg-card p-4">
      {/* 标题 + 更新 */}
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[15px] font-semibold">汇率换算</h2>
        <button onClick={update} disabled={busy} className="flex h-9 items-center gap-1 rounded-full border border-line-strong px-3 text-[12px] disabled:opacity-50">
          <Icon name="download" size={13} />
          {busy ? '正在更新…' : '更新汇率'}
        </button>
      </div>
      <p className="mt-1 text-[12px] leading-relaxed text-muted">
        {updated ? `欧洲央行参考汇率（${updated.date}）` : '现在是大约值，联网时点「更新汇率」获取最新'}。点货币代码可以换货币，数字可以直接改。
      </p>
      {status && <p className={`mt-2 rounded-lg px-2.5 py-1.5 text-[12px] ${status.ok ? 'bg-sage-soft text-sage' : 'bg-accent-soft text-accent'}`}>{status.text}</p>}

      {/* 表格 */}
      <ul className="mt-3 flex flex-col divide-y divide-line">
        {list.map((code, i) => (
          <li key={code} className="flex items-center gap-2 py-2">
            {/* 货币（点它换） */}
            <button
              onClick={() => setPicking({ mode: 'replace', code })}
              aria-label={i === 0 ? `基准货币 ${code}，点击更换` : `${code}，点击更换货币`}
              className="flex w-[118px] shrink-0 items-center gap-1 text-left"
            >
              <span className="min-w-0">
                <span className="flex items-center gap-1 text-[15px] font-semibold">
                  {code}
                  <Icon name="chevronDown" size={12} className="text-muted" />
                </span>
                <span className="block truncate text-[11px] text-muted">{CURRENCY_ZH[code] ?? code}</span>
              </span>
            </button>
            {/* 数值 */}
            {i === 0 ? (
              <span className="flex h-10 flex-1 items-center rounded-xl bg-oat px-3 text-[15px] font-semibold">
                1<span className="ml-2 text-[11px] font-normal text-muted">基准</span>
              </span>
            ) : (
              <input
                inputMode="decimal"
                aria-label={`1 ${base} 等于多少 ${code}`}
                defaultValue={formatRate(rel(code))}
                key={`${base}-${code}-${rel(code)}`}
                onBlur={(e) => setRelativeRate(code, base, Number(e.target.value.replace(',', '.')))}
                className={`${INPUT} h-10 min-w-0 flex-1 tabular-nums`}
              />
            )}
            {/* 删除（基准不能删，至少留两种） */}
            {i > 0 ? (
              <button aria-label={`删除 ${code}`} disabled={list.length <= 2} onClick={() => removeCurrency(code)} className="flex h-10 w-9 shrink-0 items-center justify-center text-muted disabled:opacity-30">
                <Icon name="close" size={15} />
              </button>
            ) : (
              <span className="w-9 shrink-0" />
            )}
          </li>
        ))}
      </ul>
      {/* 添加 */}
      <button onClick={() => setPicking({ mode: 'add' })} className="mt-2 flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-line-strong text-[13px] text-muted">
        <Icon name="plus" size={14} />
        添加货币
      </button>

      {/* 选货币 */}
      {picking && (
        <CurrencyPicker
          title={picking.mode === 'add' ? '添加货币' : picking.code === base ? '换基准货币' : `把 ${picking.code} 换成…`}
          exclude={picking.mode === 'add' ? list : [picking.code]}
          onClose={() => setPicking(null)}
          onPick={async (code) => {
            if (picking.mode === 'add') await addCurrency(code)
            else await replaceCurrency(picking.code, code)
            setPicking(null)
          }}
        />
      )}
      {/* 恢复默认（隐藏的小功能：改坏了可以恢复） */}
      {list.some((c) => c !== 'EUR' && rates[c] !== DEFAULT_RATES[c] && !updated) && (
        <button onClick={() => list.forEach((c) => resetRate(c))} className="mt-2 text-[12px] text-muted underline underline-offset-2">
          恢复默认汇率
        </button>
      )}
    </section>
  )
}

// 选一种货币（可以搜索）
function CurrencyPicker({ title, exclude, onPick, onClose }: { title: string; exclude: string[]; onPick: (c: string) => void; onClose: () => void }) {
  // 搜索词
  const [q, setQ] = useState('')
  // 过滤
  const shown = ALL_CURRENCIES.filter((c) => !exclude.includes(c) && (`${c} ${CURRENCY_ZH[c]}`.toLowerCase().includes(q.trim().toLowerCase())))
  // 返回
  return (
    <Sheet title={title} onClose={onClose}>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索，例如 CNY 或 人民币" aria-label="搜索货币" className={INPUT} autoFocus />
      <ul className="mt-2">
        {shown.map((c) => (
          <li key={c}>
            <button onClick={() => onPick(c)} className="flex w-full items-center justify-between border-b border-line py-3 text-left">
              <span className="text-[15px] font-semibold">{c}</span>
              <span className="text-[13px] text-muted">{CURRENCY_ZH[c]}</span>
            </button>
          </li>
        ))}
        {shown.length === 0 && <li className="py-3 text-[13px] text-muted">没有找到</li>}
      </ul>
    </Sheet>
  )
}
