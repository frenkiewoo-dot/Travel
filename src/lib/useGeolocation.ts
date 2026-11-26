// ============================================================
// GPS 定位：持续获取手机当前位置
// 注意：iPhone 只有在 App 打开、屏幕亮着的时候才会更新位置
// ============================================================

// 引入 React 钩子
import { useCallback, useEffect, useRef, useState } from 'react'
// 引入坐标类型
import type { LngLat } from './geo'

// 定位状态
export interface GeoState {
  // 当前位置（还没定位到时是 null）
  position: LngLat | null
  // 精度（米）
  accuracy: number | null
  // 出错时的提示文字
  error: string | null
  // 是否正在定位
  watching: boolean
}

// 定位钩子；auto = true 时页面打开就自动开始定位
export function useGeolocation(auto = true) {
  // 定位状态
  const [state, setState] = useState<GeoState>({ position: null, accuracy: null, error: null, watching: false })
  // 保存 watchPosition 返回的编号，用来停止定位
  const watchId = useRef<number | null>(null)

  // 开始定位
  const start = useCallback(() => {
    // 浏览器不支持定位
    if (!('geolocation' in navigator)) {
      // 给出提示
      setState((s) => ({ ...s, error: '这个浏览器不支持定位' }))
      return
    }
    // 已经在定位了就不重复开始
    if (watchId.current !== null) return
    // 标记为正在定位，清掉旧错误
    setState((s) => ({ ...s, watching: true, error: null }))
    // 持续监听位置变化（第一次调用时 iPhone 会弹窗问你是否允许）
    watchId.current = navigator.geolocation.watchPosition(
      // 拿到新位置
      (pos) => {
        // 更新状态
        setState({
          // 转成 [经度, 纬度]
          position: [pos.coords.longitude, pos.coords.latitude],
          // 精度
          accuracy: pos.coords.accuracy,
          // 没有错误
          error: null,
          // 正在定位
          watching: true,
        })
      },
      // 出错
      (err) => {
        // 根据错误类型给出中文提示
        const msg =
          // 1 = 用户拒绝了定位权限
          err.code === 1
            ? // iPhone / iPad 和电脑的设置位置不一样，分开提示
              /iPhone|iPad|iPod/.test(navigator.userAgent)
              ? '没有定位权限。可在 iPhone「设置 → 隐私与安全性 → 定位服务 → Safari 网站」里改为“使用 App 期间”'
              : '没有定位权限。点浏览器地址栏左边的图标，把“位置”改成允许，再刷新页面'
            // 2 = 暂时定位不到（例如在室内）
            : err.code === 2
              ? '暂时定位不到，请到开阔的地方再试'
              // 3 = 超时
              : '定位超时，请稍后再试'
        // 更新状态
        setState((s) => ({ ...s, error: msg }))
        // 权限被拒绝时停止监听
        if (err.code === 1 && watchId.current !== null) {
          // 停止
          navigator.geolocation.clearWatch(watchId.current)
          // 清空编号
          watchId.current = null
          // 标记为未定位
          setState((s) => ({ ...s, watching: false }))
        }
      },
      // 定位选项
      {
        // 高精度（用 GPS，更准但更耗电）
        enableHighAccuracy: true,
        // 可以用 10 秒内的旧位置
        maximumAge: 10000,
        // 最多等 20 秒
        timeout: 20000,
      },
    )
  }, [])

  // 自动开始，并在离开页面时停止定位（省电）
  useEffect(() => {
    // 需要自动开始就开始
    if (auto) start()
    // 组件卸载时
    return () => {
      // 如果还在定位就停掉
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current)
      // 清空编号
      watchId.current = null
    }
  }, [auto, start])

  // 返回状态和“开始定位”函数
  return { ...state, start }
}
