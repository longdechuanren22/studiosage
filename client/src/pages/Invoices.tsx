import { useState, useEffect } from 'react';

interface Invoice {
  id: string;
  client_name: string;
  amount: number;
  currency: string;
  description: string;
  status: string;
  retainer_type?: string;
  payment_schedule: string;
  created_at: string;
}

export default function Invoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetch('/api/invoices').then(r => r.json()).then(setInvoices);
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h2 className="text-sm font-semibold text-gray-700">Invoices</h2>
        <button onClick={() => setShowForm(!showForm)} className="px-3 py-1.5 bg-sage-500 text-white text-xs rounded-full font-medium">
          + New
        </button>
      </div>

      {showForm && <InvoiceForm onDone={() => { setShowForm(false); fetch('/api/invoices').then(r => r.json()).then(setInvoices); }} />}

      {invoices.length === 0 && !showForm && <p className="text-center py-10 text-gray-400 text-sm">No invoices yet</p>}

      {invoices.map(inv => (
        <div key={inv.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium">{inv.client_name}</p>
              <p className="text-xs text-gray-400">{inv.description}</p>
              {inv.retainer_type && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded mt-1 inline-block">{inv.retainer_type}</span>}
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-sage-500">{inv.currency} {inv.amount}</p>
              <p className="text-[10px] text-gray-400">{inv.payment_schedule === 'three-phase' ? '3-Phase' : 'Single'}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function InvoiceForm({ onDone }: { onDone: () => void }) {
  const [form, setForm] = useState({ clientName: '', clientEmail: '', packageType: 'wedding', amount: '', paymentSchedule: 'three-phase' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/invoices/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, amount: Number(form.amount) }),
    });
    onDone();
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl p-4 shadow-sm border border-sage-200 space-y-3">
      <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Client name" value={form.clientName} onChange={e => setForm({ ...form, clientName: e.target.value })} required />
      <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Client email" type="email" value={form.clientEmail} onChange={e => setForm({ ...form, clientEmail: e.target.value })} required />
      <select className="w-full border rounded-lg px-3 py-2 text-sm" value={form.packageType} onChange={e => setForm({ ...form, packageType: e.target.value })}>
        <option value="wedding">Wedding</option>
        <option value="portrait">Portrait</option>
        <option value="event">Event</option>
        <option value="commercial">Commercial</option>
      </select>
      <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Amount (USD)" type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required />
      <select className="w-full border rounded-lg px-3 py-2 text-sm" value={form.paymentSchedule} onChange={e => setForm({ ...form, paymentSchedule: e.target.value })}>
        <option value="three-phase">3-Phase (50/25/25)</option>
        <option value="single">Single Payment</option>
      </select>
      <button type="submit" className="w-full py-2 bg-sage-500 text-white text-sm rounded-full font-medium">Generate Invoice</button>
    </form>
  );
}
