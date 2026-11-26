// ============================================================
// 地点搜索：用免费的 Photon 服务（基于 OpenStreetMap，不需要 key）
//   - searchPlaces：按关键词搜店铺、景点、地址
//       默认只搜“当前范围”（地图看得到的区域，至少方圆 15 公里），按离中心的距离排序；
//       找不到时界面会提供「搜索全部地区」和「在 Google Maps 里搜」，不会突然冒出别的国家的店
//   - 输入坐标（例如 45.4642, 9.19）可以直接定位
//   - reverseGeocode：根据坐标查这里叫什么（给图钉自动取名）
// ============================================================

// 引入坐标类型和距离计算
import { distanceMeters, type LngLat } from './geo'

// Photon 服务地址
const PHOTON = 'https://photon.komoot.io'

// 一条搜索结果
export interface SearchResult {
  // 唯一 ID（OSM 类型 + 编号）
  id: string
  // 名称
  name: string
  // 类别（中文，例如“咖啡馆”）
  kind: string
  // 地址（街道、门牌、城市）
  address: string
  // 坐标
  lngLat: LngLat
  // 国家代码，例如 DE
  countryCode: string
  // 城市名
  city: string
  // 离搜索中心多远（米；有中心时才有）
  distance?: number
}

// 范围：[西, 南, 东, 北]（经纬度）
export type Bbox = [number, number, number, number]

// 以某点为中心、半径 km 公里的范围
export function bboxAround(c: LngLat, km: number): Bbox {
  // 纬度 1 度约 111 公里；经度要按纬度缩放
  const dLat = km / 111
  const dLng = km / (111 * Math.cos((c[1] * Math.PI) / 180))
  // 返回
  return [c[0] - dLng, c[1] - dLat, c[0] + dLng, c[1] + dLat]
}

// 两个范围合并（取能同时包住两者的范围）
export function bboxUnion(a: Bbox, b: Bbox): Bbox {
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]
}

// 在 Google Maps 里搜索关键词（以某点为中心）
export function googleMapsSearchUrl(query: string, near: LngLat | null): string {
  // 有中心就带上位置（这样 Google 会优先搜附近）
  const at = near ? `/@${near[1].toFixed(5)},${near[0].toFixed(5)},14z` : ''
  // 拼网址
  return `https://www.google.com/maps/search/${encodeURIComponent(query.trim())}${at}`
}

// 搜索选项
export interface SearchOptions {
  // 搜索中心（用来排序和算距离）
  near?: LngLat | null
  // 只在这个范围里搜（不传就是全部地区）
  bbox?: Bbox | null
}

// Photon 返回的单个结果里我们用到的字段
interface PhotonFeature {
  // 坐标
  geometry: { coordinates: [number, number] }
  // 属性
  properties: {
    osm_type?: string
    osm_id?: number
    osm_key?: string
    osm_value?: string
    name?: string
    street?: string
    housenumber?: string
    postcode?: string
    city?: string
    district?: string
    locality?: string
    country?: string
    countrycode?: string
  }
}

// 常见类别的中文名（键是 OSM 的分类值）
const KIND_ZH: Record<string, string> = {
  cafe: '咖啡馆',
  coffee: '咖啡店',
  restaurant: '餐厅',
  fast_food: '快餐',
  bar: '酒吧',
  pub: '酒馆',
  bakery: '面包店',
  supermarket: '超市',
  convenience: '便利店',
  clothes: '服装店',
  books: '书店',
  gift: '礼品店',
  chocolate: '巧克力店',
  department_store: '百货商店',
  mall: '商场',
  pharmacy: '药店',
  museum: '博物馆',
  attraction: '景点',
  viewpoint: '观景点',
  artwork: '艺术品',
  gallery: '画廊',
  hotel: '酒店',
  hostel: '青旅',
  guest_house: '民宿',
  station: '车站',
  stop: '车站',
  tram_stop: '电车站',
  bus_stop: '公交站',
  subway_entrance: '地铁口',
  aerodrome: '机场',
  church: '教堂',
  cathedral: '大教堂',
  place_of_worship: '宗教场所',
  castle: '城堡',
  palace: '宫殿',
  memorial: '纪念碑',
  monument: '纪念碑',
  park: '公园',
  marketplace: '市场',
  theatre: '剧院',
  cinema: '电影院',
  city: '城市',
  town: '城镇',
  suburb: '城区',
  house: '地址',
  street: '街道',
  residential: '街道',
  pedestrian: '步行街',
}

// 把一条 Photon 结果转成我们的格式
function toResult(f: PhotonFeature): SearchResult {
  // 属性
  const p = f.properties
  // 街道 + 门牌
  const street = [p.street, p.housenumber].filter(Boolean).join(' ')
  // 地址：街道、城区、城市（去重、去空）
  const address = [street, p.locality ?? p.district, p.city, p.country].filter((v, i, arr) => v && arr.indexOf(v) === i).join(' · ')
  // 名称：有名字用名字，没有就用街道或城市
  const name = p.name || street || p.city || '未命名地点'
  // 类别：先查分类值，再查分类键
  const kind = KIND_ZH[p.osm_value ?? ''] ?? KIND_ZH[p.osm_key ?? ''] ?? ''
  // 返回
  return {
    // ID
    id: `${p.osm_type ?? ''}${p.osm_id ?? Math.random()}`,
    name,
    kind,
    address,
    // 坐标（Photon 也是 [经度, 纬度]）
    lngLat: [f.geometry.coordinates[0], f.geometry.coordinates[1]],
    // 国家代码
    countryCode: (p.countrycode ?? '').toUpperCase(),
    // 城市（地点本身是城市时，用它的名字）
    city: p.city ?? (p.osm_value === 'city' || p.osm_value === 'town' ? (p.name ?? '') : ''),
  }
}

