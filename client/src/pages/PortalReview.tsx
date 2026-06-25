import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../utils/api';
import { t } from '../i18n';

interface DeliveredPhoto { id: string; filename: string; url: string; order: number; }
interface RevisionRequest {
  id: string; photoId: string; revisionType: string; description: string; status: string;
}
interface ReviewData {
  projectTitle: string; clientName: string; roundNumber: number;
  maxRevisionRounds: number; currentRound: number; reviewDeadline: string;
  status: string; deliveredPhotos: DeliveredPhoto[]; revisions: RevisionRequest[];
  roundsRemaining: number;
  isOverdue?: boolean; daysOverdue?: number; overdueWarning?: string;
}

const REVISION_TYPE_KEYS = ['exposure', 'color', 'crop', 'blemish', 'background', 'other'] as const;

function revisionLabel(key: string): string {
  return t(`portalReview.revisionType.${key}`);
}

export default function PortalReview() {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [data, setData] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [action, setAction] = useState<'accept' | 'request_revisions' | null>(null);
  const [overallFeedback, setOverallFeedback] = useState('');
  const [photoRevisions, setPhotoRevisions] = useState<Record<string, { revisionType: string; description: string }>>({});
  const [submitting, setSubmitting] = useState(false);
  const [expandedPhoto, setExpandedPhoto] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const result = await api.get<ReviewData>(`/api/portal/review/${shareToken}`);
        setData(result);
      } catch (e: any) {
        setError(e.message || t('portalReview.linkExpired'));
      } finally { setLoading(false); }
    })();
  }, [shareToken]);

  const addRevision = (photoId: string) => {
    setPhotoRevisions(prev => ({
      ...prev,
      [photoId]: prev[photoId] || { revisionType: 'other', description: '' },
    }));
    setExpandedPhoto(photoId);
  };

  const updateRevision = (photoId: string, field: 'revisionType' | 'description', value: string) => {
    setPhotoRevisions(prev => ({
      ...prev,
      [photoId]: { ...prev[photoId], [field]: value },
    }));
  };

  const removeRevision = (photoId: string) => {
    setPhotoRevisions(prev => {
      const next = { ...prev };
      delete next[photoId];
      return next;
    });
  };

  const handleSubmit = async (submitAction: 'accept' | 'request_revisions') => {
    if (submitAction === 'request_revisions') {
      const revisionList = Object.entries(photoRevisions).map(([photoId, rev]) => ({
        photoId, revisionType: rev.revisionType, description: rev.description,
      }));
      if (revisionList.length === 0) { setError(t('portalReview.addAtLeastOne')); return; }
      const empty = revisionList.find(r => !r.description.trim());
      if (empty) { setError(t('portalReview.describeSpecifically')); return; }
    }

    if (!confirm(submitAction === 'accept' ? t('portalReview.confirmAccept') : t('portalReview.confirmRevisions'))) return;

    setSubmitting(true);
    setAction(submitAction);
    try {
      const revisionRequests = submitAction === 'request_revisions'
        ? Object.entries(photoRevisions).map(([photoId, rev]) => ({
            photoId, revisionType: rev.revisionType, description: rev.description,
          }))
        : [];
      const resp = await api.post<any>(`/api/portal/review/${shareToken}/feedback`, {
        action: submitAction, revisionRequests, overallFeedback,
      });
      setError('');
      setData(prev => prev ? { ...prev, status: submitAction === 'accept' ? 'accepted' : 'revision_requested' } : null);
      if (resp.conflictWarning) {
        setError(`⚠️ AI detected conflict: ${resp.conflictWarning} (submitted, photographer will confirm)`);
      }
    } catch (e: any) {
      const msg = e.message || '';
      if (msg.includes('修改描述不够具体') || msg.includes('请具体说明')) {
        setError(`❌ ${msg}`);
      } else {
        setError(msg);
      }
    }
    finally { setSubmitting(false); }
  };

  const countdown = data?.reviewDeadline
    ? Math.max(0, Math.floor((new Date(data.reviewDeadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  if (loading) return <div style={center}><div style={spinner} /></div>;
  if (error && !data) return <div style={center}><div style={{ fontSize: 16, color: '#FF3B30', marginBottom: 12 }}>😔</div><div>{error}</div></div>;
  if (!data) return null;

  const isDone = data.status === 'accepted' || data.status === 'revision_requested';

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '16px 16px 80px' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px' }}>{data.projectTitle}</h2>
        <p style={{ fontSize: 14, color: '#86868B', margin: 0 }}>
          {t('portalReview.revisionRound').replace('{round}', String(data.roundNumber))}
          {data.clientName && ` · 👤 ${data.clientName}`}
          {countdown !== null && ` · ⏰ ${t('portalSelection.daysLeft').replace('{days}', String(countdown))}`}
        </p>
        {data.roundsRemaining > 0 && (
          <p style={{ fontSize: 12, color: '#86868B', margin: '4px 0 0' }}>{t('portalReview.roundsLeft').replace('{rounds}', String(data.roundsRemaining))}</p>
        )}
        {data.roundsRemaining === 0 && (
          <p style={{ fontSize: 12, color: '#FF9500', margin: '4px 0 0' }}>⏰ {t('portalReview.lastRound')}</p>
        )}
      </div>

      {data.status === 'accepted' && (
        <div style={{ padding: 16, background: '#F0FFF0', borderRadius: 12, textAlign: 'center', marginBottom: 16, fontSize: 15, color: '#34C759', fontWeight: 600 }}>
          {data.roundsRemaining > 0
            ? t('portalReview.acceptedMessage').replace('{roundsRemaining}', t('portalReview.roundsLeft').replace('{rounds}', String(data.roundsRemaining)))
            : t('portalReview.deliveryComplete')}
        </div>
      )}

      {data.status === 'revision_requested' && (
        <div style={{ padding: 16, background: '#FFF8E1', borderRadius: 12, textAlign: 'center', marginBottom: 16, fontSize: 15, color: '#FF9500', fontWeight: 600 }}>
          {t('portalReview.revisionsSubmittedMessage')}
        </div>
      )}

      {error && <div style={{ padding: 10, background: '#FFF0F0', borderRadius: 8, color: '#FF3B30', fontSize: 13, marginBottom: 12 }}>{error}</div>}

      {/* Overdue warning */}
      {data.isOverdue && data.status === 'pending_review' && (
        <div style={{ padding: 12, background: '#FFF0F0', borderRadius: 10, border: '1px solid #FF3B30', marginBottom: 12, fontSize: 14, color: '#FF3B30', textAlign: 'center', fontWeight: 600 }}>
          ⏰ {data.overdueWarning || t('portalReview.overdueWarning').replace('{days}', String(data.daysOverdue || 0))}
        </div>
      )}

      {/* Photo grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
        {data.deliveredPhotos.map(photo => {
          const hasRevision = !!photoRevisions[photo.id];
          const existingRev = data.revisions.find(r => r.photoId === photo.id);
          return (
            <div key={photo.id} style={{ borderRadius: 10, overflow: 'hidden', border: hasRevision ? '2px solid #FF9500' : '1px solid #E5E5EA' }}>
              <img src={photo.url} alt={photo.filename} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block', cursor: 'pointer' }}
                onClick={() => setExpandedPhoto(expandedPhoto === photo.id ? null : photo.id)} />
              {existingRev && (
                <div style={{ padding: '4px 8px', fontSize: 11, background: existingRev.status === 'done' ? '#F0FFF0' : '#FFF8E1' }}>
                  {existingRev.status === 'done' ? '✅' : '⏳'} {revisionLabel(existingRev.revisionType)}
                </div>
              )}
              {!isDone && (
                <button onClick={() => hasRevision ? removeRevision(photo.id) : addRevision(photo.id)}
                  style={{ width: '100%', padding: '6px', border: 'none', fontSize: 12, cursor: 'pointer',
                    background: hasRevision ? '#FF9500' : '#F0F0F2', color: hasRevision ? '#fff' : '#86868B' }}>
                  {hasRevision ? t('portalReview.cancelMark') : `✏️ ${t('portalReview.markRevision')}`}
                </button>
              )}
              {/* Expanded revision form */}
              {expandedPhoto === photo.id && !isDone && (
                <div style={{ padding: 10, background: '#FFF8E1' }}>
                  <select value={photoRevisions[photo.id]?.revisionType || 'other'}
                    onChange={e => updateRevision(photo.id, 'revisionType', e.target.value)}
                    style={{ width: '100%', padding: '6px', borderRadius: 6, border: '1px solid #E5E5EA', fontSize: 13, marginBottom: 6 }}>
                    {REVISION_TYPE_KEYS.map(k => <option key={k} value={k}>{revisionLabel(k)}</option>)}
                  </select>
                  <textarea
                    value={photoRevisions[photo.id]?.description || ''}
                    onChange={e => updateRevision(photo.id, 'description', e.target.value)}
                    placeholder={t('portalReview.feedbackPlaceholder')}
                    style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #E5E5EA', fontSize: 13, minHeight: 60, resize: 'vertical', boxSizing: 'border-box' }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Action section */}
      {!isDone && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '1px solid #E5E5EA', padding: '12px 16px 20px', maxWidth: 800, margin: '0 auto' }}>
          <textarea value={overallFeedback} onChange={e => setOverallFeedback(e.target.value)}
            placeholder={t('portalReview.feedbackPlaceholder')}
            style={{ width: '100%', padding: '10px', borderRadius: 10, border: '1px solid #E5E5EA', fontSize: 13, minHeight: 50, resize: 'none', boxSizing: 'border-box', marginBottom: 10 }}
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => handleSubmit('accept')} disabled={submitting}
              style={{ flex: 1, padding: '14px', borderRadius: 12, border: 'none', background: '#34C759', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: submitting ? .5 : 1 }}>
              ✅ {t('portalReview.acceptAll')}
            </button>
            <button onClick={() => handleSubmit('request_revisions')} disabled={submitting || data.roundsRemaining <= 0}
              style={{ flex: 1, padding: '14px', borderRadius: 12, border: 'none', background: data.roundsRemaining <= 0 ? '#E5E5EA' : '#FF9500', color: '#fff', fontSize: 15, fontWeight: 700, cursor: data.roundsRemaining <= 0 ? 'not-allowed' : 'pointer', opacity: submitting ? .5 : 1 }}>
              🔄 {t('portalReview.requestRevisions')} ({Object.keys(photoRevisions).length})
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const center: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: '#86868B', fontSize: 15 };
const spinner: React.CSSProperties = { width: 32, height: 32, border: '3px solid #E5E5EA', borderTopColor: '#007AFF', borderRadius: '50%', animation: 'spin .8s linear infinite' };
