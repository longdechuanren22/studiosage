import { useState, useEffect } from 'react';
import { useDemo } from '../components/Layout';
import { api } from '../utils/api';

interface Message {
  id: string;
  from_address: string; subject: string; body: string;
  category: 'urgent' | 'normal' | 'spam';
  status: 'pending' | 'replied' | 'archived';
  ai_reply: string; client_name?: string; client_stage?: string; created_at: string;
}

const AVATAR_COLORS = ['#FF3B30','#007AFF','#FF9500','#34C759','#AF52DE','#5856D6','#FF2D55','#30B0C7'];

function avatarColor(i: number) { return AVATAR_COLORS[i % AVATAR_COLORS.length]; }
function initial(name: string) { return (name || '?')[0].toUpperCase(); }

export default function Inbox() {
  const { demo } = useDemo();
  const [messages, setMessages] = useState<Message[]>([]);
  const [filter, setFilter] = useState<'all' | 'urgent' | 'normal'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMessages = async () => {
    try {
      const data = await api.get('/api/messages/inbox');
      setMessages(data);
    } catch { /* keep current */ }
    setLoading(false);
  };

  useEffect(() => {
    fetchMessages();
    const t = setInterval(fetchMessages, 30000); // poll every 30s
    return () => clearInterval(t);
  }, []);

  const handleSend = async (msg: Message) => {
    setSendingId(msg.id);
    try {
      await api.post(`/api/messages/${msg.id}/send`, { customText: editText || msg.ai_reply });
      setMessages(msgs => msgs.map(m => m.id === msg.id ? { ...m, status: 'replied' as const, ai_reply: editText || m.ai_reply } : m));
      setExpandedId(null);
      setEditingId(null);
    } catch (e) {
      alert('发送失败: ' + (e as Error).message);
    }
    setSendingId(null);
  };

  const startEdit = (msg: Message) => {
    setEditingId(msg.id);
    setEditText(msg.ai_reply);
  };

  const saveDraft = async (msg: Message) => {
    await api.patch(`/api/messages/${msg.id}/reply`, { ai_reply: editText });
    setMessages(msgs => msgs.map(m => m.id === msg.id ? { ...m, ai_reply: editText } : m));
    setEditingId(null);
  };

  const filtered = filter === 'all' ? messages : messages.filter(m => m.category === filter);
  const pendingCount = messages.filter(m => m.status === 'pending').length;
  const urgentCount = messages.filter(m => m.category === 'urgent' && m.status === 'pending').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.5px', margin: 0 }}>收件箱</h2>
        <p style={{ fontSize: 14, color: '#86868B', margin: '4px 0 0' }}>
          {loading ? '加载中...' : (
            pendingCount > 0
              ? `${pendingCount} 条待处理 · ${urgentCount > 0 ? `${urgentCount} 条紧急` : '无紧急'} · 共 ${messages.length} 条`
              : messages.length > 0 ? '全部处理完毕 ✅' : '收件箱为空 · 连接邮箱后 AI 自动监控'
          )}
        </p>
      </div>

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: 6 }}>
        {(['all', 'urgent', 'normal'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '6px 14px', borderRadius: 16, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '.5px solid transparent',
            background: filter === f ? '#007AFF' : 'rgba(0,0,0,.03)', color: filter === f ? '#fff' : '#86868B',
            letterSpacing: '-.1px',
          }}>
            {f === 'all' ? '全部' : f === 'urgent' ? '🔴 紧急' : '🟡 普通'}
          </button>
        ))}
      </div>

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: 48, background: '#fff', borderRadius: 16 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
          <p style={{ fontSize: 15, fontWeight: 700 }}>收件箱为空</p>
          <p style={{ fontSize: 13, color: '#86868B', lineHeight: 1.5 }}>
            {messages.length === 0
              ? '连接邮箱后，AI 会自动读取邮件并显示在这里。'
              : '当前筛选条件下没有消息。试试切换筛选。'}
          </p>
        </div>
      )}

      {filtered.map((msg, i) => {
        const isExpanded = expandedId === msg.id;
        const isEditing = editingId === msg.id;
        const isSending = sendingId === msg.id;
        const isReplied = msg.status === 'replied';

        return (
          <div key={msg.id} style={{
            background: '#fff', borderRadius: 16, padding: '16px 18px',
            cursor: isExpanded ? 'default' : 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,.04)',
            borderLeft: msg.category === 'urgent' ? '3px solid #FF3B30' : '1px solid rgba(0,0,0,.04)',
            opacity: isReplied ? 0.5 : 1,
          }}>
            {/* Collapsed row */}
            <div onClick={() => setExpandedId(isExpanded ? null : msg.id)}
              style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                background: `linear-gradient(135deg,${avatarColor(i)},${avatarColor(i)}88)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 16, fontWeight: 700,
              }}>{initial(msg.client_name || msg.from_address)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-.1px' }}>{msg.client_name || msg.from_address}</span>
                  <span style={{ fontSize: 12, color: '#AEAEB2' }}>{timeAgo(msg.created_at)}</span>
                </div>
                <p style={{ fontSize: 13, color: '#86868B', margin: '2px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{msg.subject || msg.body?.slice(0, 80)}</p>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  {msg.category === 'urgent' && <Badge color="#FF3B30">紧急</Badge>}
                  {msg.status === 'replied' && <span style={{ fontSize: 12, fontWeight: 500, color: '#34C759' }}>✓ 已回复</span>}
                  {msg.status === 'pending' && <Badge color="#007AFF">待处理</Badge>}
                </div>
              </div>
            </div>

            {/* Expanded: AI reply + actions */}
            {isExpanded && !isReplied && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '.5px solid rgba(0,0,0,.06)' }} onClick={e => e.stopPropagation()}>
                {/* AI draft */}
                {isEditing ? (
                  <div style={{ marginBottom: 10 }}>
                    <textarea
                      value={editText}
                      onChange={e => setEditText(e.target.value)}
                      style={{
                        width: '100%', minHeight: 100, padding: '12px 14px', borderRadius: 8,
                        border: '1px solid #007AFF', fontSize: 13, lineHeight: 1.6,
                        outline: 'none', resize: 'vertical', boxSizing: 'border-box',
                        fontFamily: 'inherit', color: '#1D1D1F',
                      }}
                      autoFocus
                    />
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button onClick={() => saveDraft(msg)} style={btnStyle('#007AFF', '#fff')}>💾 保存草稿</button>
                      <button onClick={() => { setEditingId(null); setEditText(''); }} style={btnStyle()}>取消</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ background: 'rgba(0,122,255,.04)', borderRadius: 8, padding: '12px 14px', fontSize: 13, color: 'rgba(0,122,255,.9)', lineHeight: 1.5, marginBottom: 10, border: '.5px solid rgba(0,122,255,.08)' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', color: 'rgba(0,122,255,.5)', marginBottom: 4 }}>🤖 AI 建议回复</div>
                    {msg.ai_reply || '（AI 未生成回复，请手动编辑）'}
                  </div>
                )}

                {/* Action buttons */}
                {!isEditing && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => handleSend(msg)}
                      disabled={isSending}
                      style={btnStyle('#007AFF', '#fff')}
                    >
                      {isSending ? '⏳ 发送中...' : '✅ 发送回复'}
                    </button>
                    <button onClick={() => startEdit(msg)} style={btnStyle()}>✏️ 编辑</button>
                    <button onClick={() => setExpandedId(null)} style={btnStyle()}>收起</button>
                  </div>
                )}
              </div>
            )}

            {/* Expanded: already replied — show what was sent */}
            {isExpanded && isReplied && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '.5px solid rgba(0,0,0,.06)' }}>
                <div style={{ background: 'rgba(52,199,89,.04)', borderRadius: 8, padding: '12px 14px', fontSize: 13, color: 'rgba(52,199,89,.9)', lineHeight: 1.5, border: '.5px solid rgba(52,199,89,.08)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', color: 'rgba(52,199,89,.5)', marginBottom: 4 }}>✅ 已发送</div>
                  {msg.ai_reply}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return <span style={{ fontSize: 10, fontWeight: 600, color, background: `${color}12`, padding: '1px 6px', borderRadius: 6 }}>{children}</span>;
}

function btnStyle(bg?: string, fg?: string): React.CSSProperties {
  return {
    padding: '7px 16px', borderRadius: 20, fontSize: 12, fontWeight: 600,
    cursor: 'pointer', border: bg ? 'none' : '.5px solid rgba(0,0,0,.08)',
    background: bg || 'transparent', color: fg || '#1D1D1F',
    letterSpacing: '-.1px',
  };
}

function timeAgo(iso: string): string {
  if (!iso) return '';
  const sec = (Date.now() - new Date(iso).getTime()) / 1000;
  if (sec < 60) return '刚刚';
  if (sec < 3600) return `${Math.floor(sec / 60)} 分钟前`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} 小时前`;
  if (sec < 604800) return `${Math.floor(sec / 86400)} 天前`;
  return new Date(iso).toLocaleDateString('zh-CN');
}
