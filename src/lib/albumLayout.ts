// ============================================================
// 相册排版：把一个城市的照片分成“章节”，每章选一种拼图版式
//   - 有景点的照片：一个景点一章（例如「Nyhavn」）
//   - 没归到景点的照片：按日期分章（「城市漫步」）
//   - 每章按张数、横竖构图和章节序号选不同的版式，整本相册有节奏变化，不是一排排的方格
// 参考了 Instagram 高赞旅行帖和杂志排版的常见做法：
//   大图开场、一大两小、错落的竖图、横滑轮播、拍立得散落、瀑布流“照片堆”
// ============================================================

// 引入数据结构
import type { Photo, Place } from '../db/schema'

// 一章
export interface Chapter {
  // 唯一键：'place:地点ID' 或 'day:2026-12-21'（也用来存这一章写的一句话）
  key: string
  // 是景点章节还是城市漫步
  kind: 'place' | 'walk'
  // 景点（景点章节才有）
  place?: Place
  // 这一章第一张照片的日期 'YYYY-MM-DD'
  date: string
  // 照片（按拍摄时间）
  photos: Photo[]
}

// 一个排版块（一章由一个或几个块组成）
export type Block =
  // 单张大图
  | { t: 'hero'; p: Photo[] }
  // 两张竖图并排，右边那张往下错开
  | { t: 'duo'; p: Photo[] }
  // 一张横图 + 一张叠在右下角的小图（像叠放的照片）
  | { t: 'stack'; p: Photo[] }
  // 一张竖的大图 + 两张小图上下叠（mirror = 大图在右边）
  | { t: 'trio'; p: Photo[]; mirror: boolean }
  // 上面一张宽图，下面两张并排
  | { t: 'wideTrio'; p: Photo[] }
  // 四张错落拼图（大小交错）
  | { t: 'quad'; p: Photo[] }
  // 横向滑动的轮播（像 Instagram 多图帖子）
  | { t: 'carousel'; p: Photo[] }
  // 拍立得散落（1–3 张，微微倾斜）
  | { t: 'polaroid'; p: Photo[] }
  // 两列错落的瀑布流（“照片堆”）
  | { t: 'masonry'; p: Photo[] }

// 是不是竖图
export const isPortrait = (p: Photo) => p.height > p.width * 1.05

// 把照片分成章节
export function buildChapters(photos: Photo[], places: Place[]): Chapter[] {
  // 地点 ID → 地点
  const placeById = new Map(places.map((p) => [p.id, p]))
  // 键 → 章节
  const map = new Map<string, Chapter>()
  // 逐张放进对应的章节（照片已经按时间排好）
  for (const ph of photos) {
    // 归属的景点（景点被删了就当作没归类）
    const place = ph.placeId ? placeById.get(ph.placeId) : undefined
    // 日期
    const date = ph.takenAt.slice(0, 10)
    // 章节键
    const key = place ? `place:${place.id}` : `day:${date}`
    // 还没有这一章就新建
    if (!map.has(key)) map.set(key, { key, kind: place ? 'place' : 'walk', place, date, photos: [] })
    // 放进去
    map.get(key)!.photos.push(ph)
  }
  // 按每章第一张照片的时间排序
  return [...map.values()].sort((a, b) => a.photos[0].takenAt.localeCompare(b.photos[0].takenAt))
}

// 给一章选版式（i = 第几章，用来让相邻章节的版式不一样）
export function layoutChapter(ch: Chapter, i: number): Block[] {
  // 照片
  const p = ch.photos
  // 张数
  const n = p.length
  // 城市漫步：少的用拍立得，多的用瀑布流
  if (ch.kind === 'walk') return n <= 3 ? [{ t: 'polaroid', p }] : [{ t: 'masonry', p }]
  // 单张：大图
  if (n === 1) return [{ t: 'hero', p }]
  // 两张：都是竖图就错落并排，否则叠放
  if (n === 2) return [isPortrait(p[0]) && isPortrait(p[1]) ? { t: 'duo', p } : { t: 'stack', p }]
  // 三张
  if (n === 3) return [trioFor(p, i)]
  // 四张：错落拼图
  if (n === 4) return [{ t: 'quad', p }]
  // 五张：大图开场 + 四张拼图
  if (n === 5) return [{ t: 'hero', p: p.slice(0, 1) }, { t: 'quad', p: p.slice(1) }]
  // 六张：单数章节用两组“一大两小”（左右镜像），双数章节用大图 + 轮播
  if (n === 6 && i % 2 === 1) return [trioFor(p.slice(0, 3), 0), trioFor(p.slice(3), 1)]
  // 更多：大图开场 + 其余放进轮播
  return [{ t: 'hero', p: p.slice(0, 1) }, { t: 'carousel', p: p.slice(1) }]
}

// 三张照片的版式：第一张是竖图用“一大两小”，否则“宽图在上”
function trioFor(p: Photo[], i: number): Block {
  return isPortrait(p[0]) ? { t: 'trio', p, mirror: i % 2 === 1 } : { t: 'wideTrio', p }
}

// 照片的宽高比，限制在 [min, max] 之间（太细长的裁一点）
export function clampAspect(p: Photo, min: number, max: number): number {
  return Math.min(max, Math.max(min, p.width / p.height))
}

// 瀑布流：把照片分到两列，尽量让两列一样高
export function splitColumns(photos: Photo[]): [Photo[], Photo[]] {
  // 两列
  const cols: [Photo[], Photo[]] = [[], []]
  // 两列当前的高度（按宽度 1 算）
  const h = [0, 0]
  // 逐张放到较矮的那一列
  for (const ph of photos) {
    // 较矮的列
    const c = h[0] <= h[1] ? 0 : 1
    // 放进去
    cols[c].push(ph)
    // 高度增加（宽高比限制在 0.7–1.5）
    h[c] += 1 / clampAspect(ph, 0.7, 1.5)
  }
  // 返回
  return cols
}

// 罗马数字（章节编号用，1–39 够用）
export function roman(n: number): string {
  // 十位
  const tens = ['', 'X', 'XX', 'XXX']
  // 个位
  const ones = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX']
  // 超出就用阿拉伯数字
  return n > 0 && n < 40 ? tens[Math.floor(n / 10)] + ones[n % 10] : String(n)
}

// 法语的月份缩写（和 App 的法式风格一致）
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

// 'YYYY-MM-DD' → “21 déc.”
export function frenchDate(date: string): string {
  // 拆开
  const [, m, d] = date.split('-').map(Number)
  // 拼起来
  return `${d} ${MOIS[(m || 1) - 1]}`
}

// 中文星期
const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

// 'YYYY-MM-DD' → “12月21日 周一”
export function chineseDate(date: string): string {
  // 拆开
  const [y, m, d] = date.split('-').map(Number)
  // 星期几
  const w = new Date(y, m - 1, d).getDay()
  // 拼起来
  return `${m}月${d}日 ${WEEK[w]}`
}
