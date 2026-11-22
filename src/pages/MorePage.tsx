// ============================================================
// 更多：外观设置、数据存储状态、建设进度
// ============================================================

// 引入 React 钩子
import { useEffect, useState } from 'react'
// 引入主题工具
import { setThemePref, useThemePref, type ThemePref } from '../lib/theme'
// 引入图标
import { Icon } from '../components/Icon'

// 建设计划（每一步做什么）
const PLAN: { step: number; title: string; done: boolean }[] = [
  { step: 1, title: '地图首页、今日旅程、未来旅程', done: true },
  { step: 2, title: '地图：搜索、图钉、路线、App 内逐路口导航', done: true },
  { step: 3, title: '行程编辑、城市详情（酒店 / 景点）', done: false },
  { step: 4, title: '日程安排、城际与市内交通', done: false },
  { step: 5, title: '票夹（车票离线查看、全屏二维码）', done: false },
  { step: 6, title: '预算、常用链接、导出 / 导入备份', done: false },
  { step: 7, title: '调研填充真实数据、圣诞节期间提醒', done: false },
]

// 主题选项
const THEMES: { value: ThemePref; label: string }[] = [
  { value: 'system', label: '跟随系统' },
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
]

// 页面组件
export default function MorePage() {
  // 当前主题偏好
  const pref = useThemePref()
  // 是否已获得持久存储
  const [persisted, setPersisted] = useState<boolean | null>(null)

  // 打开页面时查询存储状态
  useEffect(() => {
    // 浏览器支持才查询
    navigator.storage?.persisted?.().then(setPersisted)
  }, [])

  // 页面内容
  return (
    <div className="h-full overflow-y-auto bg-paper px-5 pt-[max(env(safe-area-inset-top),24px)] pb-8">
      {/* 斜体小标题 */}
      <div className="font-serif text-[16px] italic text-muted">Réglages</div>
      {/* 标题 */}
      <h1 className="mt-1 text-[28px] font-semibold">更多</h1>

      {/* 外观 */}
      <section className="mt-5 rounded-2xl border border-line bg-card p-4">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold">
          <Icon name="moon" size={17} />
          外观
        </h2>
        {/* 三选一的分段按钮 */}
        <div role="radiogroup" aria-label="外观" className="mt-3 flex gap-1 rounded-xl bg-oat p-1">
          {THEMES.map((t) => (
            <button
              key={t.value}
              role="radio"
              aria-checked={pref === t.value}
              onClick={() => setThemePref(t.value)}
              className={`h-10 flex-1 rounded-lg text-[13px] ${pref === t.value ? 'bg-card font-medium shadow-sm' : 'text-muted'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </section>

      {/* 数据存储 */}
      <section className="mt-3 rounded-2xl border border-line bg-card p-4">
        <h2 className="text-[15px] font-semibold">数据存储</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted">
          所有数据只存在这台手机里，不会上传。
          {persisted === true && ' 已开启持久存储，系统不会自动清理。'}
          {persisted === false && ' 建议把 App 添加到主屏幕使用，并定期导出备份（第 6 步加入）。'}
        </p>
      </section>

      {/* 建设进度 */}
      <section className="mt-3 rounded-2xl border border-line bg-card p-4">
        <h2 className="text-[15px] font-semibold">建设进度</h2>
        <ol className="mt-3 flex flex-col gap-2.5">
          {PLAN.map((p) => (
            <li key={p.step} className="flex items-start gap-3 text-[14px]">
              {/* 步骤编号：完成的用绿色 */}
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ${p.done ? 'bg-sage-soft text-sage' : 'bg-oat text-muted'}`}
              >
                {p.step}
              </span>
              {/* 步骤内容 */}
              <span className={p.done ? '' : 'text-muted'}>{p.title}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* 版权说明 */}
      <p className="mt-5 text-center text-[11px] leading-relaxed text-muted">
        地图数据 © OpenStreetMap 贡献者 · 地图服务 OpenFreeMap
        <br />
        步行路线 OSRM / FOSSGIS · 地点搜索 Photon / komoot
      </p>
    </div>
  )
}
