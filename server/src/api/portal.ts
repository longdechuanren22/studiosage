import { Router, type Router as RouterType } from 'express';
import { initDb } from '../db/schema.js';
import { queryAll, queryOne, run } from '../db/query.js';
import { authenticateClient } from '../middleware/clientAuth.js';

const router: RouterType = Router();

// ── Authenticated client routes (via client token) ──

// Get client's own messages
router.get('/messages', authenticateClient, async (req, res) => {
  await initDb();
  const clientId = (req as any).clientId;
  const messages = queryAll(
    'SELECT id, subject, body, status, created_at FROM messages WHERE client_id = ? AND status != ? ORDER BY created_at DESC LIMIT 50',
    [clientId, 'archived']
  );
  res.json(messages);
});

// Client sends a message
router.post('/messages', authenticateClient, async (req, res) => {
  await initDb();
  const clientId = (req as any).clientId;
  const userId = (req as any).clientUserId;
  const { subject, body } = req.body;
  if (!body) return res.status(400).json({ error: '消息内容不能为空' });

  const { randomUUID } = await import('node:crypto');
  run(
    `INSERT INTO messages (id, user_id, client_id, from_address, subject, body, category, status, channel, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'normal', 'pending', 'portal', datetime('now'))`,
    [randomUUID(), userId, clientId, (req as any).clientEmail || '', subject || '', body]
  );
  res.status(201).json({ ok: true });
});

// Get client's invoices
router.get('/invoices', authenticateClient, async (req, res) => {
  await initDb();
  const clientId = (req as any).clientId;
  const invoices = queryAll(
    'SELECT id, amount, currency, description, status, stripe_payment_link, created_at FROM invoices WHERE client_id = ? ORDER BY created_at DESC LIMIT 20',
    [clientId]
  );
  res.json(invoices);
});

// ── 选片 → 客户浏览样片库 ──
router.get('/selection/:shareToken', async (req, res) => {
  await initDb();
  const gallery = queryOne(
    `SELECT g.*, p.title as project_title, p.shoot_type, p.max_retouch_count, p.status as project_status,
            c.name as client_name
     FROM project_galleries g
     JOIN projects p ON g.project_id = p.id
     LEFT JOIN clients c ON p.client_id = c.id
     WHERE g.share_token = ?`,
    [req.params.shareToken]
  ) as any;

  if (!gallery) return res.status(404).json({ error: '选片链接不存在或已失效' });

  // Auto-update status to "in progress" on first view
  if (gallery.selection_status === 'awaiting_selection') {
    run("UPDATE project_galleries SET selection_status='selection_in_progress', updated_at=datetime('now') WHERE share_token=?",
      [req.params.shareToken]);
  }

  const photos = JSON.parse(gallery.photos || '[]');

  // Deadline check + auto-advance: overdue > 3 days → mark as overdue, photographer can substitute
  const now = new Date();
  const deadline = gallery.selection_deadline ? new Date(gallery.selection_deadline) : null;
  const isOverdue = deadline && now > deadline && gallery.selection_status !== 'selection_done';
  const daysOverdue = isOverdue && deadline ? Math.floor((now.getTime() - deadline.getTime()) / (1000 * 60 * 60 * 24)) : 0;

  // Auto-advance: if > 3 days overdue, mark selection_status as 'overdue'
  if (isOverdue && daysOverdue > 3 && gallery.selection_status !== 'overdue') {
    run("UPDATE project_galleries SET selection_status='overdue', updated_at=datetime('now') WHERE share_token=?",
      [req.params.shareToken]);
  }

  res.json({
    projectTitle: gallery.project_title,
    shootType: gallery.shoot_type,
    clientName: gallery.client_name,
    maxRetouch: gallery.max_retouch_count,
    selectionDeadline: gallery.selection_deadline,
    selectionStatus: gallery.selection_status === 'awaiting_selection' ? 'selection_in_progress' : gallery.selection_status,
    selectedIds: JSON.parse(gallery.selected_ids || '[]'),
    rejectedIds: JSON.parse(gallery.rejected_ids || '[]'),
    favoriteIds: JSON.parse(gallery.favorite_ids || '[]'),
    photos,
    isOverdue,
    daysOverdue,
    overdueWarning: isOverdue ? `选片已逾期${daysOverdue}天，请尽快提交以免影响交付排期` : null,
  });
});

