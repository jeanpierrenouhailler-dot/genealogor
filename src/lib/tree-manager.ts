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

export const DEFAULT_SAMPLE_TREE: KnownTree = {
  id: 'famille-martin-1742',
  title: 'Famille Martin (Démonstration)',
  description: 'Arbre historique breton sur 4 générations avec photographies et actes du XVIIIe au XXe siècle',
  lastOpenedAt: Date.now(),
  personCount: 16,
  isSample: true,
};

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

  return normalized || 'arbre-sans-titre';
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
  if (typeof window === 'undefined') return [DEFAULT_SAMPLE_TREE];
  
  try {
    const raw = localStorage.getItem(STORAGE_KEY_KNOWN_TREES);
    if (!raw) {
      const initial = [DEFAULT_SAMPLE_TREE];
      saveKnownTrees(initial);
      return initial;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [DEFAULT_SAMPLE_TREE];
    
    // S'assurer que l'arbre exemple est toujours dans la liste
    const hasSample = parsed.some(t => t.id === DEFAULT_SAMPLE_TREE.id);
    if (!hasSample) {
      parsed.unshift(DEFAULT_SAMPLE_TREE);
    }
    return parsed;
  } catch (e) {
    return [DEFAULT_SAMPLE_TREE];
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
  // Ne pas supprimer l'arbre d'exemple
  if (treeId === DEFAULT_SAMPLE_TREE.id) return current;
  const filtered = current.filter(t => t.id !== treeId);
  saveKnownTrees(filtered);
  return filtered;
}

/**
 * Récupère le dernier identifiant d'arbre utilisé
 */
export function getStoredCurrentRoom(): string {
  if (typeof window === 'undefined') return DEFAULT_SAMPLE_TREE.id;
  return localStorage.getItem(STORAGE_KEY_CURRENT_ROOM) || DEFAULT_SAMPLE_TREE.id;
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
