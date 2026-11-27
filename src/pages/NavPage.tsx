// ============================================================
// App 内步行导航
//   - 顶部：下一个转向（大箭头 + 距离 + “在前方第 2 个路口左转，进入 xx 街”）
//   - 底部：你现在在哪条街、离下一个地点还有多远
//   - 地图跟着你走，朝向前进方向
//   - 偏离路线会自动重新规划；到达每个图钉会提示
//   - 可选语音播报；导航时屏幕常亮
//   - “模拟行走”：不用出门也能预览导航效果
// 网址：/nav（地图标签的图钉）或 /nav?day=3（第 3 天的日程）
// ============================================================

// 引入 React 钩子
// 引入地图顶部浮动按钮的起点（iPhone 全屏模式下会往下挪）
import { mapTop } from '../lib/appHeight'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
// 引入路由工具
import { useNavigate, useSearchParams } from 'react-router-dom'
// 引入图钉数据
import { usePins } from '../db/pins'
// 引入地图钩子
import { useMap } from '../map/useMap'
// 引入标记
import { pinMarker, useMeMarker } from '../map/markers'
// 引入步行路线绘制
import { drawWalkRoute } from '../map/walkRoute'
// 引入图层工具
import { collection, ensureLayer, nearestStreetName, setGeoJSON } from '../map/layers'
// 引入颜色变量
import { cssVar } from '../map/tripRoute'
// 引入定位
import { useGeolocation } from '../lib/useGeolocation'
// 引入屏幕常亮
import { useWakeLock } from '../lib/useWakeLock'
// 引入语音
import { getVoiceOn, setVoiceOn, speak, speechSupported, stopSpeech, unlockSpeech } from '../lib/speech'
// 引入导航计算
import { describeManeuver, getNavRoute, maneuverSentence, navDistance, trackProgress, type NavProgress, type NavRoute, type TurnIcon } from '../lib/navigation'
// 引入地理工具
import { cumulativeDistances, distanceMeters, formatDistance, formatDuration, pointAlong, type LngLat } from '../lib/geo'
// 引入 Google Maps 链接
import { googleMapsDirections } from '../lib/gmaps'
// 引入图标
import { Icon, type IconName } from '../components/Icon'
// 引入卡片高度测量
import { useSheetHeight } from '../components/useSheetHeight'

// 转向图标 → 界面图标
const TURN_ICON: Record<TurnIcon, IconName> = {
  depart: 'turnStraight',
  straight: 'turnStraight',
  left: 'turnLeft',
  right: 'turnRight',
  slightLeft: 'turnSlightLeft',
  slightRight: 'turnSlightRight',
  sharpLeft: 'turnSharpLeft',
  sharpRight: 'turnSharpRight',
  uturn: 'turnUturn',
  roundabout: 'turnRoundabout',
  arrive: 'pin',
}

// 步行速度（米/秒），用来估算剩余时间
const WALK_SPEED = 1.3
// 模拟行走的速度倍数（正常步速的 6 倍，方便预览）
const SIM_SPEEDUP = 6
// 离图钉多少米以内算到达
const ARRIVE_RADIUS = 22
// 离路线多少米以上算偏离
const OFF_ROUTE = 40
// 离第一个目的地超过多少米就不适合步行导航
const TOO_FAR = 20000

// 导航状态
type Phase = 'setup' | 'locating' | 'routing' | 'running' | 'done' | 'error'

