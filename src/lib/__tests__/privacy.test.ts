import { describe, it, expect } from 'vitest';
import { 
  determineVitalStatus, 
  isLiving, 
  shouldProtectPerson, 
  sanitizePersonForPrivacy, 
  sanitizeFamilyForPrivacy,
  sanitizeArchiveForPrivacy,
  sanitizeArchivesForPrivacy,
  sanitizeGenealogyDataForPrivacy,
  getProtectedPersonIds 
} from '../privacy';
import { Individual, Family, ArchiveDocument, GenealogyData } from '../../types/genealogy';

describe('Confidentialité des personnes vivantes & contemporains (P0)', () => {
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

  it('anonymise de façon étanche les données des personnes protégées SANS conserver de champs parasites via déstructuration', () => {
    const recentYear = currentYear - 20;
    const person: Individual = {
      id: '@I4@',
      name: 'Claire Martin',
      givenName: 'Claire',
      surname: 'Martin',
      sex: 'F',
      birth: { 
        date: `01 JAN ${recentYear}`, 
        place: 'Clinique Privée Rennes, 12 rue de Paris', 
        parsedDate: { raw: `${recentYear}`, year: recentYear },
        notes: ['Note naissance confidentielle'],
        latitude: 48.11,
        longitude: -1.67,
      },
      occupations: ['Ingénieure R&D'],
      residences: [
        { place: '7 rue secrète, Rennes', date: '2024' }
      ],
      notes: ['Note médicale très confidentielle'],
      citations: [
        { sourceId: '@S1@', transcription: 'Extrait acte intime', notes: 'Secret' }
      ],
      media: [
        { title: 'Photo privée', file: 'data:image/png;base64,privatedata' }
      ],
      _unsupportedTags: [
        { tag: '_CUSTOM_SENSITIVE', value: 'Private Info', level: 1 }
      ],
      familiesAsChild: ['@F1@'],
      familiesAsSpouse: ['@F2@'],
    };

    const sanitized = sanitizePersonForPrivacy(person);

    // Identité masquée
    expect(sanitized.name).toBe('Martin [Privé]');
    expect(sanitized.givenName).toBe('[Confidentiel]');
    expect(sanitized.surname).toBe('Martin');

    // Champs sensibles complètement vidés (aucune fuite par déstructuration)
    expect(sanitized.occupations).toEqual([]);
    expect(sanitized.residences).toEqual([]);
    expect(sanitized.citations).toEqual([]);
    expect(sanitized.media).toEqual([]);
    expect(sanitized._unsupportedTags).toBeUndefined();
    expect(sanitized.death).toBeUndefined();
    expect(sanitized.notes?.[0]).toContain('masquées conformément à la politique de confidentialité');

    // Date de naissance limitée à l'année sans lieu ni notes privées
    expect(sanitized.birth?.place).toBeUndefined();
    expect(sanitized.birth?.notes).toBeUndefined();
    expect(sanitized.birth?.date).toBe(`${recentYear}`);

    // Structure relationnelle préservée pour l'arbre
    expect(sanitized.familiesAsChild).toEqual(['@F1@']);
    expect(sanitized.familiesAsSpouse).toEqual(['@F2@']);
  });

  it('protège les notes de famille, divorces et événements intimes d\'un couple vivant', () => {
    const protectedIds = new Set(['@I_HUSB@']);

    const family: Family = {
      id: '@FAM_MODERN@',
      husbandId: '@I_HUSB@',
      wifeId: '@I_WIFE@',
      childrenIds: ['@I_CHILD@'],
      marriage: {
        date: '15 JUN 2018',
        place: 'Mairie de Paris 15e',
        parsedDate: { raw: '2018', year: 2018 },
        notes: ['Détails du contrat de mariage chez Maître X'],
        citations: [{ sourceId: '@S2@', notes: 'Acte de mariage récent' }],
      },
      divorce: {
        date: '10 MAY 2023',
        notes: ['Jugement de divorce contentieux'],
      },
      notes: ['Notes intimes sur les différends familiaux'],
      citations: [{ sourceId: '@S3@' }],
      media: [{ title: 'Album photo de mariage' }],
      _unsupportedTags: [{ tag: '_DIV_REASON', value: 'Privé', level: 1 }],
    };

    const sanitized = sanitizeFamilyForPrivacy(family, protectedIds);

    // Liens conservés
    expect(sanitized.id).toBe('@FAM_MODERN@');
    expect(sanitized.husbandId).toBe('@I_HUSB@');
    expect(sanitized.childrenIds).toEqual(['@I_CHILD@']);

    // Données intimes et divorce purgés
    expect(sanitized.divorce).toBeUndefined();
    expect(sanitized.notes?.[0]).toContain('confidentielles');
    expect(sanitized.citations).toEqual([]);
    expect(sanitized.media).toEqual([]);
    expect(sanitized._unsupportedTags).toBeUndefined();

    // Mariage sans lieu précis ni notes confidentielles
    expect(sanitized.marriage?.place).toBeUndefined();
    expect(sanitized.marriage?.notes).toBeUndefined();
    expect(sanitized.marriage?.date).toBe('2018');
  });

  it('exclut ou anonymise les actes d\'archives et photos liés à des vivants', () => {
    const protectedIds = new Set(['@LIVING_1@']);

    // 1. Photo d'un individu vivant : totalement exclue
    const photoLiving: ArchiveDocument = {
      id: 'doc-photo-living',
      title: 'Portrait récent de Julien',
      type: 'photo',
      linkedPersonIds: ['@LIVING_1@'],
      linkedFamilyIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    expect(sanitizeArchiveForPrivacy(photoLiving, protectedIds)).toBeNull();

    // 2. Acte de naissance contemporain d'un individu vivant : exclu
    const birthActLiving: ArchiveDocument = {
      id: 'doc-birth-living',
      title: 'Extrait d\'acte de naissance de Julien',
      type: 'birth',
      linkedPersonIds: ['@LIVING_1@'],
      linkedFamilyIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    expect(sanitizeArchiveForPrivacy(birthActLiving, protectedIds)).toBeNull();

    // 3. Document historique mixte (photo de groupe ou acte notarié associant vivant et ancêtre défunt)
    const mixedDoc: ArchiveDocument = {
      id: 'doc-mixed',
      title: 'Réunion de famille 1990',
      type: 'other',
      linkedPersonIds: ['@DECEASED_ANCESTOR@', '@LIVING_1@'],
      linkedFamilyIds: [],
      photoTags: [
        { id: 't1', personId: '@DECEASED_ANCESTOR@', x: 20, y: 30 },
        { id: 't2', personId: '@LIVING_1@', x: 50, y: 50, label: 'Julien à 5 ans' }
      ],
      notes: 'Notes sur les membres présents',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const sanitizedMixed = sanitizeArchiveForPrivacy(mixedDoc, protectedIds);
    expect(sanitizedMixed).not.toBeNull();
    // Le vivant doit être retiré des personnes liées
    expect(sanitizedMixed?.linkedPersonIds).toEqual(['@DECEASED_ANCESTOR@']);
    // Le tag du vivant doit être retiré
    expect(sanitizedMixed?.photoTags?.length).toBe(1);
    expect(sanitizedMixed?.photoTags?.[0].personId).toBe('@DECEASED_ANCESTOR@');
  });

  it('aseptise globalement un arbre complet via sanitizeGenealogyDataForPrivacy', () => {
    const recentYear = currentYear - 15;
    const fullTree: GenealogyData = {
      individuals: {
        '@OLD@': {
          id: '@OLD@',
          name: 'Ancêtre Pierre',
          sex: 'M',
          death: { date: '1850' },
          familiesAsChild: [],
          familiesAsSpouse: ['@FAM@'],
        },
        '@YOUNG@': {
          id: '@YOUNG@',
          name: 'Enfant Julien',
          givenName: 'Julien',
          surname: 'Martin',
          sex: 'M',
          birth: { date: `${recentYear}`, parsedDate: { raw: `${recentYear}`, year: recentYear } },
          familiesAsChild: ['@FAM@'],
          familiesAsSpouse: [],
          occupations: ['Écolier'],
        },
      },
      families: {
        '@FAM@': {
          id: '@FAM@',
          husbandId: '@OLD@',
          childrenIds: ['@YOUNG@'],
          divorce: { date: '2020' },
        },
      },
    };

    const sanitized = sanitizeGenealogyDataForPrivacy(fullTree);
    expect(sanitized.individuals['@OLD@'].name).toBe('Ancêtre Pierre');
    expect(sanitized.individuals['@YOUNG@'].name).toBe('Martin [Privé]');
    expect(sanitized.individuals['@YOUNG@'].occupations).toEqual([]);
    expect(sanitized.families['@FAM@'].divorce).toBeUndefined();
  });
});
