const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'change-me';
const ADMIN_TOKEN = crypto.createHash('sha256').update(ADMIN_PASSWORD).digest('hex');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '..', 'public')));

function isValidUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function requireAdmin(req, res, next) {
  if (req.cookies.admin_token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

app.get('/api/sites', (req, res) => {
  const { category, q } = req.query;
  let sql = `SELECT id, name, url, description, category, source, sort_order, created_at FROM sites WHERE status = 'approved'`;
  const params = [];

  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }

  if (q) {
    sql += ' AND (name LIKE ? OR description LIKE ? OR url LIKE ?)';
    const kw = `%${q}%`;
    params.push(kw, kw, kw);
  }

  sql += ' ORDER BY sort_order ASC, created_at DESC';
  const rows = db.prepare(sql).all(...params);

  res.json({ items: rows });
});

app.get('/api/categories', (_req, res) => {
  const rows = db
    .prepare(`
      SELECT c.id, c.name as category, c.sort_order, COALESCE(COUNT(s.id), 0) as count
      FROM categories c
      LEFT JOIN sites s ON s.category = c.name AND s.status = 'approved'
      WHERE c.is_enabled = 1
      GROUP BY c.id, c.name, c.sort_order
      ORDER BY c.sort_order ASC, c.id ASC
    `)
    .all();
  res.json({ items: rows });
});

app.get('/api/tutorials', (_req, res) => {
  const rows = db
    .prepare(`
      SELECT id, title, created_at
      FROM tutorials
      WHERE status = 'published'
      ORDER BY created_at DESC, id DESC
    `)
    .all();
  res.json({ items: rows });
});

app.get('/api/tutorial', (_req, res) => {
  const rows = db
    .prepare(`
      SELECT id, title, created_at
      FROM tutorials
      WHERE status = 'published'
      ORDER BY created_at DESC, id DESC
    `)
    .all();
  res.json({ items: rows });
});

app.get('/api/tutorials/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: 'id 无效' });
  }

  const row = db
    .prepare(`
      SELECT id, title, content, created_at, updated_at
      FROM tutorials
      WHERE id = ? AND status = 'published'
    `)
    .get(id);

  if (!row) {
    return res.status(404).json({ error: '教程不存在' });
  }
  res.json({ item: row });
});

app.get('/api/tutorial/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: 'id 无效' });
  }

  const row = db
    .prepare(`
      SELECT id, title, content, created_at, updated_at
      FROM tutorials
      WHERE id = ? AND status = 'published'
    `)
    .get(id);

  if (!row) {
    return res.status(404).json({ error: '教程不存在' });
  }
  res.json({ item: row });
});

app.post('/api/submit', (req, res) => {
  const { name, url, description = '', category = '未分类', submitterName = '', submitterEmail = '' } = req.body;

  if (!name || !url) {
    return res.status(400).json({ error: 'name 和 url 必填' });
  }

  if (!isValidUrl(url)) {
    return res.status(400).json({ error: 'url 格式不正确' });
  }

  const stmt = db.prepare(`
    INSERT INTO sites (name, url, description, category, source, submitter_name, submitter_email, status)
    VALUES (?, ?, ?, ?, 'user_submit', ?, ?, 'pending')
  `);

  try {
    const result = stmt.run(name.trim(), url.trim(), description.trim(), category.trim(), submitterName.trim(), submitterEmail.trim());
    res.json({ ok: true, id: result.lastInsertRowid, message: '提交成功，等待管理员审核' });
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return res.status(409).json({ error: '这个网站已经存在，可能已收录或正在审核中' });
    }
    res.status(500).json({ error: '提交失败，请稍后再试' });
  }
});

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;

  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: '密码错误' });
  }

  res.cookie('admin_token', ADMIN_TOKEN, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 7 * 24 * 60 * 60 * 1000
  });

  res.json({ ok: true });
});

app.post('/api/admin/logout', requireAdmin, (_req, res) => {
  res.clearCookie('admin_token');
  res.json({ ok: true });
});

app.get('/api/admin/categories', requireAdmin, (_req, res) => {
  const rows = db
    .prepare(`
      SELECT c.id, c.name, c.sort_order, c.is_enabled, COALESCE(COUNT(s.id), 0) AS site_count
      FROM categories c
      LEFT JOIN sites s ON s.category = c.name
      GROUP BY c.id, c.name, c.sort_order, c.is_enabled
      ORDER BY c.sort_order ASC, c.id ASC
    `)
    .all();
  res.json({ items: rows });
});

