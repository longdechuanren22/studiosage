import { Router, type Router as RouterType } from 'express';
import { execSync } from 'node:child_process';

const router: RouterType = Router();

router.post('/', (_req, res) => {
  const token = _req.headers['x-deploy-token'] as string;
  if (token !== (process.env.DEPLOY_TOKEN || 'studiosage-deploy-2026')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const gitResult = execSync('cd /home/ubuntu/studiosage && git pull', { encoding: 'utf8', timeout: 30000 });
    execSync('kill $(lsof -ti:3001) 2>/dev/null; kill $(lsof -ti:3002) 2>/dev/null; sleep 1', { timeout: 5000 });
    execSync('cd /home/ubuntu/studiosage/server && nohup node dist/index.js > /tmp/ss.log 2>&1 &', { timeout: 5000 });
    execSync('cd /home/ubuntu/studiosage/client && nohup http-server dist -p 3002 --silent > /tmp/fe.log 2>&1 &', { timeout: 5000 });
    res.json({ deployed: true, git: gitResult.trim() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export { router as deployRoutes };
