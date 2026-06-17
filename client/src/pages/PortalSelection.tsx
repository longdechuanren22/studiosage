import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../utils/api';

interface GalleryPhoto { id: string; filename: string; originalName: string; url: string; thumbnailUrl: string; order: number; }
interface SelectionData {
  projectTitle: string; shootType: string; clientName: string;
  maxRetouch: number; selectionDeadline: string; selectionStatus: string;
  selectedIds: string[]; rejectedIds: string[]; favoriteIds: string[];
  photos: GalleryPhoto[];
  isOverdue?: boolean; daysOverdue?: number; overdueWarning?: string;
}

export default function PortalSelection() {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [data, setData] = useState<SelectionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [rejectedIds, setRejectedIds] = useState<string[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'single'>('grid');
  const [currentPhotoIdx, setCurrentPhotoIdx] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const result = await api.get<SelectionData>(`/api/portal/selection/${shareToken}`);
        setData(result);
        setSelectedIds(result.selectedIds || []);
        setRejectedIds(result.rejectedIds || []);
        setFavoriteIds(result.favoriteIds || []);
      } catch (e: any) {
        setError(e.message || '选片链接不存在或已失效');
      } finally { setLoading(false); }
    })();
  }, [shareToken]);

  const togglePhoto = useCallback((photoId: string, action: 'select' | 'reject' | 'favorite') => {
    if (data?.selectionStatus === 'selection_done') return;

    // Toggle: if already in target state, remove it (clear selection); else move to target
    if (action === 'select') {
      setSelectedIds(prev => {
        if (prev.includes(photoId)) return prev.filter(id => id !== photoId);
        if (prev.length >= (data?.maxRetouch || Infinity)) return prev;
        return [...prev, photoId];
      });
      // Clear from rejected/favorite when selecting
      setRejectedIds(prev => prev.filter(id => id !== photoId));
      setFavoriteIds(prev => prev.filter(id => id !== photoId));
    } else if (action === 'reject') {
      setRejectedIds(prev => prev.includes(photoId) ? prev.filter(id => id !== photoId) : [...prev, photoId]);
      // Clear from selected/favorite when rejecting
      setSelectedIds(prev => prev.filter(id => id !== photoId));
      setFavoriteIds(prev => prev.filter(id => id !== photoId));
    } else if (action === 'favorite') {
      setFavoriteIds(prev => prev.includes(photoId) ? prev.filter(id => id !== photoId) : [...prev, photoId]);
      // Clear from rejected when favoriting (keep selected if also selected)
      setRejectedIds(prev => prev.filter(id => id !== photoId));
    }
  }, [data?.maxRetouch, data?.selectionStatus]);

  const handleSubmit = async () => {
    if (selectedIds.length === 0) { setError('请至少选择一张照片进行精修'); return; }
    if (!confirm(`确认提交？您选择了 ${selectedIds.length} 张精修照片。提交后不可修改。`)) return;
    setSubmitting(true);
    try {
      await api.post(`/api/portal/selection/${shareToken}`, {
        selectedIds, rejectedIds, favoriteIds,
      });
      setData(prev => prev ? { ...prev, selectionStatus: 'selection_done', selectedIds, rejectedIds, favoriteIds } : null);
      setError('');
    } catch (e: any) {
      const msg = e.message || '';
      if (msg.includes('不够具体') || msg.includes('请补充')) {
        setError(`❌ ${msg}`);
      } else {
        setError(msg);
      }
    }
    finally { setSubmitting(false); }
  };

  const countdown = data?.selectionDeadline
    ? Math.max(0, Math.floor((new Date(data.selectionDeadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  if (loading) return <div style={center}><div style={spinner} /></div>;
  if (error && !data) return <div style={center}><div style={{ fontSize: 16, color: '#FF3B30', marginBottom: 12 }}>😔</div><div>{error}</div></div>;
  if (!data) return null;

  const isDone = data.selectionStatus === 'selection_done';

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '16px 16px 80px' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px' }}>{data.projectTitle}</h2>
        <p style={{ fontSize: 14, color: '#86868B', margin: 0 }}>
          {data.clientName && `👤 ${data.clientName}`}
          {countdown !== null && ` · ⏰ 剩余 ${countdown} 天`}
        </p>
      </div>

      {/* Selection progress */}
      <div style={{ background: '#fff', borderRadius: 14, padding: 16, marginBottom: 16, border: '1px solid #F0F0F2' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>已选 {selectedIds.length}/{data.maxRetouch} 张</span>
          <span style={{ fontSize: 12, color: selectedIds.length >= data.maxRetouch ? '#FF9500' : '#34C759' }}>
            {selectedIds.length >= data.maxRetouch ? '已到达上限' : `还可选 ${data.maxRetouch - selectedIds.length} 张`}
          </span>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: '#E5E5EA', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.min(100, (selectedIds.length / data.maxRetouch) * 100)}%`, borderRadius: 3, background: selectedIds.length >= data.maxRetouch ? '#FF9500' : '#007AFF', transition: 'width .3s' }} />
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 13, color: '#86868B' }}>
          <span>✅ {selectedIds.length} 精修</span>
          <span>❌ {rejectedIds.length} 跳过</span>
          <span>⭐ {favoriteIds.length} 喜欢</span>
        </div>
        {isDone && <div style={{ marginTop: 12, padding: 10, background: '#F0FFF0', borderRadius: 8, fontSize: 14, color: '#34C759', textAlign: 'center', fontWeight: 600 }}>✅ 选片已提交，摄影师将开始精修</div>}
      </div>

      {error && <div style={{ padding: 10, background: '#FFF0F0', borderRadius: 8, color: '#FF3B30', fontSize: 13, marginBottom: 12 }}>{error}</div>}

      {/* Overdue warning */}
      {data.isOverdue && !isDone && (
        <div style={{ padding: 12, background: '#FFF0F0', borderRadius: 10, border: '1px solid #FF3B30', marginBottom: 12, fontSize: 14, color: '#FF3B30', textAlign: 'center', fontWeight: 600 }}>
          ⏰ {data.overdueWarning || `选片已逾期${data.daysOverdue}天`}
        </div>
      )}

      {/* View mode toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => setViewMode('grid')} style={{ ...tabBtn, background: viewMode === 'grid' ? '#007AFF' : '#F0F0F2', color: viewMode === 'grid' ? '#fff' : '#1D1D1F' }}>▦ 网格</button>
          <button onClick={() => setViewMode('single')} style={{ ...tabBtn, background: viewMode === 'single' ? '#007AFF' : '#F0F0F2', color: viewMode === 'single' ? '#fff' : '#1D1D1F' }}>◉ 单张</button>
        </div>
        {!isDone && (
          <button onClick={handleSubmit} disabled={submitting || selectedIds.length === 0} style={{
            ...btnSubmit, opacity: submitting || selectedIds.length === 0 ? .5 : 1,
          }}>{submitting ? '提交中…' : `提交选片 (${selectedIds.length}张)`}</button>
        )}
      </div>

      {/* Grid view */}
      {viewMode === 'grid' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
          {data.photos.map(photo => {
            const isSelected = selectedIds.includes(photo.id);
            const isRejected = rejectedIds.includes(photo.id);
            const isFav = favoriteIds.includes(photo.id);
            return (
              <div key={photo.id} style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: isSelected ? '3px solid #007AFF' : isFav ? '3px solid #FFD60A' : isRejected ? '1px solid #FF3B30' : '1px solid #E5E5EA', opacity: isRejected ? .5 : 1 }}>
                <img src={photo.thumbnailUrl} alt={photo.filename} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
                {!isDone && (
                  <div style={{ display: 'flex', borderTop: '1px solid #E5E5EA' }}>
                    <button onClick={() => togglePhoto(photo.id, 'select')} style={{ ...actionBtn, background: isSelected ? '#007AFF' : '#fff', color: isSelected ? '#fff' : '#007AFF', flex: 1 }}>{isSelected ? '✓' : '✅'}</button>
                    <button onClick={() => togglePhoto(photo.id, 'favorite')} style={{ ...actionBtn, background: isFav ? '#FFD60A' : '#fff', color: isFav ? '#fff' : '#86868B', flex: 1, borderLeft: '1px solid #E5E5EA', borderRight: '1px solid #E5E5EA' }}>{isFav ? '⭐' : '☆'}</button>
                    <button onClick={() => togglePhoto(photo.id, 'reject')} style={{ ...actionBtn, background: isRejected ? '#FF3B30' : '#fff', color: isRejected ? '#fff' : '#86868B', flex: 1 }}>✕</button>
                  </div>
                )}
                {isSelected && <div style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11, background: '#007AFF', color: '#fff', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</div>}
                {isFav && !isSelected && <div style={{ position: 'absolute', top: 6, right: 6, fontSize: 16 }}>⭐</div>}
              </div>
            );
          })}
        </div>
      )}

      {/* Single photo view */}
      {viewMode === 'single' && data.photos.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', border: '1px solid #F0F0F2' }}>
          <img src={data.photos[currentPhotoIdx].url} alt={data.photos[currentPhotoIdx].filename}
            style={{ width: '100%', maxHeight: '60vh', objectFit: 'contain', background: '#000' }} />
          <div style={{ padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button onClick={() => setCurrentPhotoIdx(Math.max(0, currentPhotoIdx - 1))} disabled={currentPhotoIdx === 0} style={navBtn}>← 上一张</button>
              <span style={{ fontSize: 13, color: '#86868B' }}>{currentPhotoIdx + 1} / {data.photos.length}</span>
              <button onClick={() => setCurrentPhotoIdx(Math.min(data.photos.length - 1, currentPhotoIdx + 1))} disabled={currentPhotoIdx === data.photos.length - 1} style={navBtn}>下一张 →</button>
            </div>
            {!isDone && (
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button onClick={() => togglePhoto(data.photos[currentPhotoIdx].id, 'select')}
                  style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                    background: selectedIds.includes(data.photos[currentPhotoIdx].id) ? '#007AFF' : '#F0F0F2',
                    color: selectedIds.includes(data.photos[currentPhotoIdx].id) ? '#fff' : '#1D1D1F' }}>
                  {selectedIds.includes(data.photos[currentPhotoIdx].id) ? '✓ 已选' : '✅ 选择精修'}
                </button>
                <button onClick={() => togglePhoto(data.photos[currentPhotoIdx].id, 'favorite')}
                  style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                    background: favoriteIds.includes(data.photos[currentPhotoIdx].id) ? '#FFD60A' : '#F0F0F2',
                    color: favoriteIds.includes(data.photos[currentPhotoIdx].id) ? '#fff' : '#1D1D1F' }}>
                  {favoriteIds.includes(data.photos[currentPhotoIdx].id) ? '⭐ 已收藏' : '☆ 喜欢'}
                </button>
                <button onClick={() => togglePhoto(data.photos[currentPhotoIdx].id, 'reject')}
                  style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                    background: rejectedIds.includes(data.photos[currentPhotoIdx].id) ? '#FF3B30' : '#F0F0F2',
                    color: rejectedIds.includes(data.photos[currentPhotoIdx].id) ? '#fff' : '#1D1D1F' }}>
                  {rejectedIds.includes(data.photos[currentPhotoIdx].id) ? '✕ 已跳过' : '✕ 跳过'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const center: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: '#86868B', fontSize: 15 };
const spinner: React.CSSProperties = { width: 32, height: 32, border: '3px solid #E5E5EA', borderTopColor: '#007AFF', borderRadius: '50%', animation: 'spin .8s linear infinite' };
const tabBtn: React.CSSProperties = { padding: '6px 14px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const btnSubmit: React.CSSProperties = { padding: '10px 24px', borderRadius: 10, border: 'none', background: '#007AFF', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' };
const actionBtn: React.CSSProperties = { padding: '8px 4px', border: 'none', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const navBtn: React.CSSProperties = { padding: '6px 14px', borderRadius: 8, border: '1px solid #E5E5EA', background: '#fff', fontSize: 13, cursor: 'pointer' };
