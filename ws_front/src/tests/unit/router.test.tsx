import { describe, expect, it } from 'vitest';
import { getRouter } from '../../router';
import { routeTree } from '../../routeTree.gen';

describe('getRouter', () => {
  it('construit le router avec les options attendues', () => {
    const router = getRouter();

    expect(router.options.routeTree).toBe(routeTree);
    expect(router.options.scrollRestoration).toBe(true);
    expect(router.options.defaultPreload).toBe('intent');
    expect(router.options.defaultPreloadStaleTime).toBe(0);
  });
});
