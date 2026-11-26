// ============================================================
// 进度条（预算用）
//   - 正常：深色；用到 90% 以上：金色提醒；超支：酒红色（同时配图标和文字，不只靠颜色）
//   - 没填满的部分用同色系的浅色，一眼能看出进度
// ============================================================

// 进度条组件；value 是已花，max 是计划
export function Meter({ value, max, label, thin }: { value: number; max: number; label: string; thin?: boolean }) {
  // 比例（0 到 1）
  const ratio = max > 0 ? value / max : 0
  // 状态：超支 / 快用完 / 正常
  const state = ratio > 1 ? 'over' : ratio >= 0.9 ? 'warn' : 'ok'
  // 填充和底色
  const fill = state === 'over' ? 'bg-accent' : state === 'warn' ? 'bg-gold' : 'bg-ink'
  const track = state === 'over' ? 'bg-accent-soft' : state === 'warn' ? 'bg-gold/20' : 'bg-line'
  // 返回进度条（读屏软件会读出百分比）
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.round(value)}
      aria-valuetext={`${Math.round(ratio * 100)}%`}
      className={`w-full overflow-hidden rounded-full ${track} ${thin ? 'h-1.5' : 'h-2.5'}`}
    >
      {/* 填充部分（最多填满） */}
      <div className={`h-full rounded-full ${fill}`} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
    </div>
  )
}
