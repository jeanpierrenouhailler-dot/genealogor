import { describe, it, expect } from 'vitest';
import { determineVitalStatus, isLiving, shouldProtectPerson, sanitizePersonForPrivacy } from '../privacy';
import { Individual, GenealogyData } from '../../types/genealogy';

describe('Confidentialité des personnes vivantes (P0 - Exigence 3.3)', () => {
  const currentYear = new Date().getFullYear();

  it('considère une personne avec décès documenté comme décédée', () => {
    const person: Individual = {
      id: '@I1@',
      name: 'Pierre Martin',
      sex: 'M',
      death: { date: '17 AUG 1782', place: 'Saint-Malo' },
      familiesAsChild: [],
      familiesAsSpouse: [],
    };

    expect(determineVitalStatus(person)).toBe('deceased');
    expect(isLiving(person)).toBe(false);
    expect(shouldProtectPerson(person)).toBe(false);
  });

  it('considère une personne née récemment (< 100 ans) comme probablement vivante', () => {
    const recentYear = currentYear - 35;
    const person: Individual = {
      id: '@I2@',
      name: 'Julien Martin',
      sex: 'M',
      birth: { date: `12 JUN ${recentYear}`, parsedDate: { raw: `${recentYear}`, year: recentYear } },
      familiesAsChild: [],
      familiesAsSpouse: [],
    };

    expect(determineVitalStatus(person)).toBe('probably_alive');
    expect(isLiving(person)).toBe(true);
    expect(shouldProtectPerson(person)).toBe(true);
  });

  it('traite de manière prudente une personne sans date (statut inconnu)', () => {
    const person: Individual = {
      id: '@I3@',
      name: 'Cousin Mystère',
      sex: 'M',
      familiesAsChild: [],
      familiesAsSpouse: [],
    };

    // Sans dates ni contexte, statut inconnu mais DOIT être protégé par défaut selon la règle conservatrice
    expect(determineVitalStatus(person)).toBe('unknown');
    expect(shouldProtectPerson(person)).toBe(true);
  });

  it('déduit le statut via les parents lorsque la date de la personne est absente', () => {
    const youngParentYear = currentYear - 50;
    const mockData: GenealogyData = {
      individuals: {
        '@FATH@': {
          id: '@FATH@',
          name: 'Père Récent',
          sex: 'M',
          birth: { parsedDate: { raw: `${youngParentYear}`, year: youngParentYear } },
          familiesAsChild: [],
          familiesAsSpouse: ['@FAM1@'],
        },
        '@CHILD@': {
          id: '@CHILD@',
          name: 'Enfant Sans Date',
          sex: 'F',
          familiesAsChild: ['@FAM1@'],
          familiesAsSpouse: [],
        },
      },
      families: {
        '@FAM1@': {
          id: '@FAM1@',
          husbandId: '@FATH@',
          childrenIds: ['@CHILD@'],
          notes: [],
        },
      },
    };

    const child = mockData.individuals['@CHILD@'];
    expect(determineVitalStatus(child, mockData)).toBe('probably_alive');
    expect(shouldProtectPerson(child, undefined, mockData)).toBe(true);
  });

  it('anonymise de façon étanche les données des personnes protégées', () => {
    const recentYear = currentYear - 20;
    const person: Individual = {
      id: '@I4@',
      name: 'Claire Martin',
      givenName: 'Claire',
      surname: 'Martin',
      sex: 'F',
      birth: { date: `01 JAN ${recentYear}`, place: 'Rennes, France', parsedDate: { raw: `${recentYear}`, year: recentYear } },
      occupations: ['Ingénieure'],
      notes: ['Note très confidentielle'],
      familiesAsChild: [],
      familiesAsSpouse: [],
    };

    const sanitized = sanitizePersonForPrivacy(person);

    expect(sanitized.name).toBe('Martin [Privé]');
    expect(sanitized.givenName).toBe('[Confidentiel]');
    expect(sanitized.occupations).toEqual([]);
    expect(sanitized.notes?.[0]).toContain('masquées');
    // Le lieu précis doit être masqué
    expect(sanitized.birth?.place).toBeUndefined();
    // Seule l'année peut être conservée
    expect(sanitized.birth?.date).toBe(`${recentYear}`);
  });
});