// ── 选片 → 客户提交选择结果 ──
router.post('/selection/:shareToken', async (req, res) => {
  await initDb();
  const gallery = queryOne(
    `SELECT g.*, p.max_retouch_count, p.status as project_status
     FROM project_galleries g JOIN projects p ON g.project_id = p.id
     WHERE g.share_token = ?`,
    [req.params.shareToken]
  ) as any;

  if (!gallery) return res.status(404).json({ error: '选片链接不存在' });
  if (gallery.selection_status === 'selection_done') {
    return res.status(400).json({ error: '您已经提交过选片结果，如需修改请联系摄影师' });
  }
  if (gallery.project_status === 'cancelled') {
    return res.status(400).json({ error: '此项目已被取消' });
  }

  const { selectedIds, rejectedIds, favoriteIds } = req.body;

  if (!Array.isArray(selectedIds)) return res.status(400).json({ error: '请选择要精修的照片' });
  if (selectedIds.length === 0) return res.status(400).json({ error: '请至少选择一张照片' });
  if (selectedIds.length > gallery.max_retouch_count) {
    return res.status(400).json({
      error: `您的套餐包含 ${gallery.max_retouch_count} 张精修，您选了 ${selectedIds.length} 张。请减少选择或联系摄影师升级套餐`,
      maxRetouch: gallery.max_retouch_count,
      selected: selectedIds.length,
    });
  }

  run(
    `UPDATE project_galleries SET selected_ids=?, rejected_ids=?, favorite_ids=?, selection_status='selection_done', updated_at=datetime('now') WHERE share_token=?`,
    [JSON.stringify(selectedIds), JSON.stringify(rejectedIds || []), JSON.stringify(favoriteIds || []), req.params.shareToken]
  );

  // Update project status to editing (only if in selection/draft — don't override later states)
  run("UPDATE projects SET status='editing', updated_at=datetime('now') WHERE id=? AND status IN ('selection','draft')", [gallery.project_id]);

  res.json({ ok: true, selectedCount: selectedIds.length, message: '选片提交成功！摄影师将开始精修。' });
});

// ── 审核 → 客户查看交付轮次 ──
router.get('/review/:shareToken', async (req, res) => {
  await initDb();
  const round = queryOne(
    `SELECT d.*, p.title as project_title, p.max_revision_rounds, p.current_round,
            c.name as client_name
     FROM delivery_rounds d
     JOIN projects p ON d.project_id = p.id
     LEFT JOIN clients c ON p.client_id = c.id
     WHERE d.share_token = ?`,
    [req.params.shareToken]
  ) as any;

  if (!round) return res.status(404).json({ error: '审核链接不存在或已失效' });

  const revisions = queryAll('SELECT * FROM revision_requests WHERE round_id = ?', [round.id]);

  // Deadline check + auto-advance: overdue > 3 days → auto-accept
  const now = new Date();
  const reviewDeadline = round.review_deadline ? new Date(round.review_deadline) : null;
  const isOverdue = reviewDeadline && now > reviewDeadline && round.status === 'pending_review';
  const daysOverdue = isOverdue && reviewDeadline ? Math.floor((now.getTime() - reviewDeadline.getTime()) / (1000 * 60 * 60 * 24)) : 0;

  // Auto-accept if > 3 days overdue
  if (isOverdue && daysOverdue > 3) {
    run("UPDATE delivery_rounds SET status='accepted', updated_at=datetime('now') WHERE id=?", [round.id]);
    // Complete project if last round
    if (round.round_number >= round.max_revision_rounds) {
      run("UPDATE projects SET status='completed', updated_at=datetime('now') WHERE id=?", [round.project_id]);
    } else {
      run("UPDATE projects SET status='editing', updated_at=datetime('now') WHERE id=?", [round.project_id]);
    }
    round.status = 'accepted'; // Update in-memory for response
  }

  res.json({
    projectTitle: round.project_title,
    clientName: round.client_name,
    roundNumber: round.round_number,
    maxRevisionRounds: round.max_revision_rounds,
    currentRound: round.current_round,
    reviewDeadline: round.review_deadline,
    status: round.status,
    deliveredPhotos: JSON.parse(round.delivered_photos || '[]'),
    revisions,
    roundsRemaining: round.max_revision_rounds - round.round_number,
    isOverdue,
    daysOverdue,
    overdueWarning: isOverdue ? `审核已逾期${daysOverdue}天，如3天内未反馈将自动视为接受` : null,
  });
});

