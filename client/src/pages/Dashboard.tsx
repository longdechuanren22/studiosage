import { useState, useEffect } from 'react';

interface DashboardData {
  today: {
    newMessages: number;
    autoReplied: number;
    urgent: number;
    pendingReview: number;
    draftInvoices: number;
  };
  clientsByStage: { stage: string; count: number }[];
}

const stageLabels: Record<string, string> = {
  inquiry: 'New Leads',
  booking: 'Booked',
  pre_shoot: 'Pre-Shoot',
  shoot_day: 'Shoot Day',
  post_production: 'Editing',
  delivery: 'Gallery Live',
  post_delivery: 'Completed',
};

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    fetch('/api/dashboard').then(r => r.json()).then(setData);
  }, []);

  if (!data) return <div className="text-center py-20 text-gray-400">Loading...</div>;

  const { today } = data;

  return (
    <div className="space-y-4">
      {/* Greeting */}
      <p className="text-sm text-gray-500">
        👋 {today.newMessages === 0 ? 'All caught up! 🎉' : `You have ${today.urgent} urgent and ${today.pendingReview} to review.`}
      </p>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard value={today.newMessages} label="New" color="bg-sage-50 text-sage-700" />
        <StatCard value={today.autoReplied} label="Auto-Replied" color="bg-green-50 text-green-700" />
        <StatCard value={today.pendingReview} label="To Review" color="bg-amber-50 text-amber-700" />
        <StatCard value={today.urgent} label="Urgent" color={today.urgent > 0 ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-500'} />
      </div>

      {/* Stage Pipeline */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Client Pipeline</h2>
        <div className="flex overflow-x-auto gap-2 pb-2">
          {Object.entries(stageLabels).map(([stage, label]) => {
            const entry = data.clientsByStage.find(c => c.stage === stage);
            const count = entry?.count || 0;
            return (
              <div key={stage} className="flex-shrink-0 w-20 text-center">
                <div className={`text-2xl font-bold ${count > 0 ? 'text-sage-500' : 'text-gray-300'}`}>{count}</div>
                <div className="text-[10px] text-gray-400 leading-tight">{label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Urgent Alerts */}
      {today.urgent > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-red-700">🔴 {today.urgent} message{today.urgent > 1 ? 's' : ''} need your attention</p>
          <a href="/inbox" className="text-xs text-red-600 underline mt-1 inline-block">View in Inbox →</a>
        </div>
      )}

      {/* Draft Invoices */}
      {today.draftInvoices > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-amber-700">📄 {today.draftInvoices} draft invoice{today.draftInvoices > 1 ? 's' : ''}</p>
          <a href="/invoices" className="text-xs text-amber-600 underline mt-1 inline-block">Finalize →</a>
        </div>
      )}
    </div>
  );
}

function StatCard({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className={`rounded-xl p-3 ${color} text-center`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-[11px] opacity-75">{label}</div>
    </div>
  );
}
