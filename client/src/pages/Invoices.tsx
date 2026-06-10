import { useState, useEffect } from 'react';
import { useDemo } from '../components/Layout';

interface Invoice {
  id: string; client_name: string; amount: number; currency: string;
  description: string; status: string; retainer_type?: string;
  payment_schedule: string; created_at: string;
}

const DEMO_INVOICES: Invoice[] = [
  { id:'INV-042', client_name:'Sarah & Mike', amount:4500, currency:'USD', description:'Wedding Full Package', status:'draft', retainer_type:'non-refundable', payment_schedule:'three-phase', created_at:new Date().toISOString() },
  { id:'INV-041', client_name:'David L.', amount:850, currency:'USD', description:'Portrait Session', status:'draft', payment_schedule:'single', created_at:new Date().toISOString() },
  { id:'INV-040', client_name:'Jennifer K.', amount:3400, currency:'USD', description:'Wedding Day Coverage', status:'paid', payment_schedule:'three-phase', created_at:new Date(Date.now()-86400000*3).toISOString() },
];

export default function Invoices() {
  const { demo } = useDemo();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (demo) { setInvoices(DEMO_INVOICES); return; }
    fetch('/api/invoices').then(r=>r.json()).then(setInvoices).catch(()=>setInvoices(DEMO_INVOICES));
  }, [demo]);

  const total = invoices.filter(i=>i.status==='paid').reduce((s,i)=>s+i.amount,0);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div>
          <h2 style={{ fontSize:26, fontWeight:800, letterSpacing:'-.5px', margin:0 }}>发票</h2>
          <p style={{ fontSize:14, color:'#86868B', margin:'4px 0 0' }}>
            {invoices.filter(i=>i.status==='draft').length} 张草稿 · 本月已收 <strong style={{color:'#1D1D1F'}}>${total.toLocaleString()}</strong>
          </p>
        </div>
        <button onClick={()=>setShowForm(!showForm)} style={{
          padding:'8px 18px', borderRadius:20, fontSize:13, fontWeight:600, border:'none', cursor:'pointer',
          background:'#007AFF', color:'#fff', letterSpacing:'-.1px',
        }}>+ 新建</button>
      </div>

      {showForm && <InvoiceForm onDone={()=>{setShowForm(false)}} />}

      {invoices.length===0 && !showForm && (
        <div style={{ textAlign:'center', padding:48, background:'#fff', borderRadius:16 }}>
          <div style={{ fontSize:36, marginBottom:8, opacity:.6 }}>📄</div>
          <p style={{ fontSize:15, fontWeight:700 }}>还没有发票</p>
          <p style={{ fontSize:13, color:'#86868B' }}>生成第一张发票开始计费</p>
        </div>
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {invoices.map(inv => (
          <div key={inv.id} style={{
            background:'#fff', borderRadius:14, padding:'16px 18px', cursor:'pointer',
            boxShadow:'0 1px 3px rgba(0,0,0,.04)', display:'flex', alignItems:'center',
            transition:'all .15s', opacity: inv.status==='paid'?.5:1,
          }}>
            <div style={{ width:80 }}>
              <div style={{ fontSize:13, fontWeight:700, letterSpacing:'-.1px' }}>#{inv.id}</div>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, color:'#86868B' }}>{inv.client_name} · {inv.description}</div>
            </div>
            <div style={{ fontSize:16, fontWeight:800, marginRight:12, letterSpacing:'-.3px' }}>${inv.amount.toLocaleString()}</div>
            <span style={{
              fontSize:10, fontWeight:700, padding:'4px 10px', borderRadius:12, textTransform:'uppercase', letterSpacing:'.4px',
              background: inv.status==='paid'?'rgba(52,199,89,.1)':'rgba(255,149,0,.1)',
              color: inv.status==='paid'?'#34C759':'#FF9500',
            }}>{inv.status==='paid'?'已付':'草稿'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function InvoiceForm({ onDone }: { onDone: () => void }) {
  const [form, setForm] = useState({ clientName:'', clientEmail:'', packageType:'wedding', amount:'', paymentSchedule:'three-phase' });
  const handleSubmit = async (e: React.FormEvent) => { e.preventDefault(); onDone(); };

  return (
    <form onSubmit={handleSubmit} style={{ background:'#fff', borderRadius:16, padding:18, boxShadow:'0 1px 3px rgba(0,0,0,.04)', display:'flex', flexDirection:'column', gap:12 }}>
      <input style={{ width:'100%', border:'1px solid rgba(0,0,0,.1)', borderRadius:10, padding:'10px 14px', fontSize:13 }} placeholder="客户名称" value={form.clientName} onChange={e=>setForm({...form,clientName:e.target.value})} required />
      <input style={{ width:'100%', border:'1px solid rgba(0,0,0,.1)', borderRadius:10, padding:'10px 14px', fontSize:13 }} placeholder="客户邮箱" type="email" value={form.clientEmail} onChange={e=>setForm({...form,clientEmail:e.target.value})} required />
      <select style={{ width:'100%', border:'1px solid rgba(0,0,0,.1)', borderRadius:10, padding:'10px 14px', fontSize:13 }} value={form.packageType} onChange={e=>setForm({...form,packageType:e.target.value})}>
        <option value="wedding">婚礼</option><option value="portrait">肖像</option><option value="event">活动</option><option value="commercial">商业</option>
      </select>
      <input style={{ width:'100%', border:'1px solid rgba(0,0,0,.1)', borderRadius:10, padding:'10px 14px', fontSize:13 }} placeholder="金额 (USD)" type="number" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} required />
      <select style={{ width:'100%', border:'1px solid rgba(0,0,0,.1)', borderRadius:10, padding:'10px 14px', fontSize:13 }} value={form.paymentSchedule} onChange={e=>setForm({...form,paymentSchedule:e.target.value})}>
        <option value="three-phase">三期付款 (50/25/25)</option><option value="single">一次性付款</option>
      </select>
      <button type="submit" style={{ width:'100%', padding:'12px', borderRadius:20, fontSize:14, fontWeight:600, background:'#007AFF', color:'#fff', border:'none', cursor:'pointer', letterSpacing:'-.1px' }}>生成发票</button>
    </form>
  );
}
