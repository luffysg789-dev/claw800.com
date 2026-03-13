#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const db = require('../src/db');

const seedPath = path.join(__dirname, '..', 'seed', 'biteye-crypto-skills.json');
const sourceUrl = 'https://x.com/BiteyeCN/status/2032401446906609810';
const categoryZh = '加密交易/预测市场';
const categoryEn = 'Crypto Trading / Prediction Markets';
const mode = process.argv.includes('--staging') ? 'staging' : 'catalog';

if (!fs.existsSync(seedPath)) {
  console.error(`[biteye-import] seed file missing: ${seedPath}`);
  process.exit(1);
}

const rawItems = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
if (!Array.isArray(rawItems) || !rawItems.length) {
  console.error('[biteye-import] seed list is empty');
  process.exit(1);
}

const selectSkillByNameStmt = db.prepare(`
  SELECT url, icon
  FROM skills_catalog
  WHERE LOWER(name) = LOWER(?)
     OR LOWER(name_en) = LOWER(?)
     OR LOWER(name) LIKE LOWER(?)
     OR LOWER(name_en) LIKE LOWER(?)
  ORDER BY updated_at DESC, created_at DESC, id DESC
  LIMIT 1
`);

const selectStagingByNameStmt = db.prepare(`
  SELECT url, icon
  FROM skills_catalog_staging
  WHERE LOWER(name) = LOWER(?)
     OR LOWER(name_en) = LOWER(?)
     OR LOWER(name) LIKE LOWER(?)
     OR LOWER(name_en) LIKE LOWER(?)
  ORDER BY updated_at DESC, fetched_at DESC, id DESC
  LIMIT 1
`);

const upsertCatalogStmt = db.prepare(`
  INSERT INTO skills_catalog (name, name_en, url, description, description_en, category, category_en, icon, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  ON CONFLICT(url) DO UPDATE SET
    name = excluded.name,
    name_en = excluded.name_en,
    description = excluded.description,
    description_en = excluded.description_en,
    category = excluded.category,
    category_en = excluded.category_en,
    icon = CASE WHEN excluded.icon <> '' THEN excluded.icon ELSE skills_catalog.icon END,
    updated_at = datetime('now')
`);

const upsertStagingStmt = db.prepare(`
  INSERT INTO skills_catalog_staging (name, name_en, url, description, description_en, category, category_en, icon, fetched_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  ON CONFLICT(url) DO UPDATE SET
    name = excluded.name,
    name_en = excluded.name_en,
    description = excluded.description,
    description_en = excluded.description_en,
    category = excluded.category,
    category_en = excluded.category_en,
    icon = CASE WHEN excluded.icon <> '' THEN excluded.icon ELSE skills_catalog_staging.icon END,
    fetched_at = datetime('now'),
    updated_at = datetime('now')
`);

function makeFallbackSearchUrl(name) {
  return `https://github.com/search?q=${encodeURIComponent(`repo:openclaw/skills "${name}"`)}&type=code`;
}

function makeDescriptions(item) {
  const groupZh = String(item.groupZh || '').trim();
  const groupEn = String(item.groupEn || '').trim();
  return {
    zh: `来自 Biteye「链上交易/预测市场必备 skills」清单，分组：${groupZh || '未分类'}。来源推文：${sourceUrl}`,
    en: `Curated from Biteye's "must-have skills for crypto trading / prediction markets" list. Group: ${groupEn || 'Uncategorized'}. Source: ${sourceUrl}`
  };
}

function resolveExistingMeta(item) {
  const exact = String(item.name || '').trim();
  const exactEn = String(item.nameEn || '').trim();
  const fuzzy = `%${exact}%`;
  return (
    selectSkillByNameStmt.get(exact, exactEn, fuzzy, fuzzy) ||
    selectStagingByNameStmt.get(exact, exactEn, fuzzy, fuzzy) ||
    null
  );
}

const prepared = rawItems.map((item) => {
  const name = String(item.name || '').trim();
  const nameEn = String(item.nameEn || name).trim();
  const existing = resolveExistingMeta(item);
  const descriptions = makeDescriptions(item);
  return {
    name,
    nameEn,
    url: String(existing?.url || '').trim() || makeFallbackSearchUrl(nameEn || name),
    description: descriptions.zh,
    descriptionEn: descriptions.en,
    category: categoryZh,
    categoryEn: categoryEn,
    icon: String(existing?.icon || '').trim()
  };
}).filter((item) => item.name && item.url);

const saveTx = db.transaction((items) => {
  for (const item of items) {
    const stmt = mode === 'staging' ? upsertStagingStmt : upsertCatalogStmt;
    stmt.run(
      item.name,
      item.nameEn,
      item.url,
      item.description,
      item.descriptionEn,
      item.category,
      item.categoryEn,
      item.icon
    );
  }
});

saveTx(prepared);

console.log(
  `[biteye-import] imported ${prepared.length} skills into ${mode === 'staging' ? 'skills_catalog_staging' : 'skills_catalog'}`
);
