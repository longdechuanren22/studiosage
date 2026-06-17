import { Router, type Router as RouterType } from 'express';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import multer from 'multer';
import sharp from 'sharp';
import { initDb } from '../db/schema.js';
import { queryAll, queryOne, run } from '../db/query.js';
import { uploadToR2, deleteFromR2, getPublicUrl, isR2Enabled } from '../utils/storage.js';

const router: RouterType = Router();

// ── Multer setup ──
const UPLOADS_ROOT = path.join(process.cwd(), 'data', 'uploads');

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function getUploadDir(userId: string, projectId: string) {
  const dir = path.join(UPLOADS_ROOT, userId, projectId);
  ensureDir(path.join(dir, 'originals'));
  ensureDir(path.join(dir, 'thumbnails'));
  return dir;
}

function getEditedDir(userId: string, projectId: string, round: number) {
  const dir = path.join(UPLOADS_ROOT, userId, projectId, 'edited', `round_${round}`);
  ensureDir(dir);
  return dir;
}

// ── Get gallery ──
router.get('/:id/gallery', async (req, res) => {
  await initDb();
  const userId = req.userId!;
  const project = queryOne('SELECT id FROM projects WHERE id = ? AND user_id = ?', [req.params.id, userId]);
  if (!project) return res.status(404).json({ error: '项目不存在' });

  let gallery = queryOne('SELECT * FROM project_galleries WHERE project_id = ?', [req.params.id]) as any;
  if (!gallery) {
    // Auto-create gallery on first access
    const id = randomUUID();
    run(
      `INSERT INTO project_galleries (id, project_id, user_id) VALUES (?, ?, ?)`,
      [id, req.params.id, userId]
    );
    gallery = queryOne('SELECT * FROM project_galleries WHERE id = ?', [id]) as any;
  }

  res.json({
    ...gallery,
    photos: JSON.parse(gallery.photos || '[]'),
    selectedIds: JSON.parse(gallery.selected_ids || '[]'),
    rejectedIds: JSON.parse(gallery.rejected_ids || '[]'),
    favoriteIds: JSON.parse(gallery.favorite_ids || '[]'),
  });
});

