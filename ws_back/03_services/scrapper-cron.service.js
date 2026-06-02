function createCronScheduler({ scrapperModel }) {
  const CRON_ENABLED = String(process.env.CRON_ENABLED ?? 'true').toLowerCase() !== 'false';
  const CRON_INTERVAL_MS = Number(process.env.CRON_INTERVAL_MS || 60_000);

  const DAY_ALIASES = {
    monday: ['monday', 'lundi'],
    tuesday: ['tuesday', 'mardi'],
    wednesday: ['wednesday', 'mercredi'],
    thursday: ['thursday', 'jeudi'],
    friday: ['friday', 'vendredi'],
    saturday: ['saturday', 'samedi'],
    sunday: ['sunday', 'dimanche'],
  };
  const DAY_ORDER = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const lastTriggeredById = new Map();

  function parseHourCron(value) {
    if (!value || typeof value !== 'string') return null;
    const match = value.trim().match(/^(\d{1,2})h(\d{1,2})$/i);
    if (!match) return null;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
    return { hour, minute };
  }

  function normalizeDay(value) {
    if (!value || typeof value !== 'string') return null;
    const normalized = value.trim().toLowerCase();

    for (const [key, aliases] of Object.entries(DAY_ALIASES)) {
      if (aliases.includes(normalized)) return key;
    }

    return null;
  }

  function shouldRunNow({ dayCron, hourCron, now }) {
    const parsedHour = parseHourCron(hourCron);
    if (!parsedHour) return false;

    if (parsedHour.hour !== now.getHours() || parsedHour.minute !== now.getMinutes()) {
      return false;
    }

    if (!dayCron) return true;

    const expectedDay = normalizeDay(dayCron);
    if (!expectedDay) return false;
    const today = DAY_ORDER[now.getDay()];
    return today === expectedDay;
  }

  async function runScheduledScrapes() {
    const now = new Date();
    const minuteKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}`;

    try {
      const scrappers = await scrapperModel.getAllScrappers({ activeOnly: true });

      for (const scrapper of scrappers) {
        const shouldRun = shouldRunNow({
          dayCron: scrapper.day_cron,
          hourCron: scrapper.hour_cron,
          now,
        });

        if (!shouldRun) continue;
        if (lastTriggeredById.get(scrapper.id) === minuteKey) continue;

        lastTriggeredById.set(scrapper.id, minuteKey);

        console.log('[cron] run:start', 'id=', scrapper.id, 'hour_cron=', scrapper.hour_cron, 'day_cron=', scrapper.day_cron || '*');

        try {
          await scrapperModel.runScrapper(scrapper.id);
          console.log('[cron] run:done', 'id=', scrapper.id);
        } catch (error) {
          console.error('[cron] run:error', 'id=', scrapper.id, 'error=', error?.message || String(error));
        }
      }
    } catch (error) {
      console.error('[cron] tick:error', error?.message || String(error));
    }
  }

  function start() {
    if (!CRON_ENABLED) {
      console.log('[cron] scheduler disabled (CRON_ENABLED=false)');
      return null;
    }

    console.log(`[cron] scheduler started interval=${CRON_INTERVAL_MS}ms source=BDD`);
    return setInterval(() => {
      runScheduledScrapes().catch(() => {});
    }, CRON_INTERVAL_MS);
  }

  return {
    start,
    runScheduledScrapes,
  };
}

module.exports = {
  createCronScheduler,
};