app.post('/api/admin/categories', requireAdmin, (req, res) => {
  const name = String(req.body.name || '').trim();
  const sortOrder = Number.isFinite(Number(req.body.sortOrder)) ? Number(req.body.sortOrder) : 0;
  const isEnabled = req.body.isEnabled === 0 || req.body.isEnabled === '0' ? 0 : 1;

  if (!name) {
    return res.status(400).json({ error: 'name 必填' });
  }

  try {
    const result = db
      .prepare('INSERT INTO categories (name, sort_order, is_enabled) VALUES (?, ?, ?)')
      .run(name, sortOrder, isEnabled);
    res.json({ ok: true, id: result.lastInsertRowid });
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return res.status(409).json({ error: '分类已存在' });
    }
    res.status(500).json({ error: '创建失败' });
  }
});

app.put('/api/admin/categories/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const name = String(req.body.name || '').trim();
  const sortOrder = Number.isFinite(Number(req.body.sortOrder)) ? Number(req.body.sortOrder) : 0;
  const isEnabled = req.body.isEnabled === 0 || req.body.isEnabled === '0' ? 0 : 1;

  if (!name) {
    return res.status(400).json({ error: 'name 必填' });
  }

  try {
    const result = db
      .prepare('UPDATE categories SET name = ?, sort_order = ?, is_enabled = ? WHERE id = ?')
      .run(name, sortOrder, isEnabled, id);
    if (!result.changes) {
      return res.status(404).json({ error: '记录不存在' });
    }
    res.json({ ok: true });
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return res.status(409).json({ error: '分类已存在' });
    }
    res.status(500).json({ error: '更新失败' });
  }
});

app.delete('/api/admin/categories/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const category = db.prepare('SELECT id, name FROM categories WHERE id = ?').get(id);
  if (!category) {
    return res.status(404).json({ error: '记录不存在' });
  }

  const siteCount = db.prepare('SELECT COUNT(*) as c FROM sites WHERE category = ?').get(category.name).c;
  if (siteCount > 0) {
    return res.status(409).json({ error: `该分类收录了 ${siteCount} 个网站，不允许删除`, siteCount });
  }

  const result = db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  if (!result.changes) {
    return res.status(404).json({ error: '记录不存在' });
  }
  res.json({ ok: true });
});

app.get('/api/admin/sites', requireAdmin, (req, res) => {
  const status = String(req.query.status || 'pending');
  const q = String(req.query.q || '').trim();
  let sql = `
      SELECT id, name, url, description, category, source, submitter_name, submitter_email, status, reviewer_note, reviewed_by, reviewed_at, sort_order, created_at
      FROM sites
      WHERE status = ?
  `;
  const params = [status];

  if (q) {
    sql += ' AND (name LIKE ? OR url LIKE ? OR description LIKE ? OR category LIKE ?)';
    const kw = `%${q}%`;
    params.push(kw, kw, kw, kw);
  }

  sql += status === 'approved' ? ' ORDER BY sort_order ASC, created_at DESC' : ' ORDER BY created_at DESC';
  const rows = db.prepare(sql).all(...params);

  res.json({ items: rows });
});

function listTutorials(_req, res) {
  const rows = db
    .prepare(`
      SELECT id, title, content, status, created_at, updated_at
      FROM tutorials
      ORDER BY created_at DESC, id DESC
    `)
    .all();
  res.json({ items: rows });
}

function createTutorial(req, res) {
  const title = String(req.body.title || '').trim();
  const content = String(req.body.content || '').trim();

  if (!title || !content) {
    return res.status(400).json({ error: 'title 和 content 必填' });
  }

  const result = db
    .prepare(`
      INSERT INTO tutorials (title, content, status, created_at, updated_at)
      VALUES (?, ?, 'published', datetime('now'), datetime('now'))
    `)
    .run(title, content);

  res.json({ ok: true, id: result.lastInsertRowid });
}

app.get('/api/admin/tutorials', requireAdmin, listTutorials);
app.get('/api/admin/tutorial', requireAdmin, listTutorials);
app.post('/api/admin/tutorials', requireAdmin, createTutorial);
app.post('/api/admin/tutorial', requireAdmin, createTutorial);
app.post('/api/tutorials', requireAdmin, createTutorial);
app.post('/api/tutorial', requireAdmin, createTutorial);

