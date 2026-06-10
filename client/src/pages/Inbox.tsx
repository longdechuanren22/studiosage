import { useState, useEffect } from 'react';
import { useDemo } from '../components/Layout';

interface Message {
  id: string;
  from_address: string; subject: string; body: string;
  category: 'urgent' | 'normal' | 'spam';
  status: 'pending' | 'replied' | 'archived';
  ai_reply: string; client_name?: string; client_stage?: string; created_at: string;
}

const DEMO_MESSAGES: Message[] = [
  { id:'1', from_address:'sarah.mike@email.com', subject:'Wedding inquiry', body:'"Emma 你好！想问一下——婚礼当天可以多加 2 个小时吗？还有你们提供冲印服务吗？"', category:'urgent', status:'pending', ai_reply:'"Sarah & Mike，很高兴收到你们的消息！当然可以多加 2 小时，额外费用 $400。冲印 8×10 每张 $25 起。需要我把冲印目录发给你们吗？"', client_name:'Sarah & Mike', client_stage:'booking', created_at: new Date(Date.now()-120000).toISOString() },
  { id:'2', from_address:'david.l@email.com', subject:'Gallery timeline', body:'"相册还要多久能好？"', category:'normal', status:'pending', ai_reply:'"David 你好，你的相册将在 2–3 周内准备好。要不要先给你发几张抢先看？"', client_name:'David L.', client_stage:'editing', created_at: new Date(Date.now()-3600000).toISOString() },
  { id:'3', from_address:'jennifer@email.com', subject:'Photo ready?', body:'"照片好了吗？"', category:'normal', status:'replied', ai_reply:'"您的照片将在 3–5 个工作日内准备好……"', client_name:'Jennifer K.', client_stage:'delivery', created_at: new Date(Date.now()-10800000).toISOString() },
];

const colors = ['#FF3B30','#007AFF','#FF9500','#34C759','#AF52DE'];

export default function Inbox() {
  const { demo } = useDemo();
  const [messages, setMessages] = useState<Message[]>([]);
  const [filter, setFilter] = useState<'all'|'urgent'|'normal'>('all');
  const [expandedId, setExpandedId] = useState<string|null>(null);

  useEffect(() => {
    if (demo) { setMessages(DEMO_MESSAGES); return; }
    fetch('/api/messages/inbox').then(r=>r.json()).then(setMessages).catch(()=>setMessages(DEMO_MESSAGES));
  }, [demo]);

  const filtered = filter==='all' ? messages : messages.filter(m=>m.category===filter);

  const handleReply = (id: string) => {
    setMessages(msgs => msgs.map(m => m.id===id ? {...m, status:'replied'} : m));
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div>
        <h2 style={{ fontSize:26, fontWeight:800, letterSpacing:'-.5px', margin:0 }}>收件箱</h2>
        <p style={{ fontSize:14, color:'#86868B', margin:'4px 0 0' }}>3 条未读 · 共 12 个对话</p>
      </div>

      {/* Filter chips */}
      <div style={{ display:'flex', gap:6 }}>
        {(['all','urgent','normal'] as const).map(f => (
          <button key={f} onClick={()=>setFilter(f)} style={{
            padding:'6px 14px', borderRadius:16, fontSize:12, fontWeight:600, cursor:'pointer', border:'.5px solid transparent',
            background: filter===f ? '#007AFF' : 'rgba(0,0,0,.03)', color: filter===f ? '#fff' : '#86868B',
            letterSpacing:'-.1px', transition:'all .12s',
          }}>
            {f==='all'?'全部':f==='urgent'?'🔴 紧急':'🟡 普通'}
          </button>
        ))}
      </div>

      {filtered.length===0 && (
        <div style={{ textAlign:'center', padding:48, background:'#fff', borderRadius:16 }}>
          <div style={{ fontSize:36, marginBottom:8, opacity:.6 }}>✓</div>
          <p style={{ fontSize:15, fontWeight:700 }}>没有消息</p>
          <p style={{ fontSize:13, color:'#86868B' }}>全部处理完毕</p>
        </div>
      )}

      {filtered.map((msg, i) => (
        <div key={msg.id} onClick={()=>setExpandedId(expandedId===msg.id?null:msg.id)} style={{
          background:'#fff', borderRadius:16, padding:'16px 18px', cursor:'pointer',
          boxShadow:'0 1px 3px rgba(0,0,0,.04)', borderLeft: msg.category==='urgent'?'3px solid #FF3B30':'1px solid rgba(0,0,0,.04)',
          opacity: msg.status==='replied'?.5:1, transition:'all .15s',
        }}>
          <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
            {/* Avatar */}
            <div style={{
              width:40, height:40, borderRadius:'50%', flexShrink:0,
              background:`linear-gradient(135deg,${colors[i%5]},${colors[i%5]}88)`,
              display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:16, fontWeight:700,
            }}>{(msg.client_name||msg.from_address)[0]}</div>
            {/* Info */}
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:15, fontWeight:600, letterSpacing:'-.1px' }}>{msg.client_name||msg.from_address}</span>
                <span style={{ fontSize:12, color:'#AEAEB2' }}>{new Date(msg.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>
              </div>
              <p style={{ fontSize:13, color:'#86868B', margin:'2px 0', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{msg.body}</p>
              <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                {msg.category==='urgent' && <span style={{ fontSize:10, fontWeight:600, color:'#FF3B30', background:'rgba(255,59,48,.08)', padding:'1px 6px', borderRadius:6 }}>紧急</span>}
                {msg.status==='replied' && <span style={{ fontSize:12, fontWeight:500, color:'#34C759' }}>✓ 已回复</span>}
                {msg.status==='pending' && <span style={{ fontSize:10, fontWeight:600, color:'#007AFF', background:'rgba(0,122,255,.08)', padding:'1px 6px', borderRadius:6 }}>待处理</span>}
              </div>
            </div>
          </div>

          {/* Expanded AI reply */}
          {expandedId===msg.id && msg.status!=='replied' && (
            <div style={{ marginTop:14, paddingTop:14, borderTop:'.5px solid rgba(0,0,0,.06)' }} onClick={e=>e.stopPropagation()}>
              <div style={{ background:'rgba(0,122,255,.04)', borderRadius:8, padding:'12px 14px', fontSize:13, color:'rgba(0,122,255,.9)', lineHeight:1.5, marginBottom:10, border:'.5px solid rgba(0,122,255,.08)' }}>
                <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.6px', color:'rgba(0,122,255,.5)', marginBottom:4 }}>AI 建议回复</div>
                {msg.ai_reply}
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={()=>handleReply(msg.id)} style={{ padding:'7px 16px', borderRadius:20, fontSize:12, fontWeight:600, background:'#007AFF', color:'#fff', border:'none', cursor:'pointer', letterSpacing:'-.1px' }}>发送回复</button>
                <button style={{ padding:'7px 16px', borderRadius:20, fontSize:12, fontWeight:600, background:'transparent', color:'#007AFF', border:'none', cursor:'pointer' }}>编辑</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
