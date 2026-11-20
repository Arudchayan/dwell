export type Route = 'overview' | 'sites' | 'limits' | 'settings' | 'data' | 'welcome';

const ROUTES: Route[] = ['overview', 'sites', 'limits', 'settings', 'data', 'welcome'];

export function parseHash(hash: string): { route: Route; params: URLSearchParams } {
  const [path = '', query = ''] = hash.replace(/^#\/?/, '').split('?');
  const route = (ROUTES as string[]).includes(path) ? (path as Route) : 'overview';
  return { route, params: new URLSearchParams(query) };
}

export function navigate(route: Route, params?: Record<string, string>): void {
  const q = params ? `?${new URLSearchParams(params).toString()}` : '';
  location.hash = `#/${route}${q}`;
}
