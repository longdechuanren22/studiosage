import { useState, useEffect, useRef, useCallback } from 'react';
import { useUser } from '../contexts/UserContext';
import { useToast } from '../contexts/ToastContext';
import { api } from '../utils/api';
import { logError } from '../utils/error';
import { platform, selectFolder, uploadPhotosDesktop, uploadDeliveryDesktop, type ProgressEvent } from '../utils/platform';
import { t, tf } from '../i18n';

interface Client { id: string; name: string; email: string; stage: string; }
interface Project {
  id: string; client_id: string; client_name: string; client_email: string;
  title: string; shoot_type: string; shoot_date: string; delivery_due_date: string;
  package_type: string; max_retouch_count: number; max_revision_rounds: number;
  current_round: number; status: string; proposal_id: string;
  gallery_id: string; selection_status: string; gallery_total: number;
  round_count: number; selectedCount: number;
  created_at: string;
}
interface GalleryPhoto { id: string; filename: string; originalName: string; url: string; thumbnailUrl: string; order: number; size: number; }
interface Gallery {
  id: string; project_id: string; total_count: number; photos: GalleryPhoto[];
  selection_deadline: string; selection_status: string; share_token: string;
  selectedIds: string[]; rejectedIds: string[]; favoriteIds: string[];
  reminder?: string;
  duplicateGroups?: { base: string; count: number; ids: string[] }[];
}
interface DeliveryRound {
  id: string; round_number: number; deliveredPhotos: { id: string; filename: string; url: string; order: number }[];
  status: string; review_deadline: string; client_feedback: string; share_token: string;
  revisions: any[]; revision_count: number;
}

const STATUS_COLORS: Record<string, string> = {
  draft: '#86868B', selection: '#007AFF', editing: '#FF9500', review: '#5856D6', completed: '#34C759', cancelled: '#FF3B30',
};
const SHOOT_TYPES = ['wedding', 'portrait', 'event', 'commercial', 'newborn', 'maternity', 'graduation', 'boudoir', 'aerial'];

