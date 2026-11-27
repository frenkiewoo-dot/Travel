// ============================================================
// 记录“有没有还没备份的改动”，用来提醒你导出备份
//   - 你新填、修改、删除行程 / 地点 / 车票 / 花费 / 照片时，记下“从什么时候开始有改动没备份”
//   - 导出备份（或用备份整体替换）之后清掉这个记录
//   - App 自己在后台写的东西（第一次打开时的初始行程、推荐内容更新）不算你的改动
//   - 记录存在 localStorage（和数据库在同一个地方，只在这台设备上）
// ============================================================

// 引入 React 钩子
import { useEffect, useState } from 'react'

// “从什么时候开始有改动没备份”的存储名
const SINCE_KEY = 'noel-unsavedSince'
// “稍后提醒”到什么时候的存储名
const SNOOZE_KEY = 'noel-backupSnoozeUntil'
// 改动记录变化时发出的事件名（页面用它实时刷新）
const EVENT = 'noel-unsaved-change'
// 有改动没备份多久之后开始提醒（毫秒）：1 天
const NUDGE_AFTER_MS = 24 * 3600 * 1000

// 算作“你的数据”的表（设置、路线缓存不算：里面多是 App 自己存的东西）
export const TRACKED_TABLES = new Set(['trips', 'stops', 'segments', 'places', 'dayPlans', 'tickets', 'ticketFiles', 'expenses', 'photos'])

// 现在是不是 App 自己在后台写数据（大于 0 = 是，这期间的改动不记）
let quiet = 0

// 安全地读 localStorage（隐私模式等情况下可能读不了）
function read(key: string): number | null {
  try {
    // 读出数字
    const v = Number(localStorage.getItem(key))
    // 没有或不是数字就当作没有
    return Number.isFinite(v) && v > 0 ? v : null
  } catch {
    // 读不了
    return null
  }
}

// 安全地写 localStorage（null = 删除）
function write(key: string, value: number | null) {
  try {
    // 删除或保存
    if (value == null) localStorage.removeItem(key)
    else localStorage.setItem(key, String(value))
  } catch {
    // 写不了就算了，不影响使用
  }
  // 通知页面刷新
  window.dispatchEvent(new Event(EVENT))
}

// 让一段 App 自己的后台写入不算作你的改动
export async function quietly<T>(fn: () => Promise<T>): Promise<T> {
  // 进入后台写入
  quiet++
  try {
    // 执行
    return await fn()
  } finally {
    // 结束
    quiet--
  }
}

// 数据库里有一次改动（由数据库的中间层调用）
export function noteChange() {
  // App 自己的后台写入：不记
  if (quiet > 0) return
  // 已经有“没备份的改动”了：保持最早的那个时间
  if (read(SINCE_KEY)) return
  // 记下现在
  write(SINCE_KEY, Date.now())
}

// 刚备份过（或刚用备份整体替换过）：清掉记录
export function clearUnsaved() {
  // 删除记录和“稍后提醒”
  write(SINCE_KEY, null)
  write(SNOOZE_KEY, null)
}

// 稍后再提醒（默认 1 天后）
export function snoozeBackup(ms = NUDGE_AFTER_MS) {
  // 记下到什么时候
  write(SNOOZE_KEY, Date.now() + ms)
}

// 实时读取：从什么时候开始有改动没备份（null = 都备份过了）
export function useUnsavedSince(): number | null {
  // 当前值
  const [since, setSince] = useState(() => read(SINCE_KEY))
  // 改动记录变化、切回 App 时刷新
  useEffect(() => {
    // 重新读
    const update = () => setSince(read(SINCE_KEY))
    // 监听
    window.addEventListener(EVENT, update)
    document.addEventListener('visibilitychange', update)
    // 离开时取消监听
    return () => {
      window.removeEventListener(EVENT, update)
      document.removeEventListener('visibilitychange', update)
    }
  }, [])
  // 返回
  return since
}

// 首页要不要提醒备份：有改动超过 1 天没备份，并且没有点过“稍后”
export function useBackupNudge(): { show: boolean; days: number } {
  // 从什么时候开始没备份
  const since = useUnsavedSince()
  // 稍后提醒到什么时候（跟着 since 一起刷新就够了：点“稍后”时也会发事件）
  const [snoozeUntil, setSnoozeUntil] = useState(() => read(SNOOZE_KEY))
  // 跟着事件刷新
  useEffect(() => {
    // 重新读
    const update = () => setSnoozeUntil(read(SNOOZE_KEY))
    // 监听
    window.addEventListener(EVENT, update)
    // 取消监听
    return () => window.removeEventListener(EVENT, update)
  }, [])
  // 现在
  const now = Date.now()
  // 判断
  const show = since != null && now - since > NUDGE_AFTER_MS && (snoozeUntil == null || now > snoozeUntil)
  // 已经几天没备份
  const days = since ? Math.max(1, Math.floor((now - since) / 86400000)) : 0
  // 返回
  return { show, days }
}
