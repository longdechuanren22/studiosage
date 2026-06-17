import { useState, useEffect, useRef, useCallback } from 'react';
import { useUser } from '../contexts/UserContext';
import { useToast } from '../contexts/ToastContext';
import { api } from '../utils/api';
import { platform, selectFolder, uploadPhotosDesktop, uploadDeliveryDesktop, type ProgressEvent } from '../utils/platform';

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
}
interface DeliveryRound {
  id: string; round_number: number; deliveredPhotos: { id: string; filename: string; url: string; order: number }[];
  status: string; review_deadline: string; client_feedback: string; share_token: string;
  revisions: any[]; revision_count: number;
}

const STATUS_LABELS: Record<string, string> = {
  draft: '草稿', selection: '选片中', editing: '精修中', review: '审核中', completed: '已完成', cancelled: '已取消',
};
const STATUS_COLORS: Record<string, string> = {
  draft: '#86868B', selection: '#007AFF', editing: '#FF9500', review: '#5856D6', completed: '#34C759', cancelled: '#FF3B30',
};
const SHOOT_TYPES = ['wedding', 'portrait', 'event', 'commercial', 'newborn', 'maternity', 'graduation', 'boudoir', 'aerial'];
const SHOOT_LABELS: Record<string, string> = {
  wedding: '婚礼', portrait: '写真', event: '活动', commercial: '商业', newborn: '新生儿', maternity: '孕照', graduation: '毕业', boudoir: '私房', aerial: '航拍',
};
const PACKAGE_LABELS: Record<string, string> = { Premium: '高级', Standard: '标准', Basic: '基础' };

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
    } catch {} finally { setLoading(false); }
  };

  const fetchClients = async () => {
    try { const data = await api.get<any[]>('/api/clients'); setClients(Array.isArray(data) ? data : []); } catch {}
  };

  const fetchDetail = async (id: string) => {
    try {
      const data = await api.get<any>(`/api/projects/${id}`);
      setGallery(data.gallery);
      setRounds(data.rounds || []);
    } catch {}
  };

  useEffect(() => { fetchProjects(); fetchClients(); }, [token]);

  useEffect(() => {
    if (selectedId) fetchDetail(selectedId);
    else { setGallery(null); setRounds([]); }
  }, [selectedId, token]);

  // ── Create project ──
  const handleCreate = async () => {
    if (!form.title || !form.clientId) { toast('请填写项目名称并选择客户', 'error'); return; }
    try {
      await api.post('/api/projects', form);
      toast('项目创建成功', 'success');
      setShowCreate(false);
      setForm({ clientId: '', title: '', shootType: 'wedding', shootDate: '', deliveryDueDate: '', packageType: 'Standard', proposalId: '' });
      fetchProjects();
    } catch (e: any) { toast(e.message, 'error'); }
  };

  // ── Desktop: folder picker + drag-drop upload ──
  const handleDesktopUpload = useCallback(async (projectId: string) => {
    try {
      const files = await selectFolder();
      if (files.length === 0) { toast('未选择文件', 'info'); return; }
      setDesktopUploading(true);
      const result = await uploadPhotosDesktop(
        projectId,
        files.map(f => f.path),
        window.location.origin,
        token!,
        (e) => setUploadProgress(e),
      );
      toast(`已上传 ${result.added}/${result.total} 张照片`, 'success');
      if (result.errors.length > 0) {
        toast(`${result.errors.length} 个文件失败`, 'error');
      }
      setUploadProgress(null);
      setDesktopUploading(false);
      fetchDetail(projectId);
      fetchProjects();
    } catch (e: any) {
      toast(e.message || '上传失败', 'error');
      setDesktopUploading(false);
    }
  }, [token]);

  const handleDesktopDeliveryUpload = useCallback(async (projectId: string) => {
    try {
      const files = await selectFolder();
      if (files.length === 0) { toast('未选择文件', 'info'); return; }
      setDesktopUploading(true);
      const result = await uploadDeliveryDesktop(
        projectId,
        files.map(f => f.path),
        window.location.origin,
        token!,
        (e) => setUploadProgress(e),
      );
      toast(`已交付 ${result.added}/${result.total} 张精修`, 'success');
      setUploadProgress(null);
      setDesktopUploading(false);
      fetchDetail(projectId);
      fetchProjects();
    } catch (e: any) {
      toast(e.message || '交付上传失败', 'error');
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
      toast(`已上传 ${data.added} 张照片`, 'success');
      fetchDetail(projectId);
      fetchProjects();
    } catch (e: any) { toast(e.message, 'error'); }
  };

  // ── Send gallery to client ──
  const handleSendGallery = async (projectId: string) => {
    const deadline = prompt('选片截止日期（默认7天后，留空使用默认）:');
    try {
      const data = await api.patch<{ shareToken: string; shareUrl: string }>(`/api/projects/${projectId}/gallery/send`, {
        selectionDeadline: deadline || undefined,
      });
      const fullUrl = `${window.location.origin}/sage/portal/selection/${data.shareToken}`;
      navigator.clipboard?.writeText(fullUrl).then(() => toast('选片链接已复制到剪贴板', 'success'));
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
      toast(`已交付 Round ${data.roundNumber}（${data.added} 张精修）`, 'success');
      fetchDetail(projectId);
      fetchProjects();
    } catch (e: any) { toast(e.message, 'error'); }
  };

  // ── Advance status ──
  const handleAdvance = async (projectId: string, to: string) => {
    try {
      await api.post(`/api/projects/${projectId}/advance`, { to });
      toast(`状态已更新`, 'success');
      fetchDetail(projectId);
      fetchProjects();
    } catch (e: any) { toast(e.message, 'error'); }
  };

  // ── Delete photo from gallery ──
  const handleDeletePhoto = async (projectId: string, photoId: string) => {
    try {
      await api.del(`/api/projects/${projectId}/gallery/photos/${photoId}`);
      toast('已删除', 'info');
      fetchDetail(projectId);
    } catch (e: any) { toast(e.message, 'error'); }
  };

  const selectedProject = projects.find(p => p.id === selectedId);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#86868B' }}>加载中…</div>;

  // ── Detail View ──
  if (selectedProject) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button onClick={() => setSelectedId(null)} style={btnGhost}>← 返回</button>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{selectedProject.title}</h2>
          <span style={{ ...statusBadge(selectedProject.status) }}>{STATUS_LABELS[selectedProject.status] || selectedProject.status}</span>
        </div>

        {/* Project info bar */}
        <div style={card}>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 14 }}>
            <span>👤 {selectedProject.client_name}</span>
            <span>📷 {SHOOT_LABELS[selectedProject.shoot_type] || selectedProject.shoot_type}</span>
            <span>📅 {selectedProject.shoot_date || '未定'}</span>
            <span>📦 {PACKAGE_LABELS[selectedProject.package_type] || selectedProject.package_type}（{selectedProject.max_retouch_count}张精修/{selectedProject.max_revision_rounds}轮修改）</span>
            <span>🔄 Round {selectedProject.current_round}/{selectedProject.max_revision_rounds}</span>
          </div>
          {/* Status actions */}
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            {selectedProject.status === 'draft' && (
              <button onClick={() => handleAdvance(selectedProject.id, 'selection')} style={btnPrimary} disabled={!selectedProject.gallery_id}>📤 上传样片后发送选片链接</button>
            )}
            {selectedProject.status === 'selection' && (
              <button onClick={() => handleAdvance(selectedProject.id, 'editing')} style={btnPrimary} disabled={selectedProject.selectedCount === 0}>✂️ 确认选片，开始精修</button>
            )}
            {selectedProject.status === 'editing' && (
              <button onClick={() => {
                if (platform.isDesktop()) { handleDeliver(selectedProject.id); }
                else { editFileInputRef.current?.click(); }
              }} style={btnPrimary} disabled={desktopUploading}>
                {desktopUploading ? '⏳ 上传中...' : '📤 上传精修交付'}
              </button>
            )}
            {selectedProject.status === 'review' && selectedProject.current_round < selectedProject.max_revision_rounds && (
              rounds.some(r => r.status === 'revision_requested')
                ? <button onClick={() => handleAdvance(selectedProject.id, 'editing')} style={btnWarn}>🔙 客户要求修改，回到精修</button>
                : <button onClick={() => handleAdvance(selectedProject.id, 'editing')} style={btnPrimary}>📤 上传下一轮精修 (Round {selectedProject.current_round + 1})</button>
            )}
            {(selectedProject.status === 'review' && selectedProject.current_round >= selectedProject.max_revision_rounds) && (
              <button onClick={() => handleAdvance(selectedProject.id, 'completed')} style={btnSuccess}>✅ 标记完成</button>
            )}
            {!['completed', 'cancelled'].includes(selectedProject.status) && (
              <button onClick={async () => { if (confirm('确定取消此项目？')) { await api.post(`/api/projects/${selectedProject.id}/cancel`); fetchDetail(selectedProject.id); fetchProjects(); } }} style={btnDanger}>取消项目</button>
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
              {tab === 'gallery' ? `🖼 样片库` : `📦 交付记录 (${rounds.length})`}
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
                    共 {gallery.photos.length} 张样片 | 已选 {gallery.selectedIds.length} 张 | 状态: {gallery.selection_status}
                    {gallery.share_token && <span style={{ marginLeft: 12, color: '#007AFF', cursor: 'pointer' }}
                      onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/sage/portal/selection/${gallery.share_token}`).then(() => toast('链接已复制', 'info')); }}>
                      📋 复制选片链接</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {platform.isDesktop()
                      ? <button onClick={() => handleDesktopUpload(selectedProject.id)} style={btnPrimary} disabled={desktopUploading}>
                          {desktopUploading ? '⏳ 上传中...' : '📁 选择文件夹上传'}
                        </button>
                      : <button onClick={() => fileInputRef.current?.click()} style={btnPrimary}>📤 上传样片</button>
                    }
                    {gallery.photos.length > 0 && gallery.selection_status !== 'selection_done' && (
                      <button onClick={() => handleSendGallery(selectedProject.id)} style={btnSuccess}>📤 发送选片链接</button>
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
                      {isDragging ? '松开以上传' : '拖拽文件夹到此处 或 点击选择文件夹'}
                    </div>
                    <div style={{ fontSize: 12, color: '#86868B', marginTop: 4 }}>
                      支持 JPG/PNG/WebP/TIFF/RAW 格式，自动生成缩略图
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
                  <div style={{ textAlign: 'center', padding: 40, color: '#86868B' }}>暂无样片，点击"上传样片"开始</div>
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
                          {isSelected && <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: '#007AFF', color: '#fff', fontSize: 11, padding: '2px 6px', textAlign: 'center' }}>已选</div>}
                          <div style={{ fontSize: 10, padding: 4, color: '#86868B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{photo.originalName}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: 40, color: '#86868B' }}>
                样片库尚未初始化
                <br /><button onClick={() => fileInputRef.current?.click()} style={{ ...btnPrimary, marginTop: 12 }}>📤 上传第一批样片</button>
              </div>
            )}
          </div>
        )}

        {/* Deliveries Tab */}
        {detailTab === 'deliveries' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {rounds.length === 0 ? (
              <div style={{ ...card, textAlign: 'center', color: '#86868B', padding: 40 }}>暂无交付记录。选片完成后即可上传精修照片。</div>
            ) : (
              rounds.map(round => (
                <div key={round.id} style={card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h4 style={{ margin: 0, fontSize: 16 }}>Round {round.round_number} — {round.status === 'pending_review' ? '⏳ 等待审核' : round.status === 'accepted' ? '✅ 已接受' : round.status === 'revision_requested' ? '🔄 客户要求修改' : round.status}</h4>
                    {round.share_token && (
                      <span style={{ fontSize: 12, color: '#007AFF', cursor: 'pointer' }}
                        onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/sage/portal/review/${round.share_token}`).then(() => toast('审核链接已复制', 'info')); }}>
                        📋 复制审核链接</span>
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
                      💬 客户反馈：{round.client_feedback}
                    </div>
                  )}
                  {round.revisions && round.revisions.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>修改请求：</div>
                      {round.revisions.map((rev: any) => (
                        <div key={rev.id} style={{ padding: '8px 12px', background: rev.status === 'done' ? '#F0FFF0' : rev.status === 'declined' ? '#FFF0F0' : '#FFF8E1', borderRadius: 6, marginBottom: 6, fontSize: 13 }}>
                          <div>📷 照片 {rev.photo_id.slice(0, 8)}… — {rev.revision_type} — <b>{rev.status}</b></div>
                          <div style={{ color: '#86868B' }}>{rev.description}</div>
                          {rev.photographer_note && <div style={{ color: '#FF9500' }}>摄影师回复：{rev.photographer_note}</div>}
                          {rev.status === 'pending' && (
                            <div style={{ marginTop: 4, display: 'flex', gap: 6 }}>
                              <button onClick={async () => { await api.patch(`/api/projects/revisions/${rev.id}`, { status: 'done' }); fetchDetail(selectedProject.id); }} style={{ ...btnPrimary, fontSize: 11, padding: '2px 10px' }}>完成</button>
                              <button onClick={async () => {
                                const note = prompt('拒绝理由（必填）：'); if (!note) return;
                                await api.patch(`/api/projects/revisions/${rev.id}`, { status: 'declined', photographerNote: note });
                                fetchDetail(selectedProject.id);
                              }} style={{ ...btnDanger, fontSize: 11, padding: '2px 10px' }}>拒绝</button>
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
          <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.5px', margin: 0 }}>🎬 项目</h2>
          <p style={{ fontSize: 14, color: '#86868B', margin: '4px 0 0' }}>选片 → 精修 → 交付</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} style={btnPrimary}>
          {showCreate ? '取消' : '+ 新建项目'}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div style={card}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={label}>客户 *</label>
              <select value={form.clientId} onChange={e => setForm({ ...form, clientId: e.target.value })} style={input}>
                <option value="">选择客户…</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name} ({c.email})</option>)}
              </select>
            </div>
            <div>
              <label style={label}>项目名称 *</label>
              <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="如：Sarah & Mike 婚礼" style={input} />
            </div>
            <div>
              <label style={label}>拍摄类型</label>
              <select value={form.shootType} onChange={e => setForm({ ...form, shootType: e.target.value })} style={input}>
                {SHOOT_TYPES.map(t => <option key={t} value={t}>{SHOOT_LABELS[t]} ({t})</option>)}
              </select>
            </div>
            <div>
              <label style={label}>套餐</label>
              <select value={form.packageType} onChange={e => setForm({ ...form, packageType: e.target.value })} style={input}>
                {Object.entries(PACKAGE_LABELS).map(([k, v]) => <option key={k} value={k}>{v} ({k})</option>)}
              </select>
            </div>
            <div>
              <label style={label}>拍摄日期</label>
              <input type="date" value={form.shootDate} onChange={e => setForm({ ...form, shootDate: e.target.value })} style={input} />
            </div>
            <div>
              <label style={label}>交付截止日</label>
              <input type="date" value={form.deliveryDueDate} onChange={e => setForm({ ...form, deliveryDueDate: e.target.value })} style={input} />
            </div>
          </div>
          <button onClick={handleCreate} style={{ ...btnPrimary, marginTop: 12 }}>创建项目</button>
        </div>
      )}

      {/* Project list */}
      {projects.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', padding: 60, color: '#86868B' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎬</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>还没有项目</div>
          <div>创建你的第一个拍摄项目，开始选片→精修→交付流程</div>
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
                    <span style={{ ...statusBadge(p.status) }}>{STATUS_LABELS[p.status] || p.status}</span>
                  </div>
                  <div style={{ fontSize: 13, color: '#86868B', marginTop: 4 }}>
                    👤 {p.client_name} · 📷 {SHOOT_LABELS[p.shoot_type] || p.shoot_type} · 📦 {PACKAGE_LABELS[p.package_type] || p.package_type}
                    {p.gallery_total > 0 && ` · 🖼 ${p.gallery_total}张样片`}
                    {p.selectedCount > 0 && ` · ✅ 已选${p.selectedCount}张`}
                    {p.round_count > 0 && ` · 📦 ${p.round_count}轮交付`}
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
