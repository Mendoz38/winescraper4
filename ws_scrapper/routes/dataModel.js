const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', 'data', 'config.json');
const CACHE_TTL_MS = 3000;

let cache = {
  data: null,
  mtimeMs: 0,
  loadedAt: 0,
};

let readInFlight = null;

const deepClone = (value) => JSON.parse(JSON.stringify(value));

const readConfigFromDisk = async () => {
  const [raw, stat] = await Promise.all([fs.promises.readFile(CONFIG_PATH, 'utf8'), fs.promises.stat(CONFIG_PATH)]);

  const parsed = JSON.parse(raw);
  cache = {
    data: parsed,
    mtimeMs: stat.mtimeMs,
    loadedAt: Date.now(),
  };

  return parsed;
};

const readConfig = async ({ force = false } = {}) => {
  if (!force && cache.data) {
    const cacheIsFresh = Date.now() - cache.loadedAt <= CACHE_TTL_MS;
    if (cacheIsFresh) return cache.data;

    const stat = await fs.promises.stat(CONFIG_PATH);
    if (stat.mtimeMs === cache.mtimeMs) {
      cache.loadedAt = Date.now();
      return cache.data;
    }
  }

  if (!readInFlight) {
    readInFlight = readConfigFromDisk().finally(() => {
      readInFlight = null;
    });
  }

  return readInFlight;
};

const saveConfig = async (data) => {
  const json = JSON.stringify(data, null, 4);
  await fs.promises.writeFile(CONFIG_PATH, json, 'utf8');
  await readConfig({ force: true });
  return deepClone(data);
};

const getConfig = async () => deepClone(await readConfig());

const getConfigWithId = async (id) => {
  const config = await readConfig();
  if (!config[id]) throw new Error('unknown config');
  return deepClone(config[id]);
};

const getScrapeData = async (id) => {
  const config = await getConfigWithId(id);
  if (!config.scrapeData) throw new Error('missing scrapeData');
  return deepClone(config.scrapeData);
};

const updateConfigWithId = async (id, nextConfig) => {
  const config = await readConfig();
  const merged = { ...config, [id]: nextConfig };
  return saveConfig(merged);
};

const updateLastRun = async (id) => {
  const current = await getConfigWithId(id);
  const nextConfig = { ...current, lastRun: new Date().toISOString() };
  return updateConfigWithId(id, nextConfig);
};

const deleteConfigWithId = async (id) => {
  const config = await readConfig();
  const next = Object.keys(config).reduce((acc, key) => {
    if (key !== id) acc[key] = config[key];
    return acc;
  }, {});

  return saveConfig(next);
};

module.exports = {
  getConfig,
  getScrapeData,
  getConfigWithId,
  updateConfigWithId,
  updateLastRun,
  deleteConfigWithId,
};
