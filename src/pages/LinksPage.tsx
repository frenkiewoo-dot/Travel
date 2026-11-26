// ============================================================
// 常用链接（/links）：交通、地图、订房等网站和 App 的快捷入口
//   内置一份常用的，也可以添加自己的（存在手机里）
// ============================================================

// 引入 React 钩子
import { useState } from 'react'
// 引入路由
import { useNavigate } from 'react-router-dom'
// 引入实时查询
import { useLiveQuery } from 'dexie-react-hooks'
// 引入数据库
import { db } from '../db/db'
// 引入生成 ID 的工具
import { newId } from '../db/pins'
// 引入组件
import { Icon } from '../components/Icon'
import { Field, INPUT, Sheet } from '../components/Sheet'

// 一个链接
interface LinkItem {
  // 名称
  title: string
  // 说明
  desc: string
  // 网址
  url: string
}

// 内置的常用链接（公开网站）
const GROUPS: { title: string; links: LinkItem[] }[] = [
  {
    title: '交通',
    links: [
      { title: 'NS', desc: '荷兰火车（格罗宁根 ↔ 阿姆斯特丹机场）', url: 'https://www.ns.nl/en' },
      { title: 'SAS', desc: '北欧航空：航班状态、值机、改签', url: 'https://www.flysas.com' },
      { title: 'DSB', desc: '丹麦火车', url: 'https://www.dsb.dk/en/' },
      { title: 'SJ', desc: '瑞典火车', url: 'https://www.sj.se/en' },
      { title: 'DB', desc: '德国火车', url: 'https://www.bahn.de' },
      { title: 'FlixBus', desc: '欧洲长途大巴', url: 'https://www.flixbus.com' },
      { title: 'Arlanda Express', desc: '斯德哥尔摩机场快线', url: 'https://www.arlandaexpress.com' },
    ],
  },
  {
    title: '市内交通',
    links: [
      { title: 'DOT', desc: '哥本哈根车票、City Pass', url: 'https://dinoffentligetransport.dk' },
      { title: 'Rejseplanen', desc: '丹麦官方查路线', url: 'https://www.rejseplanen.dk' },
      { title: 'SL', desc: '斯德哥尔摩车票和路线', url: 'https://sl.se/en' },
      { title: 'BVG', desc: '柏林车票和路线', url: 'https://www.bvg.de/en' },
    ],
  },
  {
    title: '地图',
    links: [
      { title: 'Google Maps', desc: '导航、公交', url: 'https://www.google.com/maps' },
      { title: 'Apple 地图', desc: 'iPhone 自带地图', url: 'https://maps.apple.com' },
    ],
  },
  {
    title: '订房',
    links: [
      { title: 'Hostelworld', desc: '青旅', url: 'https://www.hostelworld.com' },
      { title: 'Booking.com', desc: '酒店、青旅', url: 'https://www.booking.com' },
    ],
  },
  {
    title: '城市旅游',
    links: [
      { title: 'Visit Copenhagen', desc: '哥本哈根官方旅游网站', url: 'https://www.visitcopenhagen.com' },
      { title: 'Visit Stockholm', desc: '斯德哥尔摩官方旅游网站', url: 'https://www.visitstockholm.com' },
      { title: 'visitBerlin', desc: '柏林官方旅游网站', url: 'https://www.visitberlin.de/en' },
    ],
  },
  {
    title: '其他',
    links: [
      { title: 'XE 汇率', desc: '查实时汇率', url: 'https://www.xe.com/currencyconverter/' },
      { title: 'yr.no 天气', desc: '挪威气象局，北欧天气预报很准', url: 'https://www.yr.no/en' },
    ],
  },
]

// 自己添加的链接（存在设置表里）
interface CustomLink {
  id: string
  title: string
  url: string
}

// 存自定义链接的设置名
const CUSTOM_KEY = 'customLinks'

