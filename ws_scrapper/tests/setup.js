import { beforeEach, afterEach, vi } from 'vitest';

// Le scrapper logue chaque requête : on coupe la sortie pour garder des rapports lisibles
beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});
