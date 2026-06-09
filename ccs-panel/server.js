// CC Switch Web Panel — lightweight Express API + static page
const express = require('express');
const { execSync } = require('child_process');
const { readFileSync, writeFileSync, existsSync, mkdirSync } = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

const CONFIG_PATH = process.env.HOME + '/.config/ccs/config.json';

function ensureConfig() {
  const dir = path.dirname(CONFIG_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  if (!existsSync(CONFIG_PATH)) writeFileSync(CONFIG_PATH, JSON.stringify({ current: '', providers: {} }));
}

// Get all providers
app.get('/api/providers', (req, res) => {
  ensureConfig();
  const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
  res.json({ current: config.current, providers: Object.keys(config.providers) });
});

// Add/update a provider
app.post('/api/providers', (req, res) => {
  const { name, url, key, model } = req.body;
  if (!name) return res.status(400).json({ error: 'Provider name required' });
  ensureConfig();
  const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
  config.providers[name] = { url: url || 'https://api.deepseek.com/v1', key, model: model || 'deepseek-chat' };
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  res.json({ ok: true, providers: Object.keys(config.providers) });
});

// Switch provider
app.post('/api/switch', (req, res) => {
  const { provider } = req.body;
  ensureConfig();
  const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
  if (!config.providers[provider]) return res.status(404).json({ error: 'Provider not found' });
  config.current = provider;
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  // Apply to Claude Code env
  const p = config.providers[provider];
  const envContent = `ANTHROPIC_API_KEY=${p.key}\nANTHROPIC_BASE_URL=${p.url}\n`;
  writeFileSync(process.env.HOME + '/.claude/.env', envContent);
  res.json({ ok: true, current: provider });
});

// Delete a provider
app.delete('/api/providers/:name', (req, res) => {
  ensureConfig();
  const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
  delete config.providers[req.params.name];
  if (config.current === req.params.name) config.current = '';
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  res.json({ ok: true });
});

// Status check
app.get('/api/status', (req, res) => {
  ensureConfig();
  const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
  res.json({
    current: config.current,
    claudeCode: existsSync(process.env.HOME + '/.claude/.env'),
    cli: existsSync(process.env.HOME + '/.npm-global/bin/ccs') || existsSync('/usr/bin/ccs'),
  });
});

app.listen(3099, () => console.log('CC Switch Panel on http://localhost:3099'));
