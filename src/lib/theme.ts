// ============================================================
// 深色 / 浅色模式
// 偏好：跟随系统 / 浅色 / 深色，存在本机浏览器里（只是显示偏好，丢了也没关系）
// ============================================================

// 引入 React 的“订阅外部数据”钩子
import { useSyncExternalStore } from 'react'

// 用户的偏好
export type ThemePref = 'system' | 'light' | 'dark'
// 实际生效的主题
export type Theme = 'light' | 'dark'

// 存储偏好用的键名
const KEY = 'noel-theme'
// 系统是否是深色模式的查询器
const media = window.matchMedia('(prefers-color-scheme: dark)')
// 订阅者列表（主题变化时通知它们）
const listeners = new Set<() => void>()

// 读取偏好（读不到就默认跟随系统）
export function getThemePref(): ThemePref {
  // 浏览器存储可能被禁用，所以用 try 包起来
  try {
    // 读取保存的值
    const v = localStorage.getItem(KEY)
    // 是合法值就返回
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {
    // 读不到就忽略
  }
  // 默认跟随系统
  return 'system'
}

// 算出实际主题
export function resolveTheme(pref = getThemePref()): Theme {
  // 跟随系统时看系统设置
  if (pref === 'system') return media.matches ? 'dark' : 'light'
  // 否则就用用户选的
  return pref
}

// 把主题写到 <html data-theme="..."> 上，CSS 会根据它切换颜色
function apply() {
  // 设置属性
  document.documentElement.dataset.theme = resolveTheme()
  // 通知所有订阅者
  listeners.forEach((fn) => fn())
}

// 修改偏好
export function setThemePref(pref: ThemePref) {
  // 保存
  try {
    localStorage.setItem(KEY, pref)
  } catch {
    // 存不了也没关系，本次打开期间照样生效
  }
  // 立即应用
  apply()
}

// 系统主题变化时（例如晚上自动切深色）重新应用
media.addEventListener('change', apply)
// App 启动时先应用一次
apply()

// 订阅函数（给 React 用）
function subscribe(fn: () => void) {
  // 加入订阅者
  listeners.add(fn)
  // 返回取消订阅的函数
  return () => listeners.delete(fn)
}

// React 钩子：拿到当前实际主题，主题变化时组件会自动重新渲染
export function useTheme(): Theme {
  // 订阅主题变化
  return useSyncExternalStore(subscribe, () => resolveTheme())
}

// React 钩子：拿到当前偏好
export function useThemePref(): ThemePref {
  // 订阅主题变化
  return useSyncExternalStore(subscribe, () => getThemePref())
}
