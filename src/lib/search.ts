// ============================================================
// 地点搜索：用免费的 Photon 服务（基于 OpenStreetMap，不需要 key）
//   - searchPlaces：按关键词搜店铺、景点、地址，优先显示地图附近的结果
//   - reverseGeocode：根据坐标查这里叫什么（给图钉自动取名）
// ============================================================

// 引入坐标类型
import type { LngLat } from './geo'

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
  }
}

// 搜索地点；near 是地图中心，用来让附近的结果排在前面；signal 用来取消过时的请求
export async function searchPlaces(query: string, near: LngLat | null, signal?: AbortSignal): Promise<SearchResult[]> {
  // 去掉首尾空格
  const q = query.trim()
  // 太短不搜
  if (q.length < 2) return []
  // 拼接请求参数
  const params = new URLSearchParams({ q, limit: '8' })
  // 有地图中心就加上位置偏好
  if (near) {
    // 经度
    params.set('lon', near[0].toFixed(5))
    // 纬度
    params.set('lat', near[1].toFixed(5))
  }
  // 发请求
  const res = await fetch(`${PHOTON}/api/?${params}`, { signal })
  // 失败就抛错
  if (!res.ok) throw new Error(`搜索失败：${res.status}`)
  // 解析结果
  const data = (await res.json()) as { features: PhotonFeature[] }
  // 转换格式
  const all = data.features.map(toResult)
  // 去掉名字和地址都一样的重复结果
  const seen = new Set<string>()
  // 过滤
  return all.filter((r) => {
    // 用名字 + 地址判断是否重复
    const key = `${r.name}|${r.address}`
    // 出现过就去掉
    if (seen.has(key)) return false
    // 记下来
    seen.add(key)
    // 保留
    return true
  })
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
