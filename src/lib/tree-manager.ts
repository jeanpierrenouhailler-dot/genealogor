/**
 * Gestionnaire des arbres généalogiques : persistance locale des arbres connus,
 * génération d'identifiants (slugs) et utilitaires multi-arbres.
 */

export interface KnownTree {
  id: string;
  title: string;
  description?: string;
  lastOpenedAt: number;
  personCount?: number;
  isSample?: boolean;
  ownerEmail?: string;
}

const STORAGE_KEY_KNOWN_TREES = 'genealogor_known_trees';
const STORAGE_KEY_CURRENT_ROOM = 'genealogor_current_room';

export const DEFAULT_TREE_ID = 'mon-arbre';

/**
 * Nettoie une chaîne pour en faire un identifiant de salle/arbre valide
 * Conforme aux règles Firestore et WebSocket (^[a-zA-Z0-9_\-]+$)
 */
export function slugifyTreeId(input: string): string {
  const normalized = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Supprime les accents
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-') // Remplace caractères spéciaux par -
    .replace(/^-+|-+$/g, ''); // Supprime les tirets début/fin

  return normalized || 'mon-arbre';
}

/**
 * Valide si un identifiant d'arbre respecte le format strict
 */
export function isValidTreeId(id: string): boolean {
  if (!id || typeof id !== 'string') return false;
  if (id.length < 3 || id.length > 64) return false;
  return /^[a-zA-Z0-9_\-]+$/.test(id);
}

/**
 * Récupère la liste des arbres connus enregistrés localement
 */
export function getKnownTrees(): KnownTree[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const raw = localStorage.getItem(STORAGE_KEY_KNOWN_TREES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

/**
 * Enregistre la liste des arbres connus
 */
export function saveKnownTrees(trees: KnownTree[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_KNOWN_TREES, JSON.stringify(trees));
  } catch (e) {}
}

/**
 * Enregistre ou actualise un arbre dans la liste des arbres connus
 */
export function recordKnownTree(tree: Omit<KnownTree, 'lastOpenedAt'> & { lastOpenedAt?: number }): KnownTree[] {
  const current = getKnownTrees();
  const existingIdx = current.findIndex(t => t.id === tree.id);
  
  const updatedEntry: KnownTree = {
    ...tree,
    lastOpenedAt: tree.lastOpenedAt || Date.now(),
  };

  let next: KnownTree[];
  if (existingIdx >= 0) {
    next = [...current];
    next[existingIdx] = {
      ...next[existingIdx],
      ...updatedEntry,
      lastOpenedAt: Date.now(),
    };
  } else {
    next = [updatedEntry, ...current];
  }

  // Trier par date de dernière ouverture décroissante
  next.sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
  saveKnownTrees(next);
  return next;
}

/**
 * Supprime un arbre de l'historique local (sans toucher aux données Firestore distantes)
 */
export function removeKnownTreeFromLocal(treeId: string): KnownTree[] {
  const current = getKnownTrees();
  const filtered = current.filter(t => t.id !== treeId);
  saveKnownTrees(filtered);
  return filtered;
}

/**
 * Récupère le dernier identifiant d'arbre utilisé
 */
export function getStoredCurrentRoom(): string {
  if (typeof window === 'undefined') return DEFAULT_TREE_ID;
  return localStorage.getItem(STORAGE_KEY_CURRENT_ROOM) || DEFAULT_TREE_ID;
}

/**
 * Enregistre l'arbre courant
 */
export function setStoredCurrentRoom(roomId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_CURRENT_ROOM, roomId);
  } catch (e) {}
}
