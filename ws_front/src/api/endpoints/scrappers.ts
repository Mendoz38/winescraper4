export type Scrapper = {
  id: string;
  boutique_id: number | null;
  nom_boutique: string | null;
  en_ligne: boolean | null;
  payant: boolean | null;
  retrait: boolean | null;
  thecat: string | null;
  niveau: number | null;
  a_scraper: boolean;
  active: boolean;
  day_cron: string | null;
  hour_cron: string | null;
  mode: string | null;
  pagination: string | null;
  load_more: string | null;
  last_run: string | null;
  scrapeData?: {
    url: string[];
    day_cron: string | null;
    hour_cron: string | null;
    mode: string | null;
    pagination: string | null;
    load_more: string | null;
    data: {
      category: unknown;
      csv: [string | null, Record<string, unknown>];
    };
  };
};

const API_BASE = import.meta.env.VITE_API_BASE_URL;

// get all scrappers
export async function fetchScrappers(): Promise<Scrapper[]> {
  const response = await fetch(`${API_BASE}/scrap`);

  if (!response.ok) {
    throw new Error(`Erreur ${response.status}`);
  }

  return (await response.json()) as Scrapper[];
}

// get scrapper by id
export async function fetchScrapper(id: string): Promise<Scrapper> {
  const response = await fetch(`${API_BASE}/scrap/${id}`);

  if (!response.ok) {
    throw new Error(`Erreur ${response.status}`);
  }

  return (await response.json()) as Scrapper;
}

// update scrapper
export async function updateScrapper(id: string, payload: Scrapper): Promise<Scrapper> {
  const response = await fetch(`${API_BASE}/scrap/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Erreur ${response.status}`);
  }

  return (await response.json()) as Scrapper;
}