// ── 审核 → 客户提交反馈 ──
router.post('/review/:shareToken/feedback', async (req, res) => {
  await initDb();
  const round = queryOne(
    `SELECT d.*, p.max_revision_rounds, p.status as project_status
     FROM delivery_rounds d JOIN projects p ON d.project_id = p.id
     WHERE d.share_token = ?`,
    [req.params.shareToken]
  ) as any;

  if (!round) return res.status(404).json({ error: '审核链接不存在' });
  if (round.status === 'accepted') return res.status(400).json({ error: '本轮审核已完成' });

  const { action, revisionRequests, overallFeedback } = req.body;

  // action: 'accept' | 'request_revisions'
  if (action === 'accept') {
    run(
      `UPDATE delivery_rounds SET status='accepted', client_feedback=?, updated_at=datetime('now') WHERE id=?`,
      [overallFeedback || '', round.id]
    );

    // If this was the last round, complete the project + check unpaid invoices
    let paymentReminder: string | null = null;
    if (round.round_number >= round.max_revision_rounds) {
      run("UPDATE projects SET status='completed', updated_at=datetime('now') WHERE id=?", [round.project_id]);

      // 💰 催款闭环：项目完成 → 检测未付尾款 → 自动标记逾期 → 生成催款话术
      const unpaidInvoices = queryAll(
        "SELECT id, amount, currency, payment_schedule, created_at FROM invoices WHERE client_id IN (SELECT client_id FROM projects WHERE id = ?) AND status IN ('sent', 'overdue')",
        [round.project_id]
      ) as any[];

      for (const inv of unpaidInvoices) {
        // Auto-mark as overdue if invoice is older than 7 days
        const daysSince = inv.created_at
          ? Math.floor((Date.now() - new Date(inv.created_at).getTime()) / (1000 * 60 * 60 * 24))
          : 0;
        if (daysSince > 7 && inv.status === 'sent') {
          run("UPDATE invoices SET status='overdue' WHERE id=?", [inv.id]);
        }
      }

      if (unpaidInvoices.length > 0) {
        try {
          const { draftPaymentReminder } = await import('../ai/engine.js');
          const project = queryOne('SELECT title, client_id FROM projects WHERE id = ?', [round.project_id]) as any;
          const client = queryOne('SELECT name FROM clients WHERE id = ?', [project?.client_id]) as any;

          const overdue = unpaidInvoices[0];
          const daysSince = overdue.created_at
            ? Math.floor((Date.now() - new Date(overdue.created_at).getTime()) / (1000 * 60 * 60 * 24))
            : 0;

          paymentReminder = await draftPaymentReminder({
            clientName: client?.name || '客户',
            projectTitle: project?.title || '项目',
            amount: overdue.amount,
            currency: overdue.currency || '¥',
            daysOverdue: daysSince,
            paymentType: overdue.payment_schedule === 'three-phase' ? 'final' : 'final',
          });
        } catch {} // payment reminder is advisory
      }
    } else {
      // More rounds remaining → move project back to editing for photographer to start next round
      run("UPDATE projects SET status='editing', updated_at=datetime('now') WHERE id=?", [round.project_id]);
    }

    return res.json({
      ok: true,
      message: '审核通过！感谢您的确认。',
      paymentReminder,
    });
  }

  if (action === 'request_revisions') {
    if (round.round_number >= round.max_revision_rounds) {
      return res.status(400).json({
        error: `您的套餐包含 ${round.max_revision_rounds} 轮修改，已全部用完。如需继续修改请联系摄影师`,
        maxRounds: round.max_revision_rounds,
      });
    }

    // Get previous rounds' revisions for conflict detection (outer scope — used later)
    let prevRevisions: any[] = [];
    if (Array.isArray(revisionRequests)) {
      prevRevisions = queryAll(
        `SELECT rr.description, rr.revision_type, d.round_number
         FROM revision_requests rr JOIN delivery_rounds d ON rr.round_id = d.id
         WHERE d.project_id = ? AND d.round_number < ?`,
        [round.project_id, round.round_number]
      ) as any[];
    }

    // Save revision requests with AI clarity validation + auto-classification
    if (Array.isArray(revisionRequests)) {
      const { randomUUID } = await import('node:crypto');

      for (const rr of revisionRequests) {
        if (!rr.photoId) continue;
        if (!rr.description || rr.description.trim() === '') {
          return res.status(400).json({ error: '每项修改请求需要填写具体描述' });
        }

        // 🔒 AI 具体性门卫：不具体则拒绝整个提交
        let revisionType = rr.revisionType || 'other';
        try {
          const { validateRevisionClarity } = await import('../ai/engine.js');
          const clarity = await validateRevisionClarity(rr.description);
          if (!clarity.isSpecific) {
            return res.status(400).json({
              error: clarity.rejectionReason || '修改描述不够具体，请补充更多细节',
              rejectedDescription: rr.description,
            });
          }
          // Use AI-suggested type if client didn't specify
          if (!rr.revisionType || rr.revisionType === 'other') {
            revisionType = clarity.suggestedType || 'other';
          }
        } catch {
          // AI unavailable → let it through with basic check
        }

        run(
          `INSERT INTO revision_requests (id, round_id, user_id, photo_id, revision_type, description, annotation)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [randomUUID(), round.id, round.user_id, rr.photoId,
           revisionType, rr.description, rr.annotation || null]
        );
      }
    }

    run(
      `UPDATE delivery_rounds SET status='revision_requested', client_feedback=?, updated_at=datetime('now') WHERE id=?`,
      [overallFeedback || '', round.id]
    );

    // Set project back to editing
    run("UPDATE projects SET status='editing', updated_at=datetime('now') WHERE id=?", [round.project_id]);

    // AI conflict detection — check new revisions against previous rounds
    let conflictWarning = null;
    if (Array.isArray(revisionRequests) && prevRevisions && prevRevisions.length > 0) {
      try {
        const { detectRevisionConflict } = await import('../ai/engine.js');
        for (const rr of revisionRequests) {
          if (!rr.description) continue;
          const result = await detectRevisionConflict(
            prevRevisions.map((p: any) => ({ description: p.description, revisionType: p.revision_type, roundNumber: p.round_number })),
            rr.description,
            rr.revisionType || 'other'
          );
          if (result.hasConflict) {
            conflictWarning = result.description;
            break;
          }
        }
      } catch {} // conflict detection is advisory only, never block submission
    }

    return res.json({
      ok: true,
      message: '修改请求已提交，摄影师将尽快处理。',
      conflictWarning,
    });
  }

  res.status(400).json({ error: '请选择"接受"或"要求修改"' });
});

export { router as portalRoutes };
