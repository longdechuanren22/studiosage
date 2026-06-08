import { useState, useEffect } from 'react';

interface Message {
  id: string;
  from_address: string;
  subject: string;
  body: string;
  category: 'urgent' | 'normal' | 'spam';
  status: 'pending' | 'replied' | 'archived';
  ai_reply: string;
  client_name?: string;
  client_stage?: string;
  created_at: string;
}

export default function Inbox() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [filter, setFilter] = useState<'all' | 'urgent' | 'normal'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/messages/inbox').then(r => r.json()).then(setMessages);
  }, []);

  const filtered = filter === 'all' ? messages : messages.filter(m => m.category === filter);

  const handleReply = async (id: string) => {
    await fetch(`/api/messages/${id}/reply`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    setMessages(msgs => msgs.map(m => m.id === id ? { ...m, status: 'replied' } : m));
  };

  return (
    <div className="space-y-3">
      {/* Filter Tabs */}
      <div className="flex gap-2">
        {(['all', 'urgent', 'normal'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
              filter === f ? 'bg-sage-500 text-white' : 'bg-gray-100 text-gray-500'
            }`}
          >
            {f === 'all' ? 'All' : f === 'urgent' ? '🔴 Urgent' : '🟡 Normal'}
          </button>
        ))}
      </div>

      {/* Message List */}
      {filtered.length === 0 && <p className="text-center py-10 text-gray-400 text-sm">No messages</p>}

      {filtered.map(msg => (
        <div key={msg.id} className="bg-white rounded-xl p-3 shadow-sm border border-gray-100" onClick={() => setExpandedId(expandedId === msg.id ? null : msg.id)}>
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {msg.category === 'urgent' && <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">Urgent</span>}
                <span className="text-xs text-gray-400">{new Date(msg.created_at).toLocaleTimeString()}</span>
                {msg.client_stage && <span className="text-[10px] text-gray-400 bg-gray-100 px-1 rounded">{msg.client_stage}</span>}
              </div>
              <p className="text-sm font-medium mt-1 truncate">{msg.client_name || msg.from_address}</p>
              <p className="text-xs text-gray-500 truncate">{msg.body.slice(0, 80)}</p>
            </div>
            {msg.status === 'replied' && <span className="text-xs text-green-600 flex-shrink-0 ml-2">✅ Replied</span>}
          </div>

          {/* Expanded: AI Reply */}
          {expandedId === msg.id && (
            <div className="mt-3 pt-3 border-t border-gray-100" onClick={e => e.stopPropagation()}>
              <p className="text-[11px] text-gray-400 mb-1">💬 Suggested reply:</p>
              <p className="text-sm text-gray-700 bg-sage-50 rounded-lg p-2">{msg.ai_reply}</p>
              <div className="flex gap-2 mt-2">
                <button onClick={() => handleReply(msg.id)} className="px-4 py-1.5 bg-sage-500 text-white text-xs rounded-full font-medium">📤 Send</button>
                <button className="px-4 py-1.5 bg-gray-100 text-gray-600 text-xs rounded-full">✏️ Edit</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
