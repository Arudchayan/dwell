export type Route = 'today' | 'history' | 'limits' | 'settings' | 'welcome';

const ROUTES: Route[] = ['today', 'history', 'limits', 'settings', 'welcome'];

/** Old hashes from the first release still land somewhere sensible. */
const ALIASES: Record<string, Route> = {
  overview: 'today',
  sites: 'history',
  data: 'settings',
};

export function parseHash(hash: string): { route: Route; params: URLSearchParams } {
  const [path = '', query = ''] = hash.replace(/^#\/?/, '').split('?');
  const route = (ROUTES as string[]).includes(path) ? (path as Route) : (ALIASES[path] ?? 'today');
  return { route, params: new URLSearchParams(query) };
}

export function navigate(route: Route, params?: Record<string, string>): void {
  const q = params ? `?${new URLSearchParams(params).toString()}` : '';
  location.hash = `#/${route}${q}`;
}
