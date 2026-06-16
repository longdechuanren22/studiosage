import { Router, type Router as RouterType } from 'express';
import { PixiesetAdapter } from '../adapters/pixieset.js';
import { initDb } from '../db/schema.js';
import { queryAll } from '../db/query.js';

const router: RouterType = Router();

// List all Pixieset galleries
router.get('/', async (_req, res) => {
  const key = process.env.PIXIESET_API_KEY;
  if (!key) return res.json({ ok: true, galleries: [], configured: false });

  try {
    const pixieset = new PixiesetAdapter(key);
    const galleries = await pixieset.getGalleries();
    res.json({ ok: true, galleries, configured: true });
  } catch (err) {
    res.json({ ok: true, galleries: [], configured: true, error: (err as Error).message });
  }
});

// Get galleries linked to a specific client
router.get('/client/:clientId', async (req, res) => {
  await initDb();
  const userId = req.userId!;
  const { clientId } = req.params;

  // Get client's pixieset_gallery_id
  const client = queryAll(
    'SELECT pixieset_gallery_id FROM clients WHERE id = ? AND user_id = ?',
    [clientId, userId]
  ) as any[];

  if (!client.length || !client[0].pixieset_gallery_id) {
    return res.json({ ok: true, galleries: [] });
  }

  const key = process.env.PIXIESET_API_KEY;
  if (!key) return res.json({ ok: true, galleries: [], configured: false });

  try {
    const pixieset = new PixiesetAdapter(key);
    const gallery = await pixieset.getGallery(client[0].pixieset_gallery_id);
    res.json({ ok: true, galleries: [gallery], configured: true });
  } catch (err) {
    res.json({ ok: true, galleries: [], configured: true, error: (err as Error).message });
  }
});

// Link a Pixieset gallery to a client
router.post('/link', async (req, res) => {
  await initDb();
  const userId = req.userId!;
  const { clientId, galleryId } = req.body;
  if (!clientId || !galleryId) return res.status(400).json({ ok: false, error: 'clientId and galleryId required' });

  const { run } = await import('../db/query.js');
  run('UPDATE clients SET pixieset_gallery_id = ?, updated_at = datetime(\'now\') WHERE id = ? AND user_id = ?',
    [galleryId, clientId, userId]);
  res.json({ ok: true });
});

export { router as galleryRoutes };