// 页面组件
export default function LinksPage() {
  // 页面跳转
  const navigate = useNavigate()
  // 自定义链接
  const custom = (useLiveQuery(() => db.settings.get(CUSTOM_KEY))?.value as CustomLink[] | undefined) ?? []
  // 是否显示添加表单
  const [adding, setAdding] = useState(false)

  // 保存自定义链接列表
  const saveCustom = (list: CustomLink[]) => db.settings.put({ key: CUSTOM_KEY, value: list })

  // 页面内容
  return (
    <div className="h-full overflow-y-auto bg-paper px-5 pt-[max(env(safe-area-inset-top),12px)] pb-10">
      {/* 返回 */}
      <button aria-label="返回" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/more'))} className="-ml-3 flex h-11 w-11 items-center justify-center">
        <Icon name="back" size={22} />
      </button>
      {/* 标题 */}
      <div className="font-serif text-[16px] italic text-muted">Liens</div>
      <h1 className="text-[28px] font-semibold">常用链接</h1>

      {/* 我的链接 */}
      <section className="mt-5">
        <h2 className="text-[13px] font-semibold text-muted">我的链接</h2>
        <ul className="mt-2 overflow-hidden rounded-2xl border border-line bg-card">
          {custom.map((l) => (
            <li key={l.id} className="flex items-center border-b border-line last:border-b-0">
              <a href={l.url} target="_blank" rel="noopener noreferrer" className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3">
                <Icon name="link" size={16} className="shrink-0 text-muted" />
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-medium">{l.title}</span>
                  <span className="block truncate text-[12px] text-muted">{l.url.replace(/^https?:\/\//, '')}</span>
                </span>
              </a>
              {/* 删除 */}
              <button
                aria-label={`删除 ${l.title}`}
                onClick={() => window.confirm(`删除「${l.title}」？`) && saveCustom(custom.filter((x) => x.id !== l.id))}
                className="flex h-11 w-11 shrink-0 items-center justify-center text-muted"
              >
                <Icon name="close" size={15} />
              </button>
            </li>
          ))}
          {/* 添加 */}
          <li>
            <button onClick={() => setAdding(true)} className="flex w-full items-center gap-3 px-4 py-3 text-[14px] text-muted">
              <Icon name="plus" size={16} />
              添加链接（例如订房确认页、活动报名页）
            </button>
          </li>
        </ul>
      </section>

      {/* 内置分组 */}
      {GROUPS.map((g) => (
        <section key={g.title} className="mt-5">
          <h2 className="text-[13px] font-semibold text-muted">{g.title}</h2>
          <ul className="mt-2 overflow-hidden rounded-2xl border border-line bg-card">
            {g.links.map((l) => (
              <li key={l.url} className="border-b border-line last:border-b-0">
                <a href={l.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-medium">{l.title}</span>
                    <span className="block truncate text-[12px] text-muted">{l.desc}</span>
                  </span>
                  <Icon name="external" size={15} className="shrink-0 text-muted" />
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {/* 添加表单 */}
      {adding && <AddLink onClose={() => setAdding(false)} onSave={(l) => saveCustom([...custom, l]).then(() => setAdding(false))} />}
    </div>
  )
}

// 添加链接的表单
function AddLink({ onClose, onSave }: { onClose: () => void; onSave: (l: CustomLink) => void }) {
  // 名称
  const [title, setTitle] = useState('')
  // 网址
  const [url, setUrl] = useState('')
  // 保存
  const submit = () => {
    // 去空格
    const u = url.trim()
    // 网址必填
    if (!u) return
    // 补上 https://
    const full = /^https?:\/\//i.test(u) ? u : `https://${u}`
    // 名称不填就用网址
    onSave({ id: newId('link'), title: title.trim() || full.replace(/^https?:\/\//, ''), url: full })
  }
  // 返回表单
  return (
    <Sheet
      title="添加链接"
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <button onClick={onClose} className="h-12 flex-1 rounded-2xl border border-line-strong text-[15px]">
            取消
          </button>
          <button onClick={submit} className="h-12 flex-[2] rounded-2xl bg-ink text-[15px] text-paper">
            保存
          </button>
        </div>
      }
    >
      <Field label="名称">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例如 青旅预订确认" className={INPUT} />
      </Field>
      <Field label="网址 *">
        <input value={url} onChange={(e) => setUrl(e.target.value)} type="url" inputMode="url" placeholder="https://…" className={INPUT} />
      </Field>
    </Sheet>
  )
}
