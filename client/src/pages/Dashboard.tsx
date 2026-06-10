import { useState, useEffect } from 'react';
import { useDemo } from '../components/Layout';

interface ClientInPipeline {
  name: string; stage: string; shootDate?: string; packageType: string; value: number;
  galleryStatus?: 'not_started' | 'editing' | 'ready' | 'delivered';
  nextPayment?: { label: string; amount: number; due: string };
  unreadMsgs: number;
}

interface SentItem { id: string; to: string; preview: string; time: string; }

const DEMO_PIPELINE: ClientInPipeline[] = [
  { name:'Sarah & Mike', stage:'booking', shootDate:'2026-08-15', packageType:'Wedding Full', value:4500, nextPayment:{label:'Retainer',amount:1500,due:'3天后到期'}, unreadMsgs:2 },
  { name:'David L.', stage:'editing', shootDate:'2026-05-28', packageType:'Portrait', value:850, galleryStatus:'editing', unreadMsgs:1 },
  { name:'Jennifer K.', stage:'delivery', shootDate:'2026-05-10', packageType:'Wedding Day', value:3400, galleryStatus:'ready', unreadMsgs:0 },
  { name:'Michael T.', stage:'inquiry', packageType:'Commercial', value:0, unreadMsgs:0 },
  { name:'The Chens', stage:'editing', shootDate:'2026-06-01', packageType:'Wedding Full', value:5200, galleryStatus:'editing', nextPayment:{label:'尾款',amount:1300,due:'1周后'}, unreadMsgs:0 },
  { name:'Lisa R.', stage:'completed', shootDate:'2026-04-20', packageType:'Event', value:1800, galleryStatus:'delivered', unreadMsgs:0 },
];

const STAGE: Record<string,{label:string;icon:string;color:string}> = {
  inquiry:{label:'咨询',icon:'📨',color:'#007AFF'}, booking:{label:'已定',icon:'📋',color:'#5856D6'},
  pre_shoot:{label:'拍前',icon:'📸',color:'#FF9500'}, shoot_day:{label:'拍摄',icon:'🎬',color:'#FF3B30'},
  editing:{label:'修图',icon:'🎨',color:'#AF52DE'}, delivery:{label:'交付',icon:'📦',color:'#34C759'},
  completed:{label:'完成',icon:'✅',color:'#8E8E93'},
};

// Time-saved breakdown (minutes)
const TIME_SAVED = {
  autoReply: { minPerMsg: 3, count: 8, label: '自动回复 × 8' },
  draftReply: { minPerMsg: 4, count: 2, label: 'AI 起草 × 2' },
  classification: { minPerMsg: 0.5, count: 10, label: '自动分类 × 10' },
  invoice: { minPerMsg: 5, count: 2, label: '发票生成 × 2' },
};

