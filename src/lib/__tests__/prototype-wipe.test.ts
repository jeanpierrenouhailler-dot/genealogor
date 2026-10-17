import { describe, it, expect, beforeEach } from 'vitest';
import { getSampleGenealogy, createEmptyGenealogy, isSampleGenealogy } from '../sample-data';
import { getStoredArchives, clearStoredArchives, getDefaultArchives } from '../archive-store';
import { validateChronology } from '../validation';
import { computeSosaNumbers } from '../sosa-aboville';
import { serializeGedcomWithReport } from '../gedcom-serializer';

// Mock localStorage in Node/Vitest environment
const mockStorage: Record<string, string> = {};
global.localStorage = {
  getItem: (key: string) => mockStorage[key] || null,
  setItem: (key: string, val: string) => { mockStorage[key] = val; },
  removeItem: (key: string) => { delete mockStorage[key]; },
  clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); },
  key: (i: number) => Object.keys(mockStorage)[i] || null,
  length: 0,
} as any;

describe('Effacement du prototype & Arbre vierge', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('génère un arbre généalogique vierge sans individus ni familles', () => {
    const emptyTree = createEmptyGenealogy('Arbre Vierge');
    expect(emptyTree.individuals).toEqual({});
    expect(emptyTree.families).toEqual({});
    expect(emptyTree.rootPersonId).toBeUndefined();
    expect(emptyTree.sourceHeader).toBe('Arbre Vierge');
  });

  it('détecte correctement si les données actuelles sont celles du prototype ou un arbre vierge', () => {
    const sampleTree = getSampleGenealogy();
    const defaultArchives = getDefaultArchives();
    expect(isSampleGenealogy(sampleTree, defaultArchives)).toBe(true);

    const emptyTree = createEmptyGenealogy();
    expect(isSampleGenealogy(emptyTree, [])).toBe(false);
  });

  it('respecte le flag d’effacement du prototype et ne réinjecte pas de documents démo', () => {
    localStorage.setItem('genealogor_prototype_cleared', 'true');
    const archives = getStoredArchives();
    expect(archives).toEqual([]);

    clearStoredArchives();
    expect(getStoredArchives()).toEqual([]);
  });

  it('permet de restaurer le prototype d’exemple sur demande', () => {
    localStorage.setItem('genealogor_prototype_cleared', 'true');
    expect(getStoredArchives()).toEqual([]);

    // Restauration
    localStorage.removeItem('genealogor_prototype_cleared');
    const restored = getStoredArchives();
    expect(restored.length).toBeGreaterThan(0);
    expect(restored.some(a => a.id === 'doc-004')).toBe(true);
  });

  it('ne provoque pas d’erreur de validation ou de calcul Sosa sur un arbre vide', () => {
    const emptyTree = createEmptyGenealogy();
    expect(() => validateChronology(emptyTree)).not.toThrow();
    expect(validateChronology(emptyTree)).toEqual([]);

    expect(() => computeSosaNumbers(emptyTree)).not.toThrow();
    expect(computeSosaNumbers(emptyTree)).toEqual({});

    expect(() => serializeGedcomWithReport(emptyTree)).not.toThrow();
    const { report } = serializeGedcomWithReport(emptyTree);
    expect(report.totalIndividuals).toBe(0);
  });
});
