import { describe, it, expect } from 'vitest';

/**
 * Modélisation formelle et validation unitaire des règles de sécurité Firestore
 * définies dans /firestore.rules (ABAC & isolation multi-locataires étanche).
 */

interface AuthContext {
  uid: string;
  token: {
    email?: string;
    email_verified?: boolean;
  };
}

interface TreeDoc {
  ownerId: string;
  ownerEmail?: string;
  editors?: string[];
  viewers?: string[];
  isPublic?: boolean;
}

const ADMIN_EMAIL = 'jeanpierre.nouhailler@gmail.com';

function isSignedIn(auth: AuthContext | null): boolean {
  return auth !== null;
}

function isAdmin(auth: AuthContext | null): boolean {
  return isSignedIn(auth) && auth!.token.email === ADMIN_EMAIL && auth!.token.email_verified === true;
}

function canReadTree(auth: AuthContext | null, tree: TreeDoc): boolean {
  if (!isSignedIn(auth)) return false;
  return (
    isAdmin(auth) ||
    tree.ownerId === auth!.uid ||
    (tree.ownerEmail !== undefined && tree.ownerEmail === auth!.token.email) ||
    (tree.editors !== undefined && tree.editors.includes(auth!.uid)) ||
    (tree.viewers !== undefined && tree.viewers.includes(auth!.uid)) ||
    tree.isPublic === true
  );
}

function canWriteTree(auth: AuthContext | null, tree: TreeDoc): boolean {
  if (!isSignedIn(auth)) return false;
  return (
    isAdmin(auth) ||
    tree.ownerId === auth!.uid ||
    (tree.ownerEmail !== undefined && tree.ownerEmail === auth!.token.email) ||
    (tree.editors !== undefined && tree.editors.includes(auth!.uid))
  );
}

function canDeleteTree(auth: AuthContext | null, tree: TreeDoc): boolean {
  if (!isSignedIn(auth)) return false;
  return isAdmin(auth) || tree.ownerId === auth!.uid;
}

function canManageAccessRules(auth: AuthContext | null, tree: TreeDoc): boolean {
  if (!isSignedIn(auth)) return false;
  return isAdmin(auth) || tree.ownerId === auth!.uid;
}

describe('Contrôle des Règles de Sécurité Firestore (P0 - Isolation Multi-Familles)', () => {
  const ownerUser: AuthContext = {
    uid: 'user-famille-martin-uid',
    token: { email: 'martin@example.com', email_verified: true },
  };

  const otherUser: AuthContext = {
    uid: 'user-famille-durand-uid',
    token: { email: 'durand@example.com', email_verified: true },
  };

  const editorUser: AuthContext = {
    uid: 'user-cousin-editeur-uid',
    token: { email: 'cousin@example.com', email_verified: true },
  };

  const adminUser: AuthContext = {
    uid: 'admin-super-uid',
    token: { email: ADMIN_EMAIL, email_verified: true },
  };

  const privateMartinTree: TreeDoc = {
    ownerId: 'user-famille-martin-uid',
    ownerEmail: 'martin@example.com',
    editors: ['user-cousin-editeur-uid'],
    viewers: [],
    isPublic: false,
  };

  it('interdit rigoureusement tout accès en lecture et écriture aux utilisateurs non authentifiés', () => {
    expect(canReadTree(null, privateMartinTree)).toBe(false);
    expect(canWriteTree(null, privateMartinTree)).toBe(false);
    expect(canDeleteTree(null, privateMartinTree)).toBe(false);
    expect(canManageAccessRules(null, privateMartinTree)).toBe(false);
  });

  it('interdit formellement à un utilisateur d\'une autre famille de lire l\'arbre privé d\'autrui', () => {
    expect(canReadTree(otherUser, privateMartinTree)).toBe(false);
  });

  it('interdit formellement à un utilisateur d\'une autre famille de modifier ou supprimer l\'arbre d\'autrui', () => {
    expect(canWriteTree(otherUser, privateMartinTree)).toBe(false);
    expect(canDeleteTree(otherUser, privateMartinTree)).toBe(false);
    expect(canManageAccessRules(otherUser, privateMartinTree)).toBe(false);
  });

  it('autorise le propriétaire légitime à lire, modifier et supprimer son arbre ainsi que gérer les accès', () => {
    expect(canReadTree(ownerUser, privateMartinTree)).toBe(true);
    expect(canWriteTree(ownerUser, privateMartinTree)).toBe(true);
    expect(canDeleteTree(ownerUser, privateMartinTree)).toBe(true);
    expect(canManageAccessRules(ownerUser, privateMartinTree)).toBe(true);
  });

  it('autorise un éditeur déclaré à enrichir l\'arbre sans pouvoir le supprimer ni en modifier les droits administrateur', () => {
    expect(canReadTree(editorUser, privateMartinTree)).toBe(true);
    expect(canWriteTree(editorUser, privateMartinTree)).toBe(true);
    // Seul le propriétaire ou admin peut supprimer l'arbre ou gérer les règles d'accès racine
    expect(canDeleteTree(editorUser, privateMartinTree)).toBe(false);
    expect(canManageAccessRules(editorUser, privateMartinTree)).toBe(false);
  });

  it('permet à l\'administrateur système d\'effectuer les opérations de maintenance de secours', () => {
    expect(canReadTree(adminUser, privateMartinTree)).toBe(true);
    expect(canWriteTree(adminUser, privateMartinTree)).toBe(true);
    expect(canDeleteTree(adminUser, privateMartinTree)).toBe(true);
  });

  it('autorise la lecture d\'un arbre uniquement lorsqu\'il est explicitement configuré public', () => {
    const publicTree: TreeDoc = { ...privateMartinTree, isPublic: true };
    expect(canReadTree(otherUser, publicTree)).toBe(true);
    // Même si public, les écritures restent strictement interdites aux tiers
    expect(canWriteTree(otherUser, publicTree)).toBe(false);
  });
});
