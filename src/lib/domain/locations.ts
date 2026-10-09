/** Árvore de locais: montada a partir da lista plana que vem do banco. */

export type FlatLocation = {
  id: string;
  parentId: string | null;
  name: string;
  sortOrder: number;
  active: boolean;
};

export type LocationNode<T extends FlatLocation = FlatLocation> = T & { depth: number; children: LocationNode<T>[] };

const byOrderThenName = (a: FlatLocation, b: FlatLocation) =>
  a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "pt-BR", { numeric: true });

export function buildLocationTree<T extends FlatLocation>(locations: readonly T[]): LocationNode<T>[] {
  const nodes = new Map<string, LocationNode<T>>();
  for (const location of locations) nodes.set(location.id, { ...location, depth: 0, children: [] });

  const roots: LocationNode<T>[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  const finish = (list: LocationNode<T>[], depth: number) => {
    list.sort(byOrderThenName);
    for (const node of list) {
      node.depth = depth;
      finish(node.children, depth + 1);
    }
  };
  finish(roots, 0);
  return roots;
}

/** Percorre a árvore em profundidade, na ordem de exibição. */
export function flattenTree<T extends FlatLocation>(roots: LocationNode<T>[]): LocationNode<T>[] {
  const out: LocationNode<T>[] = [];
  const walk = (list: LocationNode<T>[]) => {
    for (const node of list) {
      out.push(node);
      walk(node.children);
    }
  };
  walk(roots);
  return out;
}

/** "Bloco A › Suíte 12" para cada local. */
export function locationPaths(locations: readonly FlatLocation[], separator = " › "): Map<string, string> {
  const byId = new Map(locations.map((l) => [l.id, l]));
  const cache = new Map<string, string>();

  const pathOf = (id: string, guard = 0): string => {
    const cached = cache.get(id);
    if (cached) return cached;
    const location = byId.get(id);
    if (!location) return "";
    const parentPath = location.parentId && guard < 50 ? pathOf(location.parentId, guard + 1) : "";
    const path = parentPath ? `${parentPath}${separator}${location.name}` : location.name;
    cache.set(id, path);
    return path;
  };

  for (const location of locations) pathOf(location.id);
  return cache;
}

/** Ids do local e de todos os seus descendentes (para não oferecer um destino que criaria ciclo). */
export function descendantIds(locations: readonly FlatLocation[], id: string): Set<string> {
  const result = new Set<string>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const location of locations) {
      if (location.parentId && result.has(location.parentId) && !result.has(location.id)) {
        result.add(location.id);
        grew = true;
      }
    }
  }
  return result;
}