// 搜索地点；opts.bbox 有值时只搜这个范围，结果按离中心的距离排序；signal 用来取消过时的请求
export async function searchPlaces(query: string, opts: SearchOptions, signal?: AbortSignal): Promise<SearchResult[]> {
  // 去掉首尾空格
  const q = query.trim()
  // 太短不搜
  if (q.length < 2) return []
  // 输入的是坐标（“纬度, 经度”）：直接当作一个结果
  const m = /^(-?\d{1,2}(?:\.\d+)?)\s*[,，\s]\s*(-?\d{1,3}(?:\.\d+)?)$/.exec(q)
  if (m && Math.abs(+m[1]) <= 90 && Math.abs(+m[2]) <= 180) {
    return [{ id: `coord:${q}`, name: `坐标 ${(+m[1]).toFixed(5)}, ${(+m[2]).toFixed(5)}`, kind: '坐标', address: '直接放图钉', lngLat: [+m[2], +m[1]], countryCode: '', city: '' }]
  }
  // 拼接请求参数（范围内搜索时多要几个，方便按距离挑）
  const params = new URLSearchParams({ q, limit: opts.bbox ? '15' : '8' })
  // 中心：让附近的结果排在前面
  const near = opts.near ?? null
  if (near) {
    params.set('lon', near[0].toFixed(5))
    params.set('lat', near[1].toFixed(5))
  }
  // 只搜这个范围
  if (opts.bbox) params.set('bbox', opts.bbox.map((v) => v.toFixed(5)).join(','))
  // 发请求
  const res = await fetch(`${PHOTON}/api/?${params}`, { signal })
  // 失败就抛错
  if (!res.ok) throw new Error(`搜索失败：${res.status}`)
  // 解析结果
  const data = (await res.json()) as { features: PhotonFeature[] }
  // 转换格式，算距离
  const all = data.features.map((f) => {
    const r = toResult(f)
    if (near) r.distance = distanceMeters(near, r.lngLat)
    return r
  })
  // 去掉名字和地址都一样的重复结果
  const seen = new Set<string>()
  const unique = all.filter((r) => {
    // 用名字 + 地址判断是否重复
    const key = `${r.name}|${r.address}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  // 范围内搜索：只要名字或地址里真的有搜索词的结果（地图服务会给出“拼写相近”的结果，例如搜 stussy 给出 Stessa Direzione，容易误会）
  const words = fold(q).split(/[\s,，]+/).filter((w) => w.length >= 2)
  const matched = opts.bbox ? unique.filter((r) => words.every((w) => fold(`${r.name} ${r.address} ${r.kind}`).includes(w))) : unique
  // 范围内搜索：近的排前面
  if (opts.bbox && near) matched.sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0))
  // 返回（最多 10 个）
  return matched.slice(0, 10)
}

// 统一大小写、去掉重音符号（Stüssy → stussy，København → kobenhavn）
function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ø/gi, 'o')
    .replace(/æ/gi, 'ae')
    .replace(/ß/g, 'ss')
    .toLowerCase()
}

// 距离的文字：“350 m”“2.4 km”“1,200 km”
export function distanceText(m?: number): string {
  if (m === undefined) return ''
  if (m < 1000) return `${Math.round(m / 10) * 10} m`
  if (m < 100000) return `${(m / 1000).toFixed(1)} km`
  return `${Math.round(m / 1000).toLocaleString('en')} km`
}

// 根据坐标查地名（失败或没网时返回 null）
export async function reverseGeocode(p: LngLat): Promise<string | null> {
  try {
    // 发请求
    const res = await fetch(`${PHOTON}/reverse?lon=${p[0].toFixed(6)}&lat=${p[1].toFixed(6)}&limit=1`)
    // 失败
    if (!res.ok) return null
    // 解析
    const data = (await res.json()) as { features: PhotonFeature[] }
    // 没结果
    if (!data.features.length) return null
    // 取第一个结果的名字
    return toResult(data.features[0]).name
  } catch {
    // 没网等情况
    return null
  }
}

// 找一个城市附近的机场或火车站（「你可能感兴趣」里用）：机场搜方圆 70 公里，火车站搜方圆 12 公里，最多 3 个
export async function findHubs(center: LngLat, kind: 'airport' | 'station', cityName: string): Promise<{ name: string; lat: number; lng: number }[]> {
  // 请求参数：按 OpenStreetMap 的分类筛选
  const params = new URLSearchParams({
    q: kind === 'airport' ? 'airport' : cityName,
    osm_tag: kind === 'airport' ? 'aeroway:aerodrome' : 'railway:station',
    limit: '6',
    lon: center[0].toFixed(4),
    lat: center[1].toFixed(4),
    bbox: bboxAround(center, kind === 'airport' ? 70 : 12)
      .map((v) => v.toFixed(4))
      .join(','),
  })
  try {
    const res = await fetch(`${PHOTON}/api/?${params}`)
    if (!res.ok) return []
    const data = (await res.json()) as { features: PhotonFeature[] }
    // 去重，取前 3 个
    const seen = new Set<string>()
    return data.features
      .map((f) => ({ name: f.properties.name ?? '', lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] }))
      .filter((h) => h.name && !seen.has(h.name) && seen.add(h.name))
      .slice(0, 3)
  } catch {
    return []
  }
}
