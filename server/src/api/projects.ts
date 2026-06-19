import { Router, type Router as RouterType } from 'express';
import { randomUUID } from 'node:crypto';
import { initDb } from '../db/schema.js';
import { queryAll, queryOne, run } from '../db/query.js';
import { checkProjectLimit } from '../middleware/paywall.js';

async function emitProjectUpdate(userId: string, projectId: string, status: string) {
  try {
    const { notifyProjectUpdated } = await import('../utils/events.js');
    notifyProjectUpdated(userId, projectId, status);
  } catch {}
}

const router: RouterType = Router();

// Package presets → 精修上限 + 修改轮次上限
const PACKAGE_DEFAULTS: Record<string, { retouch: number; revisions: number }> = {
  Premium: { retouch: 60, revisions: 3 },
  Standard: { retouch: 30, revisions: 2 },
  Basic: { retouch: 10, revisions: 1 },
};

// Valid status transitions
const STATUS_FLOW: Record<string, string[]> = {
  draft: ['selection', 'cancelled'],
  selection: ['editing', 'cancelled'],
  editing: ['review', 'completed', 'cancelled'],
  review: ['editing', 'completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

// ── List projects ──
router.get('/', async (req, res) => {
  await initDb();
  const userId = req.userId!;
  const projects = queryAll(
    `SELECT p.*, c.name as client_name, c.email as client_email,
            g.id as gallery_id, g.selection_status, g.selected_ids, g.total_count as gallery_total,
            (SELECT COUNT(*) FROM delivery_rounds WHERE project_id = p.id) as round_count
     FROM projects p
     LEFT JOIN clients c ON p.client_id = c.id
     LEFT JOIN project_galleries g ON g.project_id = p.id
     WHERE p.user_id = ?
     ORDER BY p.updated_at DESC LIMIT 30`,
    [userId]
  );
  // Parse JSON fields
  const parsed = projects.map((p: any) => ({
    ...p,
    selectedCount: p.selected_ids ? JSON.parse(p.selected_ids).length : 0,
    selected_ids: undefined,
  }));
  res.json(parsed);
});

// ── Get single project (full detail) ──
router.get('/:id', async (req, res) => {
  await initDb();
  const userId = req.userId!;
  const project = queryOne(
    `SELECT p.*, c.name as client_name, c.email as client_email, c.phone, c.wechat_id
     FROM projects p LEFT JOIN clients c ON p.client_id = c.id
     WHERE p.id = ? AND p.user_id = ?`,
    [req.params.id, userId]
  );
  if (!project) return res.status(404).json({ error: '项目不存在' });

  const p = project as any;

  // Get gallery
  const gallery = queryOne('SELECT * FROM project_galleries WHERE project_id = ?', [p.id]) as any;

  // Get delivery rounds with revision counts
  const rounds = queryAll(
    `SELECT d.*, (SELECT COUNT(*) FROM revision_requests WHERE round_id = d.id) as revision_count
     FROM delivery_rounds d WHERE d.project_id = ? ORDER BY d.round_number ASC`,
    [p.id]
  );

  // Get linked proposal if exists (table may not exist after cleanup)
  let proposal = null;
  if (p.proposal_id) {
    try {
      proposal = queryOne(
        `SELECT id, title, packages, pricing, status FROM proposals WHERE id = ? AND user_id = ?`,
        [p.proposal_id, userId]
      );
    } catch { /* proposals table removed */ }
  }

  res.json({
    ...p,
    gallery: gallery ? {
      ...gallery,
      photos: JSON.parse(gallery.photos || '[]'),
      selectedIds: JSON.parse(gallery.selected_ids || '[]'),
      rejectedIds: JSON.parse(gallery.rejected_ids || '[]'),
      favoriteIds: JSON.parse(gallery.favorite_ids || '[]'),
    } : null,
    rounds: rounds.map((r: any) => ({
      ...r,
      deliveredPhotos: JSON.parse(r.delivered_photos || '[]'),
    })),
    proposal,
  });
});

// ── Create project ──
router.post('/', checkProjectLimit, async (req, res) => {
  await initDb();
  const userId = req.userId!;
  const { clientId, title, shootType, shootDate, deliveryDueDate, packageType, proposalId } = req.body;

  if (!title) return res.status(400).json({ error: '项目名称不能为空' });
  if (!clientId) return res.status(400).json({ error: '请选择客户' });

  // Verify client belongs to user
  const client = queryOne('SELECT id FROM clients WHERE id = ? AND user_id = ?', [clientId, userId]);
  if (!client) return res.status(404).json({ error: '客户不存在' });

  const defaults = PACKAGE_DEFAULTS[packageType] || PACKAGE_DEFAULTS.Standard;

  // If proposalId provided, pull package info from proposal
  let maxRetouch = defaults.retouch;
  let maxRevisions = defaults.revisions;
  if (proposalId) {
    try {
      const proposal = queryOne('SELECT packages FROM proposals WHERE id = ? AND user_id = ?', [proposalId, userId]) as any;
      if (proposal) {
        const packages = JSON.parse(proposal.packages || '[]');
        const selectedPkg = packages.find((pkg: any) => pkg.name === packageType);
        if (selectedPkg?.includes) {
          const includes = selectedPkg.includes.join(' ').toLowerCase();
          const retouchMatch = includes.match(/(\d+)\s*(?:edited|retouched|精修|张)/);
          const revisionMatch = includes.match(/(\d+)\s*(?:round|轮|revision)/);
          if (retouchMatch) maxRetouch = parseInt(retouchMatch[1]);
          if (revisionMatch) maxRevisions = parseInt(revisionMatch[1]);
        }
      }
    } catch { /* proposals table removed — use defaults */ }
  }

  const id = randomUUID();
  run(
    `INSERT INTO projects (id, user_id, client_id, title, shoot_type, shoot_date, delivery_due_date,
      package_type, max_retouch_count, max_revision_rounds, status, proposal_id, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, datetime('now'))`,
    [id, userId, clientId, title, shootType || 'wedding', shootDate || null, deliveryDueDate || null,
     packageType || 'Standard', maxRetouch, maxRevisions, proposalId || null]
  );

  emitProjectUpdate(userId, id, 'draft');
  res.status(201).json({ id });
});

// ── Update project ──
router.patch('/:id', async (req, res) => {
  await initDb();
  const userId = req.userId!;
  const existing = queryOne('SELECT * FROM projects WHERE id = ? AND user_id = ?', [req.params.id, userId]);
  if (!existing) return res.status(404).json({ error: '项目不存在' });

  const e = existing as any;
  const { title, shootType, shootDate, deliveryDueDate, packageType, maxRetouchCount, maxRevisionRounds } = req.body;

  run(
    `UPDATE projects SET title=?, shoot_type=?, shoot_date=?, delivery_due_date=?, package_type=?,
      max_retouch_count=?, max_revision_rounds=?, updated_at=datetime('now') WHERE id=?`,
    [title || e.title, shootType || e.shoot_type, shootDate ?? e.shoot_date,
     deliveryDueDate ?? e.delivery_due_date, packageType || e.package_type,
     maxRetouchCount ?? e.max_retouch_count, maxRevisionRounds ?? e.max_revision_rounds,
     req.params.id]
  );
  res.json({ ok: true });
});

// ── Advance project status ──
router.post('/:id/advance', async (req, res) => {
  await initDb();
  const userId = req.userId!;
  const project = queryOne('SELECT * FROM projects WHERE id = ? AND user_id = ?', [req.params.id, userId]) as any;
  if (!project) return res.status(404).json({ error: '项目不存在' });

  const { to } = req.body;
  const targetStatus = to;
  const allowed = STATUS_FLOW[project.status] || [];

  if (!targetStatus || !allowed.includes(targetStatus)) {
    return res.status(400).json({
      error: `不允许从 ${project.status} 变更到 ${targetStatus}`,
      allowed,
    });
  }

  // Business logic validation
  if (targetStatus === 'selection') {
    const gallery = queryOne('SELECT * FROM project_galleries WHERE project_id = ?', [project.id]) as any;
    if (!gallery || gallery.selection_status === 'uploading') {
      return res.status(400).json({ error: '请先上传样片并发送选片链接' });
    }
  }

  if (targetStatus === 'review') {
    // current_round is managed by delivery POST (uploading creates the round)
    // Here we only allow status change if there's already a delivery round pending review
    const pendingRound = queryOne("SELECT id FROM delivery_rounds WHERE project_id = ? AND status = 'pending_review'", [project.id]);
    if (!pendingRound) {
      return res.status(400).json({ error: '请先上传精修照片' });
    }
    run(
      `UPDATE projects SET status=?, updated_at=datetime('now') WHERE id=?`,
      [targetStatus, project.id]
    );
    emitProjectUpdate(userId, project.id, targetStatus);
    return res.json({ ok: true, status: targetStatus });
  }

  if (targetStatus === 'editing' && project.status === 'review') {
    run(
      `UPDATE projects SET status=?, updated_at=datetime('now') WHERE id=?`,
      [targetStatus, project.id]
    );
    emitProjectUpdate(userId, project.id, targetStatus);
    return res.json({ ok: true, status: targetStatus });
  }

  if (targetStatus === 'completed') {
    // Prevent completion without at least one delivery round (Bug 5)
    const roundCount = queryOne(
      "SELECT COUNT(*) as count FROM delivery_rounds WHERE project_id = ?",
      [project.id]
    ) as any;
    if (!roundCount || roundCount.count === 0) {
      return res.status(400).json({ error: '请先上传至少一轮精修照片' });
    }

    if (project.status === 'editing') {
      run(`UPDATE projects SET status=?, updated_at=datetime('now') WHERE id=?`, [targetStatus, project.id]);
      emitProjectUpdate(userId, project.id, targetStatus);
      return res.json({ ok: true, status: targetStatus });
    }
    if (project.status === 'review' && project.current_round >= project.max_revision_rounds) {
      run(`UPDATE projects SET status=?, updated_at=datetime('now') WHERE id=?`, [targetStatus, project.id]);
      emitProjectUpdate(userId, project.id, targetStatus);
      return res.json({ ok: true, status: targetStatus });
    }
    if (project.status === 'review' && project.current_round < project.max_revision_rounds) {
      return res.status(400).json({
        error: `还有 ${project.max_revision_rounds - project.current_round} 轮修改未完成，不能标记为完成`,
      });
    }
  }

  run(
    `UPDATE projects SET status=?, updated_at=datetime('now') WHERE id=?`,
    [targetStatus, project.id]
  );
  emitProjectUpdate(userId, project.id, targetStatus);
  res.json({ ok: true, status: targetStatus });
});

// ── Cancel project ──
router.post('/:id/cancel', async (req, res) => {
  await initDb();
  const userId = req.userId!;
  const existing = queryOne('SELECT * FROM projects WHERE id = ? AND user_id = ?', [req.params.id, userId]);
  if (!existing) return res.status(404).json({ error: '项目不存在' });

  // Prevent overwriting terminal status (Bug 4)
  const e = existing as any;
  if (e.status === 'completed') {
    return res.status(400).json({ error: '已完成的项目无法取消' });
  }
  if (e.status === 'cancelled') {
    return res.status(400).json({ error: '项目已被取消' });
  }

  run("UPDATE projects SET status='cancelled', updated_at=datetime('now') WHERE id=?", [req.params.id]);
  emitProjectUpdate(userId, req.params.id, 'cancelled');
  res.json({ ok: true });
});

// ── Delete project ──
router.delete('/:id', async (req, res) => {
  await initDb();
  const userId = req.userId!;
  const existing = queryOne('SELECT * FROM projects WHERE id = ? AND user_id = ?', [req.params.id, userId]);
  if (!existing) return res.status(404).json({ error: '项目不存在' });

  const p = existing as any;
  // Clean up gallery + delivery rounds + revision requests
  const rounds = queryAll('SELECT id FROM delivery_rounds WHERE project_id = ?', [p.id]) as any[];
  for (const r of rounds) {
    run('DELETE FROM revision_requests WHERE round_id = ?', [r.id]);
  }
  run('DELETE FROM delivery_rounds WHERE project_id = ?', [p.id]);
  run('DELETE FROM project_galleries WHERE project_id = ?', [p.id]);
  run('DELETE FROM projects WHERE id = ?', [p.id]);

  res.json({ ok: true });
});

export { router as projectRoutes };
