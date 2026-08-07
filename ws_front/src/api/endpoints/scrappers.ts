export type Scrapper = {
  id: string;
  boutique_id: number | null;
  nom_boutique: string | null;
  en_ligne: boolean | null;
  payant: boolean | null;
  retrait: boolean | null;
  thecat: string | null;
  niveau: number | null;
  scrapper_niveau?: number | null;
  a_scraper: boolean;
  active: boolean;
  day_cron: string | null;
  hour_cron: string | null;
  mode: string | null;
  pagination: string | null;
  load_more: string | null;
  add_url_image: string | null;
  add_url: string | null;
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

type ApiEnvelope<T> = {
  result?: T;
};

// get all scrappers
export async function fetchScrappers(): Promise<Scrapper[]> {
  const response = await fetch(`${API_BASE}/ws/scrappers`);

  if (!response.ok) {
    throw new Error(`Erreur ${response.status}`);
  }

  const body = (await response.json()) as ApiEnvelope<Scrapper[]>;
  return body.result ?? [];
}

// get scrapper by id
export async function fetchScrapper(id: string): Promise<Scrapper> {
  const response = await fetch(`${API_BASE}/ws/scrappers/${id}`);

  if (!response.ok) {
    throw new Error(`Erreur ${response.status}`);
  }

  return (await response.json()) as Scrapper;
}

// update scrapper
export async function updateScrapper(id: string, payload: Scrapper): Promise<Scrapper> {
  const response = await fetch(`${API_BASE}/ws/scrappers/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Erreur ${response.status}`);
  }

  const body = (await response.json()) as ApiEnvelope<Scrapper>;
  return body.result as Scrapper;
}

// create scrapper
export async function createScrapper(payload: Partial<Scrapper>): Promise<Scrapper> {
  const response = await fetch(`${API_BASE}/ws/scrappers/add`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Erreur ${response.status}`);
  }

  const body = (await response.json()) as ApiEnvelope<Scrapper>;
  return body.result as Scrapper;
}

// delete scrapper
export async function deleteScrapper(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/ws/scrappers/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(`Erreur ${response.status}`);
  }
}