export default function Dashboard() {
  const { demo } = useDemo();
  const [data] = useState({ today:{newMessages:3,autoReplied:8,urgent:1,draftInvoices:2}, pipeline:DEMO_PIPELINE });
  const [toast, setToast] = useState('');
  const [expandedPipeline, setExpandedPipeline] = useState(false);
  const [showTimeDetail, setShowTimeDetail] = useState(false);
  const [sentItems, setSentItems] = useState<SentItem[]>([]);
  const [urgentSent, setUrgentSent] = useState(false);
  const [normalSent, setNormalSent] = useState(false);

  const { today } = data;
  const activeJobs = data.pipeline.filter(c => c.stage !== 'completed').length;

  // Time saved calculation
  const totalMin = Object.values(TIME_SAVED).reduce((s, t) => s + t.minPerMsg * t.count, 0);
  const hours = Math.floor(totalMin / 60);
  const mins = Math.round(totalMin % 60);

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2000); };

  const handleSend = (type: 'urgent'|'normal') => {
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (type === 'urgent') {
      setUrgentSent(true);
      setSentItems(prev => [{ id: Date.now().toString(), to: 'Sarah & Mike', preview: '已发送：加时+冲印回复', time: now }, ...prev]);
      flash('✓ 已发送至 Sarah & Mike');
    } else {
      setNormalSent(true);
      setSentItems(prev => [{ id: Date.now().toString(), to: 'David L.', preview: '已发送：修图进度回复', time: now }, ...prev]);
      flash('✓ 已发送至 David L.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Hero */}
      <div>
        <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.5px', margin: 0 }}>早上好，Emma</h2>
        <p style={{ fontSize: 14, color: '#86868B', margin: '4px 0 0', letterSpacing: '-.1px' }}>
          {today.newMessages > 0
            ? `${activeJobs} 个进行中的项目 · ${today.urgent} 条紧急消息待处理`
            : `${activeJobs} 个项目进行中 · 全部处理完毕 ✓`}
        </p>
      </div>

      {/* Time Saved — clickable for breakdown */}
      <div onClick={() => setShowTimeDetail(!showTimeDetail)} style={{
        background: 'linear-gradient(135deg, rgba(0,122,255,.06), rgba(88,86,214,.06))',
        borderRadius: 16, padding: '14px 18px', cursor: 'pointer',
        border: '.5px solid rgba(0,122,255,.1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#007AFF', letterSpacing: '-.5px' }}>{hours}h {mins}min</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-.1px' }}>本周为你节省的时间</div>
            <div style={{ fontSize: 12, color: '#86868B' }}>点击查看明细 ▾</div>
          </div>
        </div>
        {showTimeDetail && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '.5px solid rgba(0,0,0,.06)' }}>
            {Object.entries(TIME_SAVED).map(([key, t]) => (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '3px 0', color: '#86868B' }}>
                <span>{t.label}</span>
                <span style={{ fontWeight: 600, color: '#1D1D1F' }}>{t.minPerMsg * t.count} 分钟</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '3px 0', fontWeight: 700, color: '#1D1D1F', borderTop: '.5px solid rgba(0,0,0,.06)', marginTop: 4, paddingTop: 6 }}>
              <span>合计</span><span>{hours}h {mins}min = 约 {Math.round(totalMin / 60 * 100)} 美元（按 $100/h）</span>
            </div>
          </div>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
        <StatCard value={today.newMessages} label="新消息" color="#007AFF" />
        <StatCard value={today.autoReplied} label="已自动回复" color="#34C759" />
        <StatCard value={today.urgent} label="紧急" color="#FF3B30" />
        <StatCard value={today.draftInvoices} label="待开发票" color="#FF9500" />
      </div>

      {/* Client Pipeline */}
      <div style={{ background: '#fff', borderRadius: 16, padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, cursor: 'pointer' }}
             onClick={() => setExpandedPipeline(!expandedPipeline)}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-.1px' }}>客户管线</div>
            <div style={{ fontSize: 12, color: '#86868B' }}>AI 自动识别客户所处阶段，匹配对应话术</div>
          </div>
          <span style={{ fontSize: 11, color: '#AEAEB2' }}>{expandedPipeline ? '收起' : '展开'} ▾</span>
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', marginBottom: expandedPipeline ? 10 : 0 }}>
          {Object.entries(STAGE).map(([key, s]) => {
            const clients = data.pipeline.filter(c => c.stage === key);
            const h = 6 + clients.length * 14;
            return (
              <div key={key} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: clients.length > 0 ? s.color : '#D1D1D6', marginBottom: 4 }}>{clients.length || 0}</div>
                <div style={{ height: Math.max(h, 6), background: clients.length > 0 ? s.color : '#E5E5EA', borderRadius: 3, transition: 'all .3s', minWidth: '100%' }} />
                <div style={{ fontSize: 9, color: '#AEAEB2', marginTop: 4, whiteSpace: 'nowrap' }}>{s.icon}</div>
              </div>
            );
          })}
        </div>
        {expandedPipeline && (
          <div style={{ borderTop: '.5px solid rgba(0,0,0,.06)', paddingTop: 10 }}>
            {data.pipeline.filter(c => c.stage !== 'completed').map((c, i) => {
              const s = STAGE[c.stage];
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < activeJobs - 1 ? '.5px solid rgba(0,0,0,.04)' : 'none' }}>
                  <span style={{ fontSize: 18 }}>{s.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-.1px' }}>{c.name}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, color: s.color, background: s.color + '15', padding: '1px 6px', borderRadius: 6 }}>{s.label}</span>
                      {c.unreadMsgs > 0 && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#FF3B30' }} />}
                    </div>
                    <div style={{ fontSize: 11, color: '#AEAEB2', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {c.shootDate && <span>📅 {c.shootDate}</span>}
                      <span>{c.packageType} · ${c.value.toLocaleString()}</span>
                      {c.galleryStatus && <span>{c.galleryStatus === 'editing' ? '🎨 修图中' : c.galleryStatus === 'ready' ? '📦 待交付' : c.galleryStatus === 'delivered' ? '✅ 已交付' : '📷 待修图'}</span>}
                      {c.nextPayment && <span style={{ color: '#FF9500' }}>💰 {c.nextPayment.label} ${c.nextPayment.amount} · {c.nextPayment.due}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Urgent message with classification reasoning */}
      {!urgentSent && (
        <>
          <SectionLabel>🔴 需要你处理</SectionLabel>
          <div style={{ display: 'flex', gap: 6, marginBottom: -12 }}>
            <ReasonTag label="阶段：已定" detail="Sarah 在 booking 阶段，不是新客户" />
            <ReasonTag label="关键词：'加'/ '冲印'" detail="包含加时+价格敏感词" />
            <ReasonTag label="付款：retainer 3天后到期" detail="有未完成的付款节点" />
          </div>
          <MessageCard urgent>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <div>
                <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-.1px' }}>Sarah & Mike</span>
                <span style={{ fontSize: 11, color: '#AEAEB2', marginLeft: 8 }}>Wedding · 已定阶段</span>
              </div>
              <span style={{ fontSize: 12, color: '#AEAEB2' }}>2 分钟前</span>
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
              <Tag>📅 拍摄: 2026-08-15</Tag>
              <Tag>💰 Retainer $1,500 · 3天后到期</Tag>
              <Tag>💬 之前聊过 5 次</Tag>
            </div>
            <div style={{ fontSize: 13, color: '#86868B', lineHeight: 1.6, marginBottom: 10 }}>
              "Emma 你好！想问一下——婚礼当天可以多加 2 个小时吗？还有你们提供冲印服务吗？"
            </div>
            <AiBlock>
              "Sarah & Mike，很高兴收到你们的消息！当然可以多加 2 小时，额外费用 $400。冲印 8×10 每张 $25 起。需要我把冲印目录发给你们吗？——另外提醒一下，retainer 3天后到期哦 😊"
            </AiBlock>
            <div style={{ display: 'flex', gap: 8 }}>
              <PillBtn primary onClick={() => handleSend('urgent')}>发送回复</PillBtn>
              <PillBtn onClick={() => flash('✏️ 编辑中...')}>编辑</PillBtn>
              <PillBtn onClick={() => flash('👤 已标记为自己处理')}>我自己回</PillBtn>
            </div>
          </MessageCard>
        </>
      )}

      {/* Normal message with reasoning */}
      {!normalSent && (
        <>
          <SectionLabel>🟡 待审核</SectionLabel>
          <div style={{ display: 'flex', gap: 6, marginBottom: -12 }}>
            <ReasonTag label="阶段：修图中" detail="David 在 editing 阶段，进度查询" />
            <ReasonTag label="非紧急" detail="不含 urgent/asap 关键词" />
          </div>
          <MessageCard>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <div>
                <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-.1px' }}>David L.</span>
                <span style={{ fontSize: 11, color: '#AEAEB2', marginLeft: 8 }}>Portrait · 修图阶段</span>
              </div>
              <span style={{ fontSize: 12, color: '#AEAEB2' }}>1 小时前</span>
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <Tag>📅 拍摄: 2026-05-28</Tag>
              <Tag>🎨 修图中 · 预计 2-3 周</Tag>
            </div>
            <div style={{ fontSize: 13, color: '#86868B', lineHeight: 1.6, marginBottom: 10 }}>
              "相册还要多久能好？"
            </div>
            <AiBlock>
              "David 你好，你的相册正在修图中，预计 2–3 周内交付。要不要先给你发几张抢先看？"
            </AiBlock>
            <div style={{ display: 'flex', gap: 8 }}>
              <PillBtn primary onClick={() => handleSend('normal')}>发送回复</PillBtn>
              <PillBtn onClick={() => flash('✏️ 编辑中...')}>编辑</PillBtn>
            </div>
          </MessageCard>
        </>
      )}

      {/* Sent items — the loop closure */}
      {sentItems.length > 0 && (
        <>
          <SectionLabel>📤 今日已发送 · {sentItems.length}</SectionLabel>
          {sentItems.map(item => (
            <div key={item.id} style={{
              background: '#fff', borderRadius: 14, padding: '12px 16px',
              boxShadow: '0 1px 3px rgba(0,0,0,.04)', display: 'flex', alignItems: 'center', gap: 12,
              opacity: .7,
            }}>
              <span style={{ fontSize: 18 }}>✅</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-.1px' }}>{item.to}</div>
                <div style={{ fontSize: 12, color: '#86868B' }}>{item.preview}</div>
              </div>
              <span style={{ fontSize: 12, color: '#AEAEB2' }}>{item.time}</span>
            </div>
          ))}
        </>
      )}

      {/* Auto-replied */}
      <SectionLabel>✅ 今日自动回复 · {today.autoReplied}</SectionLabel>
      <div style={{ display: 'flex', gap: 6, marginBottom: -12 }}>
        <ReasonTag label="自动分类" detail="AI 识别为进度查询 → 自动匹配交付阶段模板" />
      </div>
      <MessageCard muted>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
          <div>
            <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-.1px' }}>Jennifer K.</span>
            <span style={{ fontSize: 11, color: '#AEAEB2', marginLeft: 8 }}>Wedding · 交付阶段</span>
          </div>
          <span style={{ fontSize: 12, color: '#AEAEB2' }}>3 小时前</span>
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <Tag>📦 相册已就绪</Tag>
          <Tag>📸 5 月已拍摄</Tag>
        </div>
        <div style={{ fontSize: 13, color: '#86868B', lineHeight: 1.6, marginBottom: 0 }}>
          "照片好了吗？"
        </div>
        <div style={{ fontSize: 13, color: '#34C759', fontWeight: 500, marginTop: 8 }}>
          ✓ AI 识别为"交付进度查询"，已自动回复真实状态（无人工参与）
        </div>
      </MessageCard>

      {/* All done state */}
      {urgentSent && normalSent && (
        <div style={{ textAlign: 'center', padding: 32, background: '#fff', borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🎉</div>
          <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>今日消息全部处理完毕</p>
          <p style={{ fontSize: 13, color: '#86868B' }}>已发送 {sentItems.length} 条回复 · AI 正在监控 {activeJobs} 个进行中的项目</p>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,.82)', color: '#fff', padding: '10px 20px', borderRadius: 20, fontSize: 13, fontWeight: 600, zIndex: 200, backdropFilter: 'blur(10px)' }}>{toast}</div>
      )}
    </div>
  );
}

// --- components ---
function StatCard({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: '14px 10px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
      <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-.3px', color, marginBottom: 1 }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#1D1D1F', letterSpacing: '-.1px' }}>{label}</div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: '#AEAEB2', textTransform: 'uppercase', letterSpacing: '.5px' }}>{children}</div>;
}

function ReasonTag({ label, detail }: { label: string; detail: string }) {
  return (
    <span title={detail} style={{ fontSize: 10, fontWeight: 500, color: '#007AFF', background: 'rgba(0,122,255,.06)', padding: '3px 8px', borderRadius: 6, cursor: 'default', whiteSpace: 'nowrap' }}>
      {label}
    </span>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span style={{ fontSize: 10, fontWeight: 500, color: '#86868B', background: 'rgba(0,0,0,.03)', padding: '2px 8px', borderRadius: 6, whiteSpace: 'nowrap' }}>{children}</span>;
}

function MessageCard({ children, urgent, muted }: { children: React.ReactNode; urgent?: boolean; muted?: boolean }) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,.04)', borderLeft: urgent ? '3px solid #FF3B30' : '1px solid rgba(0,0,0,.04)', opacity: muted ? .5 : 1 }}>
      {children}
    </div>
  );
}

function AiBlock({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: 'rgba(0,122,255,.04)', borderRadius: 8, padding: '12px 14px', fontSize: 13, color: 'rgba(0,122,255,.9)', lineHeight: 1.5, marginBottom: 12, border: '.5px solid rgba(0,122,255,.08)' }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', color: 'rgba(0,122,255,.5)', marginBottom: 4 }}>AI 建议回复</div>
      {children}
    </div>
  );
}

function PillBtn({ children, primary, onClick }: { children: React.ReactNode; primary?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ padding: '7px 16px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', background: primary ? '#007AFF' : 'rgba(0,0,0,.04)', color: primary ? '#fff' : '#1D1D1F', letterSpacing: '-.1px', transition: 'all .12s' }}>
      {children}
    </button>
  );
}