// 页面组件
export default function NavPage() {
  // 网址参数
  const [params] = useSearchParams()
  // 第几天（没有就是地图标签的图钉）
  const day = params.get('day') ? Number(params.get('day')) : null
  // 页面跳转
  const navigate = useNavigate()
  // 图钉
  const { pins } = usePins(day)
  // 地图
  const { containerRef, map, styleRev } = useMap({ center: [13.405, 52.52], zoom: 14 })
  // 真实 GPS（一直在定位）
  const geo = useGeolocation(true)

  // 当前状态
  const [phase, setPhase] = useState<Phase>('setup')
  // 出错信息
  const [error, setError] = useState<string | null>(null)
  // 是否是模拟行走
  const [sim, setSim] = useState(false)
  // 模拟时是否暂停
  const [simPaused, setSimPaused] = useState(false)
  // 模拟的位置
  const [simPos, setSimPos] = useState<LngLat | null>(null)
  // 语音开关
  const [voice, setVoice] = useState(getVoiceOn())
  // 导航路线
  const [route, setRoute] = useState<NavRoute | null>(null)
  // 路线第 0 段对应第几个图钉
  const [routeFrom, setRouteFrom] = useState(0)
  // 当前进度
  const [progress, setProgress] = useState<NavProgress | null>(null)
  // 地图是否跟随我
  const [follow, setFollow] = useState(true)
  // 是否显示全部步骤
  const [stepsOpen, setStepsOpen] = useState(false)
  // 顶部小提示
  const [toast, setToast] = useState<string | null>(null)
  // 路线这一段没有街名时，从地图数据里找到的附近街道名
  const [nearbyStreet, setNearbyStreet] = useState<string | null>(null)
  // 上次查附近街道名的时间（最多 2 秒查一次）
  const lastStreetLookupRef = useRef(0)

  // 底部卡片（测量高度，让版权信息待在卡片上方）
  const sheetRef = useSheetHeight<HTMLElement>()

  // 当前使用的位置：模拟或真实
  const pos = sim ? simPos : geo.position
  // 在地图上显示我的位置
  useMeMarker(map, phase === 'setup' ? geo.position : pos)
  // 导航中保持屏幕常亮
  useWakeLock(phase === 'running')

  // 各种“记住上一次”的值（不需要触发重新渲染）
  const lastStepRef = useRef(-1)
  const nearSpokenRef = useRef(-1)
  const offSinceRef = useRef<number | null>(null)
  const lastRerouteRef = useRef(0)
  const rerouteRef = useRef<() => void>(() => {})
  const arrivedRef = useRef(new Set<number>())
  const simDistRef = useRef(0)
  const voiceRef = useRef(voice)
  // 语音开关变化时同步到 ref
  useEffect(() => {
    voiceRef.current = voice
  }, [voice])

  // 说一句话（开了语音才说）
  const say = useCallback((text: string) => {
    if (voiceRef.current) speak(text)
  }, [])

  // 第 i 个图钉的名字
  const pinName = useCallback((i: number) => pins?.[i]?.name ?? '目的地', [pins])

  // 请求路线：从 start 出发，依次经过 pins[from] 之后的所有图钉
  const buildRoute = useCallback(
    async (start: LngLat, from: number) => {
      // 没有图钉
      if (!pins) return
      // 途经点
      const points: LngLat[] = [start, ...pins.slice(from).map((p) => [p.lng, p.lat] as LngLat)]
      // 请求路线
      const r = await getNavRoute(points)
      // 保存
      setRoute(r)
      setRouteFrom(from)
      // 重置步骤记录
      lastStepRef.current = -1
      nearSpokenRef.current = -1
    },
    [pins],
  )

  // ----- 开始导航（真实 GPS） -----
  const startReal = async () => {
    // 在点按里解锁语音（iPhone 要求）
    if (voice) unlockSpeech('开始导航')
    // 真实模式
    setSim(false)
    // 还没定位到
    if (!geo.position) {
      setPhase('locating')
      return
    }
    // 开始规划
    await beginWith(geo.position)
  }

  // 有了位置之后开始规划路线
  const beginWith = async (start: LngLat) => {
    // 没有图钉
    if (!pins || pins.length === 0) return
    // 第一个图钉太远（例如人在格罗宁根，图钉在柏林）
    const d = distanceMeters(start, [pins[0].lng, pins[0].lat])
    if (d > TOO_FAR) {
      setError(`你离第 1 个地点还有 ${formatDistance(d)}，太远了，不适合步行导航。可以先用「模拟行走」预览，或者用 Google Maps 查公交。`)
      setPhase('error')
      return
    }
    // 第一个图钉就在身边：直接从第二个开始
    const from = d < ARRIVE_RADIUS ? 1 : 0
    // 已经在最后一个图钉了
    if (from >= pins.length) {
      setPhase('done')
      return
    }
    // 规划中
    setPhase('routing')
    try {
      // 请求路线
      await buildRoute(start, from)
      // 开始导航
      setPhase('running')
    } catch {
      // 失败
      setError('路线规划失败，请检查网络后再试')
      setPhase('error')
    }
  }

  // 定位到了，而且正在等定位，就开始
  useEffect(() => {
    // 不是在等定位
    if (phase !== 'locating' || !geo.position) return
    // 开始
    beginWith(geo.position)
  }, [phase, geo.position])

  // ----- 开始模拟行走 -----
  const startSim = async () => {
    // 解锁语音
    if (voice) unlockSpeech('开始模拟导航')
    // 至少要两个地点
    if (!pins || pins.length < 2) {
      setError('模拟行走至少需要 2 个地点')
      setPhase('error')
      return
    }
    // 模拟模式
    setSim(true)
    setSimPaused(false)
    // 从第 1 个地点出发
    const start: LngLat = [pins[0].lng, pins[0].lat]
    // 模拟位置放在起点
    setSimPos(start)
    // 走过的距离清零
    simDistRef.current = 0
    // 规划中
    setPhase('routing')
    try {
      // 从第 1 个地点出发，去第 2 个及之后的地点
      await buildRoute(start, 1)
      // 开始
      setPhase('running')
    } catch {
      setError('路线规划失败，请检查网络后再试')
      setPhase('error')
    }
  }

  // 整条路线的累计距离（模拟行走用）
  const routeCum = useMemo(() => (route ? cumulativeDistances(route.coords) : null), [route])

  // 模拟行走：每 0.5 秒沿路线往前走一段
  useEffect(() => {
    // 不是模拟、没开始、暂停中
    if (!sim || phase !== 'running' || simPaused || !route || !routeCum) return
    // 定时器
    const t = window.setInterval(() => {
      // 往前走（0.5 秒 × 步速 × 倍数）
      simDistRef.current += WALK_SPEED * SIM_SPEEDUP * 0.5
      // 新位置
      setSimPos(pointAlong(route.coords, routeCum, simDistRef.current))
    }, 500)
    // 清除
    return () => window.clearInterval(t)
  }, [sim, phase, simPaused, route, routeCum])

  // ----- 位置变化时更新进度 -----
  useEffect(() => {
    // 没在导航
    if (phase !== 'running' || !route || !pos || !pins) return
    // 计算进度
    const p = trackProgress(route, pos, lastStepRef.current < 0 ? 0 : lastStepRef.current)
    // 保存
    setProgress(p)

    // --- 偏离路线：离路线超过 40 米持续 5 秒，或者一下子偏出 150 米以上，就重新规划 ---
    // 当前目的地是第几个图钉
    const curTarget = routeFrom + route.steps[p.stepIndex].legIndex
    // 重新规划的函数（也给下面的定时检查用）
    rerouteRef.current = () => {
      // 距上次重算不到 10 秒就先不算
      if (Date.now() - lastRerouteRef.current < 10000) return
      // 记录时间
      lastRerouteRef.current = Date.now()
      // 清掉偏离计时
      offSinceRef.current = null
      // 提示
      setToast('已偏离路线，正在重新规划')
      say('已偏离路线，正在重新规划')
      // 从当前位置重新规划到当前目的地及之后的地点
      buildRoute(pos, curTarget).catch(() => setToast('重新规划失败，请检查网络'))
    }
    // 偏离了（模拟行走不会偏离）
    if (!sim && p.offRoute > OFF_ROUTE) {
      // 第一次偏离，记下时间
      if (offSinceRef.current === null) offSinceRef.current = Date.now()
      // 偏离够久或者偏得很远
      if (Date.now() - offSinceRef.current > 5000 || p.offRoute > 150) {
        rerouteRef.current()
        return
      }
      // 偏离中先不播报转向
      return
    }
    // 回到路线上，清掉计时
    offSinceRef.current = null

    // --- 到达图钉 ---
    // 当前这一段的目的地是第几个图钉
    const targetIdx = routeFrom + route.steps[p.stepIndex].legIndex
    // 目的地坐标
    const target = pins[targetIdx]
    // 离目的地很近，并且还没报过
    if (target && !arrivedRef.current.has(targetIdx) && (distanceMeters(pos, [target.lng, target.lat]) < ARRIVE_RADIUS || p.toLegEnd < 8)) {
      // 记下已到达
      arrivedRef.current.add(targetIdx)
      // 是最后一个
      if (targetIdx >= pins.length - 1) {
        // 播报
        say(`已到达 ${target.name}，导航结束`)
        // 结束
        setPhase('done')
        return
      }
      // 不是最后一个：提示并继续
      setToast(`已到达 ${target.name}`)
      say(`已到达 ${target.name}，继续前往 ${pinName(targetIdx + 1)}`)
      return
    }

    // --- 语音：进入新的一步时，播报下一个转向 ---
    // 下一步（转向点）
    const next = route.steps[p.stepIndex + 1]
    // 进入了新的一步
    if (p.stepIndex !== lastStepRef.current) {
      // 记下
      lastStepRef.current = p.stepIndex
      // 有下一步，而且这一步离转向点还有一段
      if (next && p.toNext > 40) {
        // 转向描述
        const m = describeManeuver(next, pinName(routeFrom + next.legIndex))
        // 路口提示
        const where = m.isTurn && p.crossingsAhead > 0 ? `在第 ${p.crossingsAhead + 1} 个路口` : ''
        // 播报，例如“沿 Unter den Linden 走 300 米，在第 2 个路口左转，进入 Friedrichstraße”
        say(`${route.steps[p.stepIndex].name ? `沿 ${route.steps[p.stepIndex].name} ` : ''}走 ${navDistance(p.toNext)}，${where}${maneuverSentence(m)}`)
      }
    }
    // 快到转向点（40 米内）时再提醒一次
    if (next && p.toNext <= 40 && nearSpokenRef.current !== p.stepIndex) {
      // 记下
      nearSpokenRef.current = p.stepIndex
      // 转向描述
      const m = describeManeuver(next, pinName(routeFrom + next.legIndex))
      // 到达类型不用提前提醒（上面到达时会说）
      if (next.type !== 'arrive') say(`前方${maneuverSentence(m)}`)
    }
  }, [pos, route, phase])

  // ----- 当前这一段没有街名时，查附近的街道名 -----
  useEffect(() => {
    // 没在导航
    if (!map || !progress || !route) return
    // 这一段有名字就不用查
    if (route.steps[progress.stepIndex]?.name) {
      setNearbyStreet(null)
      return
    }
    // 2 秒内查过就先不查
    if (Date.now() - lastStreetLookupRef.current < 2000) return
    // 记录时间
    lastStreetLookupRef.current = Date.now()
    // 查附近 30 米内最近的街道
    setNearbyStreet(nearestStreetName(map, progress.snapped))
  }, [map, progress, route])

  // ----- 地图跟随 -----
  useEffect(() => {
    // 没在导航或不跟随
    if (!map || phase !== 'running' || !follow || !progress) return
    // 平滑移动到当前位置，朝向前进方向，倾斜看 3D
    map.easeTo({
      // 中心：吸附到路线上的位置（偏离太远就用真实位置）
      center: progress.offRoute < OFF_ROUTE ? progress.snapped : (pos ?? progress.snapped),
      // 朝向
      bearing: progress.heading,
      // 倾斜
      pitch: 55,
      // 缩放
      zoom: 17.3,
      // 给顶部和底部的卡片留位置
      padding: { top: mapTop() + 174, bottom: 170, left: 0, right: 0 },
      // 动画时长
      duration: 900,
    })
  }, [map, phase, follow, progress, pos])

  // 每 3 秒检查一次是否偏离太久（人站着不动时 GPS 不更新，也要能重新规划）
  useEffect(() => {
    // 不在导航或者是模拟
    if (phase !== 'running' || sim) return
    // 定时检查
    const t = window.setInterval(() => {
      // 偏离超过 5 秒就重新规划
      if (offSinceRef.current !== null && Date.now() - offSinceRef.current > 5000) rerouteRef.current()
    }, 3000)
    // 清除
    return () => window.clearInterval(t)
  }, [phase, sim])

  // 用户手动拖动地图时，停止跟随
  useEffect(() => {
    // 地图没好
    if (!map) return
    // 拖动开始（originalEvent 存在说明是手指拖的，不是程序移动）
    const onDrag = (e: { originalEvent?: Event }) => {
      if (e.originalEvent) setFollow(false)
    }
    // 注册
    map.on('dragstart', onDrag)
    // 取消
    return () => {
      map.off('dragstart', onDrag)
    }
  }, [map])

  // ----- 画路线、图钉、下一个转向点 -----
  useEffect(() => {
    // 样式没好
    if (!map || styleRev === 0) return
    // 路线
    drawWalkRoute(map, 'nav', route?.coords ?? [], true)
    // 下一个转向点（小圆圈）
    const next = progress && route ? route.steps[progress.stepIndex + 1] : null
    // 写入数据源
    setGeoJSON(
      map,
      'nav-next',
      collection(next ? [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: next.coords[0] } }] : []),
    )
    // 圆圈图层
    ensureLayer(
      map,
      {
        id: 'nav-next-circle',
        type: 'circle',
        source: 'nav-next',
        paint: { 'circle-radius': 7, 'circle-color': cssVar('--card'), 'circle-stroke-color': cssVar('--accent'), 'circle-stroke-width': 3 },
      },
      null,
    )
  }, [map, styleRev, route, progress])

  // 图钉标记（不能拖动）
  useEffect(() => {
    // 没准备好
    if (!map || !pins) return
    // 每个图钉一个标记
    const markers = pins.map((p, i) => pinMarker(String(i + 1), p.name).setLngLat([p.lng, p.lat]).addTo(map))
    // 移除
    return () => markers.forEach((m) => m.remove())
  }, [map, pins])

  // 准备阶段：地图显示全部图钉
  useEffect(() => {
    // 不在准备阶段
    if (!map || !pins || pins.length === 0 || phase !== 'setup') return
    // 只有一个图钉
    if (pins.length === 1) {
      map.jumpTo({ center: [pins[0].lng, pins[0].lat], zoom: 15 })
      return
    }
    // 所有图钉的经纬度范围
    const lngs = pins.map((p) => p.lng)
    const lats = pins.map((p) => p.lat)
    // 装下全部
    const cam = map.cameraForBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: { top: mapTop() + 64, bottom: 330, left: 50, right: 50 } },
    )
    // 跳过去
    if (cam) map.jumpTo(cam)
  }, [map, pins, phase])

  // 提示自动消失
  useEffect(() => {
    // 没提示
    if (!toast) return
    // 3 秒后消失
    const t = setTimeout(() => setToast(null), 3000)
    // 清除
    return () => clearTimeout(t)
  }, [toast])

  // 离开页面时停止播报
  useEffect(() => () => stopSpeech(), [])

  // 退出导航
  const exit = () => {
    // 停止播报
    stopSpeech()
    // 返回上一页（没有上一页就去地图标签）
    if (window.history.length > 1) navigate(-1)
    else navigate(day ? `/day/${day}` : '/map')
  }

  // 切换语音
  const toggleVoice = () => {
    // 新状态
    const v = !voice
    // 保存
    setVoice(v)
    setVoiceOn(v)
    // 关掉时停止正在说的话
    if (!v) stopSpeech()
  }

  // ----- 计算界面要显示的内容 -----
  // 当前这一步
  const curStep = route && progress ? route.steps[progress.stepIndex] : null
  // 下一步（转向点）
  const nextStep = route && progress ? route.steps[progress.stepIndex + 1] : null
  // 再下一步
  const afterStep = route && progress ? route.steps[progress.stepIndex + 2] : null
  // 下一个转向的描述
  const nextM = nextStep ? describeManeuver(nextStep, pinName(routeFrom + nextStep.legIndex)) : null
  // 再下一个转向的描述
  const afterM = afterStep ? describeManeuver(afterStep, pinName(routeFrom + afterStep.legIndex)) : null
  // 当前目的地编号
  const targetIdx = route && progress && curStep ? routeFrom + curStep.legIndex : routeFrom

  // 页面内容
  return (
    <div className="relative h-full w-full overflow-hidden bg-paper">
      {/* 地图 */}
      <div className="absolute inset-0">
        <div ref={containerRef} className="h-full w-full" />
      </div>

      {/* ===== 导航中：偏离路线 ===== */}
      {phase === 'running' && progress && !sim && progress.offRoute > OFF_ROUTE && (
        <div className="absolute inset-x-3 top-[var(--map-top)] flex items-center gap-3.5 rounded-3xl bg-accent px-4 py-4 text-on-accent shadow-[0_8px_24px_var(--shadow)]">
          {/* 提醒图标 */}
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-black/10">
            <Icon name="alert" size={32} stroke={2} />
          </span>
          {/* 文字 */}
          <div>
            <div className="text-[18px] font-semibold">已偏离路线</div>
            <div className="text-[13px] opacity-85">离路线 {formatDistance(progress.offRoute)}，稍后会自动重新规划</div>
          </div>
        </div>
      )}

      {/* ===== 导航中：顶部转向提示 ===== */}
      {phase === 'running' && nextM && progress && (sim || progress.offRoute <= OFF_ROUTE) && (
        <div className="absolute inset-x-3 top-[var(--map-top)] rounded-3xl bg-ink px-4 py-3.5 text-paper shadow-[0_8px_24px_var(--shadow)]">
          <div className="flex items-center gap-3.5">
            {/* 大箭头 */}
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-paper/10">
              <Icon name={TURN_ICON[nextM.icon]} size={36} stroke={2} />
            </span>
            {/* 文字 */}
            <div className="min-w-0 flex-1">
              {/* 距离 */}
              <div className="text-[28px] leading-none font-semibold">{navDistance(progress.toNext)}</div>
              {/* 动作 */}
              <div className="mt-1 text-[16px] leading-snug font-medium">{nextM.action}</div>
              {/* 进入的街道 */}
              {nextM.street && <div className="truncate text-[14px] opacity-80">进入 {nextM.street}</div>}
              {/* 第几个路口 */}
              {nextM.isTurn && <div className="mt-0.5 text-[13px] opacity-80">{progress.crossingsAhead > 0 ? `在前方第 ${progress.crossingsAhead + 1} 个路口` : '在前方路口'}</div>}
            </div>
          </div>
          {/* 然后…… */}
          {afterM && (
            <div className="mt-2.5 flex items-center gap-2 border-t border-paper/15 pt-2 text-[13px] opacity-80">
              <span>然后</span>
              <Icon name={TURN_ICON[afterM.icon]} size={16} />
              <span className="truncate">{maneuverSentence(afterM)}</span>
            </div>
          )}
        </div>
      )}

      {/* 提示 */}
      {toast && (
        <div role="status" className="pointer-events-none absolute inset-x-0 top-[calc(var(--map-top)+150px)] flex justify-center px-6">
          <span className="rounded-full bg-accent px-4 py-2 text-[13px] text-on-accent shadow-lg">{toast}</span>
        </div>
      )}

      {/* 回到导航视角 */}
      {phase === 'running' && !follow && (
        <button onClick={() => setFollow(true)} className="absolute right-4 bottom-[calc(var(--sheet-h,180px)+16px)] flex h-11 items-center gap-1.5 rounded-full bg-card px-4 text-[13px] shadow-[0_1px_3px_var(--shadow-crisp)]">
          <Icon name="navigate" size={16} />
          回到导航
        </button>
      )}

      {/* ===== 导航中：底部信息栏 ===== */}
      {phase === 'running' && progress && curStep && (
        <section ref={sheetRef} className="absolute inset-x-0 bottom-0 rounded-t-[26px] border-t border-line bg-card px-5 pt-4 pb-[max(env(safe-area-inset-bottom),16px)] shadow-[0_-8px_24px_var(--shadow)]">
          {/* 当前街道 */}
          <div className="text-[12px] text-muted">你在</div>
          <div className="truncate font-serif text-[24px] leading-tight font-medium">
            {/* 有街名就显示街名；没有就显示附近的街道；都没有就是步行小路 */}
            {curStep.name || (nearbyStreet ? `${nearbyStreet} 附近` : '步行小路')}
          </div>
          {/* 到下一个地点 */}
          <div className="mt-1 text-[13px] text-muted">
            到 <b className="font-semibold text-ink">{pinName(targetIdx)}</b>：{formatDuration(progress.toLegEnd / WALK_SPEED)} · {formatDistance(progress.toLegEnd)}
            {pins && targetIdx < pins.length - 1 && ` · 全程还剩 ${formatDistance(progress.toEnd)}`}
          </div>
          {/* 操作按钮 */}
          <div className="mt-3 flex gap-2">
            {/* 结束 */}
            <button onClick={exit} className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-accent text-[14px] text-on-accent">
              <Icon name="close" size={16} />
              结束
            </button>
            {/* 语音 */}
            {speechSupported && (
              <button aria-label={voice ? '关闭语音' : '打开语音'} onClick={toggleVoice} className="flex h-11 w-12 items-center justify-center rounded-xl border border-line-strong">
                <Icon name={voice ? 'volume' : 'volumeOff'} size={18} />
              </button>
            )}
            {/* 全部步骤 */}
            <button aria-label="全部步骤" onClick={() => setStepsOpen(true)} className="flex h-11 w-12 items-center justify-center rounded-xl border border-line-strong">
              <Icon name="list" size={18} />
            </button>
            {/* 模拟时：暂停/继续 */}
            {sim && (
              <button aria-label={simPaused ? '继续模拟' : '暂停模拟'} onClick={() => setSimPaused((v) => !v)} className="flex h-11 w-12 items-center justify-center rounded-xl border border-line-strong">
                <Icon name={simPaused ? 'play' : 'pause'} size={18} />
              </button>
            )}
          </div>
          {/* 模拟提示 */}
          {sim && <p className="mt-2 text-center text-[11px] text-muted">模拟行走中（{SIM_SPEEDUP} 倍速），不是你的真实位置</p>}
        </section>
      )}

      {/* ===== 准备阶段 / 定位中 / 规划中 / 出错 / 完成 ===== */}
      {phase !== 'running' && (
        <section ref={sheetRef} className="absolute inset-x-0 bottom-0 rounded-t-[26px] border-t border-line bg-card px-5 pt-5 pb-[max(env(safe-area-inset-bottom),16px)] shadow-[0_-8px_24px_var(--shadow)]">
          {/* 标题 */}
          <div className="font-serif text-[15px] italic text-muted">Navigation</div>
          <h1 className="text-[22px] font-semibold">{phase === 'done' ? '已到达全部地点' : '步行导航'}</h1>

          {/* 要去的地点 */}
          {pins && pins.length > 0 && phase !== 'done' && (
            <p className="mt-1 text-[13px] leading-relaxed text-muted">
              {pins.map((p, i) => `${i + 1}. ${p.name}`).join('  →  ')}
            </p>
          )}

          {/* 没有图钉 */}
          {pins && pins.length === 0 && <p className="mt-2 text-[14px] text-muted">还没有地点。先在「地图」里放几个图钉吧。</p>}

          {/* 定位中 / 规划中 */}
          {(phase === 'locating' || phase === 'routing') && (
            <p className="mt-3 rounded-xl bg-oat px-3 py-2 text-[13px]">{phase === 'locating' ? (geo.error ?? '正在获取你的位置…') : '正在规划路线…'}</p>
          )}

          {/* 出错 */}
          {phase === 'error' && error && <p className="mt-3 rounded-xl bg-accent-soft px-3 py-2 text-[13px] leading-relaxed text-accent">{error}</p>}

          {/* 完成 */}
          {phase === 'done' && <p className="mt-2 text-[14px] text-muted">一共 {pins?.length ?? 0} 个地点，旅途愉快！</p>}

          {/* 按钮 */}
          <div className="mt-4 flex flex-col gap-2">
            {/* 从我的位置出发 */}
            {phase !== 'done' && pins && pins.length > 0 && (
              <button
                onClick={startReal}
                disabled={phase === 'locating' || phase === 'routing'}
                className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-ink text-[15px] text-paper disabled:opacity-50"
              >
                <Icon name="navigate" size={17} />
                从我的位置出发
              </button>
            )}
            {/* 模拟行走 */}
            {phase !== 'done' && pins && pins.length >= 2 && (
              <button
                onClick={startSim}
                disabled={phase === 'routing'}
                className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-line-strong text-[15px] disabled:opacity-50"
              >
                <Icon name="play" size={16} />
                模拟行走（从第 1 个地点出发，预览效果）
              </button>
            )}
            {/* 出错时：用 Google Maps 公交 */}
            {phase === 'error' && pins && pins.length > 0 && (
              <a href={googleMapsDirections(pins.slice(0, 1), true, 'transit')} target="_blank" rel="noopener noreferrer" className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-line-strong text-[15px]">
                <Icon name="external" size={16} />
                用 Google Maps 查公交
              </a>
            )}
            {/* 底部一行：语音开关 + 返回 */}
            <div className="flex gap-2">
              {/* 语音开关 */}
              {speechSupported && phase !== 'done' && (
                <button onClick={toggleVoice} className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-line text-[13px] text-muted">
                  <Icon name={voice ? 'volume' : 'volumeOff'} size={16} />
                  语音播报：{voice ? '开' : '关'}
                </button>
              )}
              {/* 返回 */}
              <button onClick={exit} className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-line text-[13px] text-muted">
                <Icon name="back" size={15} />
                返回
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ===== 全部步骤 ===== */}
      {stepsOpen && route && (
        <div className="absolute inset-0 z-40 flex flex-col justify-end bg-black/30" onClick={() => setStepsOpen(false)}>
          <div className="max-h-[75%] overflow-y-auto rounded-t-[26px] bg-card px-5 pt-4 pb-8" onClick={(e) => e.stopPropagation()}>
            {/* 标题 */}
            <div className="flex items-center justify-between">
              <h2 className="text-[17px] font-semibold">全部步骤</h2>
              <button aria-label="关闭" onClick={() => setStepsOpen(false)} className="flex h-9 w-9 items-center justify-center text-muted">
                <Icon name="close" size={18} />
              </button>
            </div>
            {/* 步骤列表 */}
            <ol className="mt-2 flex flex-col">
              {route.steps.map((s, i) => {
                // 这一步的转向描述
                const m = describeManeuver(s, pinName(routeFrom + s.legIndex))
                // 是不是当前这一步的下一个转向
                const isNext = progress ? i === progress.stepIndex + 1 : false
                // 已经走过
                const done = progress ? i <= progress.stepIndex : false
                // 一行
                return (
                  <li key={i} className={`flex items-center gap-3 border-b border-line py-2.5 last:border-b-0 ${done ? 'opacity-40' : ''}`}>
                    {/* 图标 */}
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${isNext ? 'bg-ink text-paper' : 'bg-oat'}`}>
                      <Icon name={TURN_ICON[m.icon]} size={20} />
                    </span>
                    {/* 文字 */}
                    <span className="min-w-0 flex-1 text-[14px] leading-snug">{maneuverSentence(m)}</span>
                    {/* 这一步走多远 */}
                    {s.length > 0 && <span className="shrink-0 text-[12px] text-muted">{formatDistance(s.length)}</span>}
                  </li>
                )
              })}
            </ol>
          </div>
        </div>
      )}
    </div>
  )
}