app.post('/api/admin/sites', requireAdmin, (req, res) => {
  const { name, url, description = '', category = 'OpenClaw 生态', status = 'approved', sortOrder } = req.body;

  if (!name || !url) {
    return res.status(400).json({ error: 'name 和 url 必填' });
  }

  if (!isValidUrl(url)) {
    return res.status(400).json({ error: 'url 格式不正确' });
  }

  const parsedSortOrder = Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0;

  try {
    const result = db
      .prepare(`
        INSERT INTO sites (name, url, description, category, source, status, sort_order, reviewed_by, reviewed_at)
        VALUES (?, ?, ?, ?, 'admin', ?, ?, 'admin', datetime('now'))
      `)
      .run(name.trim(), url.trim(), description.trim(), category.trim(), status, parsedSortOrder);

    res.json({ ok: true, id: result.lastInsertRowid });
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return res.status(409).json({ error: '网站已存在' });
    }
    res.status(500).json({ error: '创建失败' });
  }
});

app.post('/api/admin/import', requireAdmin, (req, res) => {
  const items = Array.isArray(req.body.items) ? req.body.items : [];

  if (!items.length) {
    return res.status(400).json({ error: 'items 必须是非空数组' });
  }

  const insert = db.prepare(`
    INSERT OR IGNORE INTO sites (name, url, description, category, source, status, reviewed_by, reviewed_at)
    VALUES (?, ?, ?, ?, 'admin_import', 'approved', 'admin', datetime('now'))
  `);

  let imported = 0;
  let skipped = 0;
  for (const item of items) {
    const name = String(item.name || '').trim();
    const url = String(item.url || '').trim();
    const description = String(item.description || '').trim();
    const category = String(item.category || 'OpenClaw 生态').trim();

    if (!name || !url || !isValidUrl(url)) {
      skipped += 1;
      continue;
    }

    const result = insert.run(name, url, description, category);
    if (result.changes) {
      imported += 1;
    } else {
      skipped += 1;
    }
  }

  res.json({ ok: true, imported, skipped });
});

app.put('/api/admin/sites/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const { name, url, description = '', category = 'OpenClaw 生态', sortOrder } = req.body;

  if (!name || !url) {
    return res.status(400).json({ error: 'name 和 url 必填' });
  }

  if (!isValidUrl(url)) {
    return res.status(400).json({ error: 'url 格式不正确' });
  }

  const parsedSortOrder = Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0;

  try {
    const result = db
      .prepare(`
        UPDATE sites
        SET name = ?, url = ?, description = ?, category = ?, sort_order = ?, reviewed_by = 'admin', reviewed_at = datetime('now')
        WHERE id = ?
      `)
      .run(name.trim(), url.trim(), description.trim(), category.trim(), parsedSortOrder, id);

    if (!result.changes) {
      return res.status(404).json({ error: '记录不存在' });
    }

    res.json({ ok: true });
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return res.status(409).json({ error: '网站已存在' });
    }
    res.status(500).json({ error: '更新失败' });
  }
});

app.put('/api/admin/sites/:id/sort', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const sortOrder = Number(req.body.sortOrder);

  if (!Number.isFinite(sortOrder)) {
    return res.status(400).json({ error: 'sortOrder 必须是数字' });
  }

  const result = db
    .prepare(`
      UPDATE sites
      SET sort_order = ?, reviewed_by = 'admin', reviewed_at = datetime('now')
      WHERE id = ?
    `)
    .run(sortOrder, id);

  if (!result.changes) {
    return res.status(404).json({ error: '记录不存在' });
  }

  res.json({ ok: true });
});

app.post('/api/admin/sites/:id/approve', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const parsedSortOrder = Number.isFinite(Number(req.body.sortOrder)) ? Number(req.body.sortOrder) : 0;

  const result = db
    .prepare(`
      UPDATE sites
      SET status = 'approved', sort_order = ?, reviewer_note = '', reviewed_by = 'admin', reviewed_at = datetime('now')
      WHERE id = ?
    `)
    .run(parsedSortOrder, id);

  if (!result.changes) {
    return res.status(404).json({ error: '记录不存在' });
  }

  res.json({ ok: true });
});

app.post('/api/admin/sites/:id/reject', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const note = String(req.body.note || '').trim();

  const result = db
    .prepare(`
      UPDATE sites
      SET status = 'rejected', reviewer_note = ?, reviewed_by = 'admin', reviewed_at = datetime('now')
      WHERE id = ?
    `)
    .run(note, id);

  if (!result.changes) {
    return res.status(404).json({ error: '记录不存在' });
  }

  res.json({ ok: true });
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'claw800' });
});

app.listen(PORT, () => {
  console.log(`claw800 server running at http://localhost:${PORT}`);
});
