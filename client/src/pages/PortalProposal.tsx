import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

interface ProposalView {
  id: string; title: string; clientName: string;
  packages: any[]; pricing: any; contractTerms: string; status: string;
}

export default function PortalProposal() {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [proposal, setProposal] = useState<ProposalView | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (!shareToken) return;
    fetch(`/api/portal/proposal/${shareToken}`)
      .then(r => r.json()).then(d => {
        if (d.id) { setProposal(d); if (d.status === 'accepted') setAccepted(true); }
        else setProposal(null);
      }).catch(() => {}).finally(() => setLoading(false));
  }, [shareToken]);

  const handleAccept = async () => {
    if (!shareToken) return;
    const res = await fetch(`/api/portal/proposal/${shareToken}/accept`, { method: 'POST' });
    const d = await res.json();
    if (d.ok) setAccepted(true);
  };

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: '#86868B' }}>加载中…</div>;
  if (!proposal) return <div style={{ padding: 60, textAlign: 'center' }}><p style={{ fontSize: 18, fontWeight: 700 }}>提案不存在</p><p style={{ color: '#86868B' }}>链接可能已失效，请联系摄影师</p></div>;

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 20, fontFamily: '-apple-system, sans-serif' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-.4px', margin: 0 }}>{proposal.title}</h1>
        <p style={{ color: '#86868B', margin: '4px 0 0' }}>{proposal.clientName}</p>
      </div>

      {/* Packages */}
      {proposal.packages?.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 14, padding: 18, marginBottom: 12 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 8px' }}>套餐选项</h3>
          {proposal.packages.map((pkg: any, i: number) => (
            <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid rgba(0,0,0,.06)' }}>
              <strong>{pkg.name || `套餐 ${i + 1}`}</strong>
              {pkg.price && <span style={{ float: 'right', fontWeight: 700 }}>${pkg.price}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Pricing */}
      {Object.keys(proposal.pricing || {}).length > 0 && (
        <div style={{ background: '#fff', borderRadius: 14, padding: 18, marginBottom: 12 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 8px' }}>报价明细</h3>
          {Object.entries(proposal.pricing).map(([k, v]: [string, any]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
              <span>{k}</span><span>${v}</span>
            </div>
          ))}
        </div>
      )}

      {/* Contract terms */}
      {proposal.contractTerms && (
        <div style={{ background: '#fff', borderRadius: 14, padding: 18, marginBottom: 12 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 8px' }}>合同条款</h3>
          <p style={{ fontSize: 13, color: '#555', whiteSpace: 'pre-wrap' }}>{proposal.contractTerms}</p>
        </div>
      )}

      {/* Accept button */}
      {!accepted ? (
        <button onClick={handleAccept} style={{
          width: '100%', padding: 14, borderRadius: 16, fontSize: 16, fontWeight: 700,
          background: '#34C759', color: '#fff', border: 'none', cursor: 'pointer',
        }}>✅ 接受提案</button>
      ) : (
        <div style={{ textAlign: 'center', padding: 20, background: 'rgba(52,199,89,.1)', borderRadius: 14 }}>
          <span style={{ fontSize: 32 }}>🎉</span>
          <p style={{ fontWeight: 700, fontSize: 16, margin: '8px 0 0' }}>提案已接受！</p>
          <p style={{ color: '#86868B', fontSize: 13 }}>摄影师将与你联系安排后续事宜</p>
        </div>
      )}
    </div>
  );
}