// ── Upload photos to gallery ──
router.post('/:id/gallery/photos', async (req, res) => {
  await initDb();
  const userId = req.userId!;
  const project = queryOne('SELECT id FROM projects WHERE id = ? AND user_id = ?', [req.params.id, userId]);
  if (!project) return res.status(404).json({ error: '项目不存在' });

  // Ensure gallery exists
  let gallery = queryOne('SELECT * FROM project_galleries WHERE project_id = ?', [req.params.id]) as any;
  if (!gallery) {
    const gid = randomUUID();
    run('INSERT INTO project_galleries (id, project_id, user_id) VALUES (?, ?, ?)', [gid, req.params.id, userId]);
    gallery = queryOne('SELECT * FROM project_galleries WHERE id = ?', [gid]) as any;
  }

  const uploadDir = getUploadDir(userId, req.params.id);

  // Configure multer for this upload
  const storage = multer.diskStorage({
    destination: path.join(uploadDir, 'originals'),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${randomUUID()}${ext}`);
    },
  });

  const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB per file
    fileFilter: (_req, file, cb) => {
      const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.tiff', '.tif', '.heic', '.heif'];
      const ext = path.extname(file.originalname).toLowerCase();
      if (allowed.includes(ext)) {
        cb(null, true);
      } else {
        cb(new Error(`不支持的文件类型: ${ext}`));
      }
    },
  }).array('photos', 100); // max 100 per batch

  upload(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) return res.status(400).json({ error: '未选择文件' });

    const existingPhotos: any[] = JSON.parse(gallery.photos || '[]');
    const startOrder = existingPhotos.length;

    // Generate thumbnails
    const newPhotos: any[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const thumbFilename = `thumb_${file.filename}`;
      const thumbPath = path.join(uploadDir, 'thumbnails', thumbFilename);

      // Generate thumbnail
      let thumbBuffer: Buffer;
      try {
        thumbBuffer = await sharp(file.path)
          .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toBuffer();
      } catch (e) {
        thumbBuffer = fs.readFileSync(file.path);
      }

      // Upload original to R2 (or local fallback)
      const originKey = `${userId}/${req.params.id}/originals/${file.filename}`;
      const thumbKey = `${userId}/${req.params.id}/thumbnails/${thumbFilename}`;
      const originUrl = await uploadToR2(originKey, fs.readFileSync(file.path), `image/${path.extname(file.filename).replace('.', '')}`);
      const thumbUrl = await uploadToR2(thumbKey, thumbBuffer, 'image/jpeg');

      // Clean up local temp if R2 is enabled
      if (isR2Enabled()) {
        try { fs.unlinkSync(file.path); } catch {}
      }

      newPhotos.push({
        id: randomUUID(),
        filename: file.originalname,
        originalName: file.originalname,
        url: originUrl,
        thumbnailUrl: thumbUrl,
        order: startOrder + i + 1,
        size: file.size,
        uploadedAt: new Date().toISOString(),
      });
    }

    const allPhotos = [...existingPhotos, ...newPhotos];
    run(
      `UPDATE project_galleries SET photos=?, total_count=?, selection_status='uploading', updated_at=datetime('now') WHERE id=?`,
      [JSON.stringify(allPhotos), allPhotos.length, gallery.id]
    );

    res.status(201).json({ added: newPhotos.length, total: allPhotos.length, photos: newPhotos });
  });
});

// ── Delete a photo from gallery ──
router.delete('/:id/gallery/photos/:photoId', async (req, res) => {
  await initDb();
  const userId = req.userId!;
  const project = queryOne('SELECT id FROM projects WHERE id = ? AND user_id = ?', [req.params.id, userId]);
  if (!project) return res.status(404).json({ error: '项目不存在' });

  const gallery = queryOne('SELECT * FROM project_galleries WHERE project_id = ?', [req.params.id]) as any;
  if (!gallery) return res.status(404).json({ error: '样片库不存在' });

  const photos: any[] = JSON.parse(gallery.photos || '[]');
  const photoIdx = photos.findIndex((p: any) => p.id === req.params.photoId);
  if (photoIdx === -1) return res.status(404).json({ error: '照片不存在' });

  // Delete files from R2 or local disk
  const photo = photos[photoIdx];
  const urlToKey = (url: string) => url.replace(/^\/uploads\//, '').replace(/^https?:\/\/[^/]+\//, '');
  deleteFromR2(urlToKey(photo.url));
  deleteFromR2(urlToKey(photo.thumbnailUrl));

  photos.splice(photoIdx, 1);
  // Re-order remaining
  photos.forEach((p: any, i: number) => { p.order = i + 1; });

  // Also remove from selected/rejected/favorite
  const selected = JSON.parse(gallery.selected_ids || '[]').filter((id: string) => id !== req.params.photoId);
  const rejected = JSON.parse(gallery.rejected_ids || '[]').filter((id: string) => id !== req.params.photoId);
  const favorite = JSON.parse(gallery.favorite_ids || '[]').filter((id: string) => id !== req.params.photoId);

  run(
    `UPDATE project_galleries SET photos=?, total_count=?, selected_ids=?, rejected_ids=?, favorite_ids=?, updated_at=datetime('now') WHERE id=?`,
    [JSON.stringify(photos), photos.length, JSON.stringify(selected), JSON.stringify(rejected), JSON.stringify(favorite), gallery.id]
  );

  res.json({ ok: true, total: photos.length });
});

// ── Finalize gallery & send to client ──
router.patch('/:id/gallery/send', async (req, res) => {
  await initDb();
  const userId = req.userId!;
  const project = queryOne('SELECT id, title, client_id, status FROM projects WHERE id = ? AND user_id = ?', [req.params.id, userId]) as any;
  if (!project) return res.status(404).json({ error: '项目不存在' });

  const gallery = queryOne('SELECT * FROM project_galleries WHERE project_id = ?', [req.params.id]) as any;
  if (!gallery) return res.status(404).json({ error: '样片库不存在' });

  const photos = JSON.parse(gallery.photos || '[]');
  if (photos.length === 0) return res.status(400).json({ error: '请先上传样片' });

  const { selectionDeadline } = req.body;
  const deadline = selectionDeadline || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  // Generate share token if not exists
  let shareToken = gallery.share_token;
  if (!shareToken) {
    shareToken = randomUUID().replace(/-/g, '');
  }

  run(
    `UPDATE project_galleries SET share_token=?, selection_deadline=?, selection_status='awaiting_selection', updated_at=datetime('now') WHERE id=?`,
    [shareToken, deadline, gallery.id]
  );

  // Update project status to selection if still draft
  if (project.status === 'draft') {
    run("UPDATE projects SET status='selection', updated_at=datetime('now') WHERE id=?", [project.id]);
  }

  const shareUrl = `/portal/selection/${shareToken}`;

  res.json({
    shareToken,
    shareUrl,
    selectionDeadline: deadline,
    photoCount: photos.length,
  });
});

// ── List delivery rounds ──
router.get('/:id/deliveries', async (req, res) => {
  await initDb();
  const userId = req.userId!;
  const project = queryOne('SELECT id FROM projects WHERE id = ? AND user_id = ?', [req.params.id, userId]);
  if (!project) return res.status(404).json({ error: '项目不存在' });

  const rounds = queryAll(
    `SELECT d.*, (SELECT COUNT(*) FROM revision_requests WHERE round_id = d.id) as revision_count
     FROM delivery_rounds d WHERE d.project_id = ? ORDER BY d.round_number ASC`,
    [req.params.id]
  );

  res.json(rounds.map((r: any) => ({
    ...r,
    deliveredPhotos: JSON.parse(r.delivered_photos || '[]'),
    revisions: queryAll('SELECT * FROM revision_requests WHERE round_id = ?', [r.id]),
  })));
});

// ── Create delivery round (upload edited photos) ──
router.post('/:id/deliveries', async (req, res) => {
  await initDb();
  const userId = req.userId!;
  const project = queryOne('SELECT id, current_round, max_revision_rounds, client_id, status FROM projects WHERE id = ? AND user_id = ?', [req.params.id, userId]) as any;
  if (!project) return res.status(404).json({ error: '项目不存在' });
  if (project.status === 'completed' || project.status === 'cancelled') {
    return res.status(400).json({ error: '项目已完成或已取消，无法上传' });
  }

  // Check if we're revising an existing round (review → editing) or creating a new round
  const existingPending = queryOne(
    "SELECT * FROM delivery_rounds WHERE project_id = ? AND status = 'revision_requested' ORDER BY round_number DESC LIMIT 1",
    [project.id]
  ) as any;

  let roundNumber: number;
  let roundId: string;

  if (existingPending) {
    // Re-delivering the same round after revisions — mark pending revisions as done
    roundNumber = existingPending.round_number;
    roundId = existingPending.id;
    run("UPDATE revision_requests SET status='done', updated_at=datetime('now') WHERE round_id = ? AND status = 'pending'", [roundId]);
  } else {
    // New round
    roundNumber = (project.current_round || 0) + 1;

    if (roundNumber > project.max_revision_rounds) {
      return res.status(400).json({
        error: `修改轮次已用完（${project.max_revision_rounds}轮），请引导客户追加付费`,
        maxRounds: project.max_revision_rounds,
      });
    }

    roundId = randomUUID();
    const shareToken = randomUUID().replace(/-/g, '');
    run(
      `INSERT INTO delivery_rounds (id, project_id, user_id, round_number, share_token, review_deadline)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [roundId, project.id, userId, roundNumber, shareToken,
       new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()]
    );
    run('UPDATE projects SET current_round=?, updated_at=datetime(\'now\') WHERE id=?', [roundNumber, project.id]);
  }

  // Configure multer for edited photos
  const editedDir = getEditedDir(userId, req.params.id, roundNumber);

  const storage = multer.diskStorage({
    destination: editedDir,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${randomUUID()}${ext}`);
    },
  });

  const upload = multer({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.tiff', '.tif'];
      if (allowed.includes(path.extname(file.originalname).toLowerCase())) {
        cb(null, true);
      } else {
        cb(new Error(`不支持的文件类型`));
      }
    },
  }).array('photos', 200);

  upload(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) return res.status(400).json({ error: '未选择文件' });

    const round = queryOne('SELECT * FROM delivery_rounds WHERE id = ?', [roundId]) as any;
    const existingPhotos = JSON.parse(round.delivered_photos || '[]');

    const newPhotos = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const editKey = `${userId}/${req.params.id}/edited/round_${roundNumber}/${file.filename}`;
      const editUrl = await uploadToR2(editKey, fs.readFileSync(file.path), 'image/jpeg');
      if (isR2Enabled()) { try { fs.unlinkSync(file.path); } catch {} }
      newPhotos.push({
        id: randomUUID(),
        filename: file.originalname,
        url: editUrl,
        order: existingPhotos.length + i + 1,
        size: file.size,
      });
    }

    const allPhotos = [...existingPhotos, ...newPhotos];
    const reviewDeadline = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

    run(
      `UPDATE delivery_rounds SET delivered_photos=?, status='pending_review', review_deadline=?, updated_at=datetime('now') WHERE id=?`,
      [JSON.stringify(allPhotos), reviewDeadline, roundId]
    );

    // Update project status to review
    run("UPDATE projects SET status='review', updated_at=datetime('now') WHERE id=?", [project.id]);

    res.status(201).json({
      roundId,
      roundNumber,
      added: newPhotos.length,
      total: allPhotos.length,
      reviewDeadline,
    });
  });
});

// ── Photographer responds to revision request ──
router.patch('/revisions/:id', async (req, res) => {
  await initDb();
  const userId = req.userId!;

  const revision = queryOne(
    `SELECT r.*, d.project_id, d.user_id as round_user_id
     FROM revision_requests r JOIN delivery_rounds d ON r.round_id = d.id
     WHERE r.id = ?`,
    [req.params.id]
  ) as any;

  if (!revision) return res.status(404).json({ error: '修改请求不存在' });
  if (revision.round_user_id !== userId) return res.status(403).json({ error: '无权操作' });

  const { status, photographerNote } = req.body;

  if (status === 'declined' && !photographerNote) {
    return res.status(400).json({ error: '拒绝修改请求需要填写理由' });
  }

  run(
    `UPDATE revision_requests SET status=?, photographer_note=?, updated_at=datetime('now') WHERE id=?`,
    [status || 'done', photographerNote || '', req.params.id]
  );

  res.json({ ok: true });
});

export { router as galleryDeliveryRoutes };