export default function Projects() {
  const { token } = useUser();
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Detail views
  const [gallery, setGallery] = useState<Gallery | null>(null);
  const [rounds, setRounds] = useState<DeliveryRound[]>([]);
  const [detailTab, setDetailTab] = useState<'gallery' | 'deliveries'>('gallery');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  // ── Desktop upload state ──
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<ProgressEvent | null>(null);
  const [desktopUploading, setDesktopUploading] = useState(false);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Create form
  const [form, setForm] = useState({ clientId: '', title: '', shootType: 'wedding', shootDate: '', deliveryDueDate: '', packageType: 'Standard', proposalId: '' });

  const fetchProjects = async () => {
    try {
      const data = await api.get<any[]>('/api/projects');
      setProjects(Array.isArray(data) ? data : []);
    } catch (err) { logError('Projects.fetchProjects', err); } finally { setLoading(false); }
  };

  const fetchClients = async () => {
    try { const data = await api.get<any[]>('/api/clients'); setClients(Array.isArray(data) ? data : []); } catch (err) { logError('Projects.fetchClients', err); }
  };

  const fetchDetail = async (id: string) => {
    try {
      const data = await api.get<any>(`/api/projects/${id}`);
      setGallery(data.gallery);
      setRounds(data.rounds || []);
    } catch (err) { logError('Projects.fetchDetail', err); }
  };

  useEffect(() => { fetchProjects(); fetchClients(); }, [token]);

  useEffect(() => {
    if (selectedId) fetchDetail(selectedId);
    else { setGallery(null); setRounds([]); }
  }, [selectedId, token]);

  // ── Create project ──
  const handleCreate = async () => {
    if (!form.title || !form.clientId) { toast(t('projects.create.fillRequired'), 'error'); return; }
    try {
      await api.post('/api/projects', form);
      toast(t('projects.create.created'), 'success');
      setShowCreate(false);
      setForm({ clientId: '', title: '', shootType: 'wedding', shootDate: '', deliveryDueDate: '', packageType: 'Standard', proposalId: '' });
      fetchProjects();
    } catch (e: any) { toast(e.message, 'error'); }
  };

  // ── Desktop: folder picker + drag-drop upload ──
  const handleDesktopUpload = useCallback(async (projectId: string) => {
    try {
      const files = await selectFolder();
      if (files.length === 0) { toast(t('projects.toast.noFiles'), 'info'); return; }
      setDesktopUploading(true);
      const result = await uploadPhotosDesktop(
        projectId,
        files.map(f => f.path),
        window.location.origin,
        token!,
        (e) => setUploadProgress(e),
      );
      toast(tf('projects.toast.photosUploaded', { added: result.added, total: result.total }), 'success');
      if (result.errors.length > 0) {
        toast(tf('projects.toast.filesFailed', { count: result.errors.length }), 'error');
      }
      setUploadProgress(null);
      setDesktopUploading(false);
      fetchDetail(projectId);
      fetchProjects();
    } catch (e: any) {
      toast(e.message || t('projects.toast.uploadFail'), 'error');
      setDesktopUploading(false);
    }
  }, [token]);

  const handleDesktopDeliveryUpload = useCallback(async (projectId: string) => {
    try {
      const files = await selectFolder();
      if (files.length === 0) { toast(t('projects.toast.noFiles'), 'info'); return; }
      setDesktopUploading(true);
      const result = await uploadDeliveryDesktop(
        projectId,
        files.map(f => f.path),
        window.location.origin,
        token!,
        (e) => setUploadProgress(e),
      );
      toast(tf('projects.toast.deliveryUploaded', { added: result.added, total: result.total }), 'success');
      setUploadProgress(null);
      setDesktopUploading(false);
      fetchDetail(projectId);
      fetchProjects();
    } catch (e: any) {
      toast(e.message || t('projects.toast.deliveryFail'), 'error');
      setDesktopUploading(false);
    }
  }, [token]);

  // ── Web upload (browser fallback) ──
  const handleUpload = async (projectId: string, files: FileList) => {
    if (platform.isDesktop()) {
      // Should use folder picker instead
      await handleDesktopUpload(projectId);
      return;
    }
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) formData.append('photos', files[i]);
    try {
      const resp = await fetch(`/api/projects/${projectId}/gallery/photos`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      toast(tf('projects.toast.photosUploaded', { added: data.added, total: data.added }), 'success');
      fetchDetail(projectId);
      fetchProjects();
    } catch (e: any) { toast(e.message, 'error'); }
  };

  // ── Send gallery to client ──
  const handleSendGallery = async (projectId: string) => {
    const deadline = prompt(t('projects.gallery.deadlinePrompt'));
    try {
      const data = await api.patch<{ shareToken: string; shareUrl: string }>(`/api/projects/${projectId}/gallery/send`, {
        selectionDeadline: deadline || undefined,
      });
      const fullUrl = `${window.location.origin}/sage/portal/selection/${data.shareToken}`;
      navigator.clipboard?.writeText(fullUrl).then(() => toast(t('projects.toast.linkCopied'), 'success'));
      fetchDetail(projectId);
      fetchProjects();
    } catch (e: any) { toast(e.message, 'error'); }
  };

  // ── Upload edited photos (delivery) ──
  const handleDeliver = async (projectId: string, files?: FileList) => {
    if (platform.isDesktop()) {
      await handleDesktopDeliveryUpload(projectId);
      return;
    }
    if (!files) return;
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) formData.append('photos', files[i]);
    try {
      const resp = await fetch(`/api/projects/${projectId}/deliveries`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      toast(tf('projects.toast.roundDelivered', { round: data.roundNumber, added: data.added }), 'success');
      fetchDetail(projectId);
      fetchProjects();
    } catch (e: any) { toast(e.message, 'error'); }
  };

  // ── Advance status ──
  const handleAdvance = async (projectId: string, to: string) => {
    try {
      await api.post(`/api/projects/${projectId}/advance`, { to });
      toast(t('projects.toast.statusUpdated'), 'success');
      fetchDetail(projectId);
      fetchProjects();
    } catch (e: any) { toast(e.message, 'error'); }
  };

  // ── Delete photo from gallery ──
  const handleDeletePhoto = async (projectId: string, photoId: string) => {
    try {
      await api.del(`/api/projects/${projectId}/gallery/photos/${photoId}`);
      toast(t('projects.toast.deleted'), 'info');
      fetchDetail(projectId);
    } catch (e: any) { toast(e.message, 'error'); }
  };

  const selectedProject = projects.find(p => p.id === selectedId);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#86868B' }}>{t('shared.loading')}</div>;

  // ── Detail View ──
  if (selectedProject) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button onClick={() => setSelectedId(null)} style={btnGhost}>{t('projects.actions.back')}</button>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{selectedProject.title}</h2>
          <span style={{ ...statusBadge(selectedProject.status) }}>{t(`projects.status.${selectedProject.status}`) || selectedProject.status}</span>
        </div>

        {/* Project info bar */}
        <div style={card}>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 14 }}>
            <span>👤 {selectedProject.client_name}</span>
            <span>📷 {t(`projects.shootType.${selectedProject.shoot_type}`) || selectedProject.shoot_type}</span>
            <span>📅 {selectedProject.shoot_date || t('projects.info.noDate')}</span>
            <span>📦 {tf('projects.info.packageDetail', { package: t(`projects.package.${selectedProject.package_type}`) || selectedProject.package_type, retouch: selectedProject.max_retouch_count, rounds: selectedProject.max_revision_rounds })}</span>
            <span>🔄 {tf('projects.info.roundStatus', { current: selectedProject.current_round, max: selectedProject.max_revision_rounds })}</span>
          </div>
          {/* Status actions */}
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            {selectedProject.status === 'draft' && (
              <button onClick={() => handleAdvance(selectedProject.id, 'selection')} style={btnPrimary} disabled={!selectedProject.gallery_id}>📤 {t('projects.actions.advanceToSelection')}</button>
            )}
            {selectedProject.status === 'selection' && (
              <button onClick={() => handleAdvance(selectedProject.id, 'editing')} style={btnPrimary} disabled={selectedProject.selectedCount === 0}>✂️ {t('projects.actions.confirmSelection')}</button>
            )}
            {selectedProject.status === 'editing' && (
              <button onClick={() => {
                if (platform.isDesktop()) { handleDeliver(selectedProject.id); }
                else { editFileInputRef.current?.click(); }
              }} style={btnPrimary} disabled={desktopUploading}>
                {desktopUploading ? `⏳ ${t('projects.actions.uploading')}` : `📤 ${t('projects.actions.uploadDelivery')}`}
              </button>
            )}
            {selectedProject.status === 'review' && selectedProject.current_round < selectedProject.max_revision_rounds && (
              rounds.some(r => r.status === 'revision_requested')
                ? <button onClick={() => handleAdvance(selectedProject.id, 'editing')} style={btnWarn}>🔙 {t('projects.actions.backToEditing')}</button>
                : <button onClick={() => handleAdvance(selectedProject.id, 'editing')} style={btnPrimary}>📤 {tf('projects.actions.uploadNextRound', { round: selectedProject.current_round + 1 })}</button>
            )}
            {(selectedProject.status === 'review' && selectedProject.current_round >= selectedProject.max_revision_rounds) && (
              <button onClick={() => handleAdvance(selectedProject.id, 'completed')} style={btnSuccess}>✅ {t('projects.actions.markComplete')}</button>
            )}
            {!['completed', 'cancelled'].includes(selectedProject.status) && (
              <button onClick={async () => { if (confirm(t('projects.actions.confirmCancel'))) { await api.post(`/api/projects/${selectedProject.id}/cancel`); fetchDetail(selectedProject.id); fetchProjects(); } }} style={btnDanger}>{t('projects.actions.cancel')}</button>
            )}
          </div>
          <input ref={editFileInputRef} type="file" multiple accept="image/*" style={{ display: 'none' }}
            onChange={e => { if (e.target.files?.length) handleDeliver(selectedProject.id, e.target.files); e.target.value = ''; }} />
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0 }}>
          {(['gallery', 'deliveries'] as const).map(tab => (
            <button key={tab} onClick={() => setDetailTab(tab)}
              style={{ padding: '10px 20px', border: 'none', borderRadius: '10px 10px 0 0', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                background: detailTab === tab ? '#fff' : '#F5F5F7', color: detailTab === tab ? '#1D1D1F' : '#86868B' }}>
              {tab === 'gallery' ? `🖼 ${t('projects.tabs.gallery')}` : `📦 ${tf('projects.delivery.tabLabel', { count: rounds.length })}`}
            </button>
          ))}
        </div>

        {/* Gallery Tab */}
        {detailTab === 'gallery' && (
          <div style={card}>
            {gallery ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 14, color: '#86868B' }}>
                    {tf('projects.gallery.totalStats', { total: gallery.photos.length, selected: gallery.selectedIds.length, status: gallery.selection_status })}
                    {gallery.reminder && <span style={{ marginLeft: 12, fontSize: 13, fontWeight: 600, color: gallery.reminder.startsWith('⚠️') ? '#FF3B30' : '#FF9500' }}>{gallery.reminder}</span>}
                    {gallery.duplicateGroups && gallery.duplicateGroups.length > 0 && (
                      <span style={{ marginLeft: 12, fontSize: 12, color: '#FF9500', background: '#FFF3E0', padding: '2px 8px', borderRadius: 6 }}>
                        ⚠️ {t('projects.gallery.duplicated')} ({gallery.duplicateGroups.reduce((s,g) => s + g.count, 0)})
                      </span>
                    )}
                    {gallery.share_token && <span style={{ marginLeft: 12, color: '#007AFF', cursor: 'pointer' }}
                      onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/sage/portal/selection/${gallery.share_token}`).then(() => toast(t('projects.toast.linkCopied'), 'info')); }}>
                      📋 {t('projects.gallery.copySelectionLink')}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {platform.isDesktop()
                      ? <button onClick={() => handleDesktopUpload(selectedProject.id)} style={btnPrimary} disabled={desktopUploading}>
                          {desktopUploading ? `⏳ ${t('projects.actions.uploading')}` : `📁 ${t('projects.actions.selectFolderUpload')}`}
                        </button>
                      : <button onClick={() => fileInputRef.current?.click()} style={btnPrimary}>📤 {t('projects.gallery.upload')}</button>
                    }
                    {gallery.photos.length > 0 && gallery.selection_status !== 'selection_done' && (
                      <button onClick={() => handleSendGallery(selectedProject.id)} style={btnSuccess}>📤 {t('projects.gallery.sendLink')}</button>
                    )}
                  </div>
                  {!platform.isDesktop() && (
                    <input ref={fileInputRef} type="file" multiple accept="image/*" style={{ display: 'none' }}
                      onChange={e => { if (e.target.files?.length) handleUpload(selectedProject.id, e.target.files); e.target.value = ''; }} />
                  )}
                </div>

                {/* Desktop drag-drop zone */}
                {platform.isDesktop() && (
                  <div ref={dropZoneRef}
                    onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={async e => {
                      e.preventDefault();
                      setIsDragging(false);
                      if (e.dataTransfer.files.length > 0) {
                        // Web fallback for drag-drop in Tauri webview
                        handleUpload(selectedProject.id, e.dataTransfer.files);
                      }
                    }}
                    style={{
                      border: `2px dashed ${isDragging ? '#007AFF' : '#E5E5EA'}`,
                      borderRadius: 12,
                      padding: '24px',
                      textAlign: 'center',
                      background: isDragging ? 'rgba(0,122,255,.04)' : '#FAFAFA',
                      marginBottom: 12,
                      transition: 'all .2s',
                      cursor: 'pointer',
                    }}
                    onClick={() => handleDesktopUpload(selectedProject.id)}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>📁</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#1D1D1F' }}>
                      {isDragging ? t('projects.gallery.releaseToUpload') : t('projects.gallery.dropOrClick')}
                    </div>
                    <div style={{ fontSize: 12, color: '#86868B', marginTop: 4 }}>
                      {t('projects.gallery.formatsSupported')}
                    </div>
                  </div>
                )}

                {/* Upload progress */}
                {uploadProgress && (
                  <div style={{ marginBottom: 12, padding: '10px 14px', background: '#F0F7FF', borderRadius: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#007AFF', marginBottom: 6 }}>
                      <span>{uploadProgress.status === 'uploading' ? '⏳' : '✅'} {uploadProgress.filename}</span>
                      <span>{uploadProgress.current}/{uploadProgress.total}</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: '#E5E5EA', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(uploadProgress.current / uploadProgress.total) * 100}%`, borderRadius: 2, background: '#007AFF', transition: 'width .3s' }} />
                    </div>
                  </div>
                )}
                {gallery.photos.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 40, color: '#86868B' }}>{t('projects.gallery.noPhotosHint')}</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
                    {gallery.photos.map(photo => {
                      const isSelected = gallery.selectedIds.includes(photo.id);
                      return (
                        <div key={photo.id} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: isSelected ? '3px solid #007AFF' : '1px solid #E5E5EA' }}>
                          <img src={photo.thumbnailUrl} alt={photo.filename} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
                          <div style={{ position: 'absolute', top: 4, right: 4 }}>
                            <button onClick={() => handleDeletePhoto(selectedProject.id, photo.id)}
                              style={{ width: 24, height: 24, borderRadius: 12, border: 'none', background: 'rgba(0,0,0,.6)', color: '#fff', fontSize: 12, cursor: 'pointer' }}>✕</button>
                          </div>
                          {isSelected && <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: '#007AFF', color: '#fff', fontSize: 11, padding: '2px 6px', textAlign: 'center' }}>{t('projects.gallery.selected')}</div>}
                          <div style={{ fontSize: 10, padding: 4, color: '#86868B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{photo.originalName}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: 40, color: '#86868B' }}>
                {t('projects.gallery.notInitialized')}
                <br /><button onClick={() => fileInputRef.current?.click()} style={{ ...btnPrimary, marginTop: 12 }}>📤 {t('projects.gallery.upload')}</button>
              </div>
            )}
          </div>
        )}

        {/* Deliveries Tab */}
        {detailTab === 'deliveries' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {rounds.length === 0 ? (
              <div style={{ ...card, textAlign: 'center', color: '#86868B', padding: 40 }}>{t('projects.delivery.noRoundsHint')}</div>
            ) : (
              rounds.map(round => (
                <div key={round.id} style={card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h4 style={{ margin: 0, fontSize: 16 }}>{t('projects.delivery.round')} {round.round_number} — {round.status === 'pending_review' ? `⏳ ${t('projects.delivery.waitingReview')}` : round.status === 'accepted' ? `✅ ${t('projects.delivery.accepted')}` : round.status === 'revision_requested' ? `🔄 ${t('projects.delivery.revisionRequested')}` : round.status}</h4>
                    {round.share_token && (
                      <span style={{ fontSize: 12, color: '#007AFF', cursor: 'pointer' }}
                        onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/sage/portal/review/${round.share_token}`).then(() => toast(t('projects.toast.reviewLinkCopied'), 'info')); }}>
                        📋 {t('projects.delivery.copyLink')}</span>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 6 }}>
                    {round.deliveredPhotos.map((photo: any) => (
                      <div key={photo.id} style={{ borderRadius: 6, overflow: 'hidden', border: '1px solid #E5E5EA' }}>
                        <img src={photo.url} alt={photo.filename} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover' }} />
                      </div>
                    ))}
                  </div>
                  {round.client_feedback && (
                    <div style={{ marginTop: 12, padding: 10, background: '#F5F5F7', borderRadius: 8, fontSize: 13, color: '#1D1D1F' }}>
                      💬 {t('projects.delivery.clientFeedback')} {round.client_feedback}
                    </div>
                  )}
                  {round.revisions && round.revisions.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{t('projects.delivery.revisionRequests')}</div>
                      {round.revisions.map((rev: any) => (
                        <div key={rev.id} style={{ padding: '8px 12px', background: rev.status === 'done' ? '#F0FFF0' : rev.status === 'declined' ? '#FFF0F0' : '#FFF8E1', borderRadius: 6, marginBottom: 6, fontSize: 13 }}>
                          <div>📷 照片 {rev.photo_id.slice(0, 8)}… — {rev.revision_type} — <b>{rev.status}</b></div>
                          <div style={{ color: '#86868B' }}>{rev.description}</div>
                          {rev.photographer_note && <div style={{ color: '#FF9500' }}>{t('projects.delivery.photographerReply')} {rev.photographer_note}</div>}
                          {rev.status === 'pending' && (
                            <div style={{ marginTop: 4, display: 'flex', gap: 6 }}>
                              <button onClick={async () => { await api.patch(`/api/projects/revisions/${rev.id}`, { status: 'done' }); fetchDetail(selectedProject.id); }} style={{ ...btnPrimary, fontSize: 11, padding: '2px 10px' }}>{t('projects.delivery.done')}</button>
                              <button onClick={async () => {
                                const note = prompt(t('projects.delivery.declineReason')); if (!note) return;
                                await api.patch(`/api/projects/revisions/${rev.id}`, { status: 'declined', photographerNote: note });
                                fetchDetail(selectedProject.id);
                              }} style={{ ...btnDanger, fontSize: 11, padding: '2px 10px' }}>{t('projects.delivery.declined')}</button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    );
  }

  // ── List View ──
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.5px', margin: 0 }}>🎬 {t('projects.title')}</h2>
          <p style={{ fontSize: 14, color: '#86868B', margin: '4px 0 0' }}>{t('projects.listSubtitle')}</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} style={btnPrimary}>
          {showCreate ? t('shared.cancel') : t('projects.newProject')}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div style={card}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={label}>{t('projects.create.client')}</label>
              <select value={form.clientId} onChange={e => setForm({ ...form, clientId: e.target.value })} style={input}>
                <option value="">{t('projects.create.selectClient')}</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name} ({c.email})</option>)}
              </select>
            </div>
            <div>
              <label style={label}>{t('projects.create.titleLabel')}</label>
              <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder={t('projects.create.titlePlaceholder')} style={input} />
            </div>
            <div>
              <label style={label}>{t('projects.create.shootType')}</label>
              <select value={form.shootType} onChange={e => setForm({ ...form, shootType: e.target.value })} style={input}>
                {SHOOT_TYPES.map(st => <option key={st} value={st}>{t(`projects.shootType.${st}`)} ({st})</option>)}
              </select>
            </div>
            <div>
              <label style={label}>{t('projects.create.package')}</label>
              <select value={form.packageType} onChange={e => setForm({ ...form, packageType: e.target.value })} style={input}>
                {['Premium', 'Standard', 'Basic'].map(k => <option key={k} value={k}>{t(`projects.package.${k}`)} ({k})</option>)}
              </select>
            </div>
            <div>
              <label style={label}>{t('projects.create.shootDate')}</label>
              <input type="date" value={form.shootDate} onChange={e => setForm({ ...form, shootDate: e.target.value })} style={input} />
            </div>
            <div>
              <label style={label}>{t('projects.create.deliveryDue')}</label>
              <input type="date" value={form.deliveryDueDate} onChange={e => setForm({ ...form, deliveryDueDate: e.target.value })} style={input} />
            </div>
          </div>
          <button onClick={handleCreate} style={{ ...btnPrimary, marginTop: 12 }}>{t('projects.create.create')}</button>
        </div>
      )}

      {/* Project list */}
      {projects.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', padding: 60, color: '#86868B' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎬</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{t('projects.create.noProjects')}</div>
          <div>{t('projects.create.noProjectsHint')}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {projects.map(p => (
            <div key={p.id} onClick={() => setSelectedId(p.id)} style={{ ...card, cursor: 'pointer', transition: 'box-shadow .2s' }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,.1)')}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,.06)')}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 16, fontWeight: 600 }}>{p.title}</span>
                    <span style={{ ...statusBadge(p.status) }}>{t(`projects.status.${p.status}`) || p.status}</span>
                  </div>
                  <div style={{ fontSize: 13, color: '#86868B', marginTop: 4 }}>
                    👤 {p.client_name} · 📷 {t(`projects.shootType.${p.shoot_type}`) || p.shoot_type} · 📦 {t(`projects.package.${p.package_type}`) || p.package_type}
                    {p.gallery_total > 0 && ` · 🖼 ${tf('projects.info.photoCount', { count: p.gallery_total })}`}
                    {p.selectedCount > 0 && ` · ✅ ${tf('projects.info.selectedCount', { count: p.selectedCount })}`}
                    {p.round_count > 0 && ` · 📦 ${tf('projects.info.roundCount', { count: p.round_count })}`}
                  </div>
                </div>
                <span style={{ fontSize: 24, opacity: .5 }}>→</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Shared styles ──
const card: React.CSSProperties = { background: '#fff', borderRadius: 14, padding: 16, border: '1px solid #F0F0F2', boxShadow: '0 1px 3px rgba(0,0,0,.06)' };
const btnPrimary: React.CSSProperties = { padding: '8px 16px', borderRadius: 10, border: 'none', background: '#007AFF', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const btnGhost: React.CSSProperties = { padding: '6px 14px', borderRadius: 8, border: '1px solid #E5E5EA', background: '#fff', color: '#007AFF', fontSize: 13, cursor: 'pointer' };
const btnDanger: React.CSSProperties = { padding: '8px 16px', borderRadius: 10, border: 'none', background: '#FF3B30', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const btnWarn: React.CSSProperties = { padding: '8px 16px', borderRadius: 10, border: 'none', background: '#FF9500', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const btnSuccess: React.CSSProperties = { padding: '8px 16px', borderRadius: 10, border: 'none', background: '#34C759', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const input: React.CSSProperties = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #E5E5EA', fontSize: 14, boxSizing: 'border-box' };
const label: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: '#86868B', marginBottom: 4 };
function statusBadge(s: string): React.CSSProperties { return { padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: (STATUS_COLORS[s] || '#86868B') + '18', color: STATUS_COLORS[s] || '#86868B' }; }
