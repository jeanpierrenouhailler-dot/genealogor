import { ArchiveDocument } from '../types/genealogy';

const ARCHIVES_STORAGE_KEY = 'genealogor_archives_v1';

export function getStoredArchives(): ArchiveDocument[] {
  try {
    const raw = localStorage.getItem(ARCHIVES_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Erreur lecture archives', e);
  }
  return getDefaultArchives();
}

export function saveStoredArchives(archives: ArchiveDocument[]): void {
  try {
    localStorage.setItem(ARCHIVES_STORAGE_KEY, JSON.stringify(archives));
  } catch (e) {
    console.error('Erreur sauvegarde archives', e);
  }
}

export function getDefaultArchives(): ArchiveDocument[] {
  return [
    {
      id: 'doc-001',
      title: 'Acte de baptême de François Martin (1742)',
      type: 'baptism',
      archiveLocation: 'Archives Départementales d\'Ille-et-Vilaine',
      callNumber: '10 NUM 35001 23, vue 42/180',
      date: '14 mai 1742',
      place: 'Saint-Malo (Paroisse Saint-Vincent)',
      transcription: `L'an mil sept cent quarante deux, le quatorzième jour de may, a esté baptisé par moy soussigné vicaire, François, né de ce jour en légitime mariage de Maistre Pierre Martin, charpentier de navires, et de damoiselle Jeanne Le Galloudec, son espouse.
Parrein a esté noble homme François Surcouf, et marreine dame Marguerite Marion, lesquels ont signé avec le père présent.`,
      notes: 'Écriture cursive lisible, encre ferrogallique bien conservée. Signature autographe du père et des parrains.',
      linkedPersonIds: ['@I1@', '@I2@', '@I3@'],
      linkedFamilyIds: ['@F1@'],
      createdAt: Date.now() - 86400000 * 10,
      updatedAt: Date.now() - 86400000 * 10,
    },
    {
      id: 'doc-002',
      title: 'Acte de mariage sous la République (An II)',
      type: 'marriage',
      archiveLocation: 'Archives Municipales de Rennes',
      callNumber: '2 E 24, registre des mariages, acte n° 78',
      date: '18 Brumaire an II',
      republicanDate: '18 Brumaire an II (8 novembre 1793)',
      place: 'Rennes (Ille-et-Vilaine)',
      transcription: `Cejourd'hui dix-huitième brumaire de l'an second de la République française une et indivisible, devant moy officier public de la commune de Rennes, se sont présentés le citoyen François Martin, âgé de cinquante et un ans, marinier, et la citoyenne Marie Laurent, âgée de vingt-sept ans, tailleuse d'habits.
Lesquels ont déclaré vouloir s'unir par les liens du mariage conformément à la Loy républicaine, en présence des citoyens témoins majeurs requis.`,
      notes: 'Mention de l\'abolition des vœux religieux et conformité aux lois révolutionnaires.',
      linkedPersonIds: ['@I1@', '@I4@'],
      linkedFamilyIds: ['@F2@'],
      createdAt: Date.now() - 86400000 * 5,
      updatedAt: Date.now() - 86400000 * 5,
    },
    {
      id: 'doc-003',
      title: 'Fiche Matricule Militaire — Classe 1914',
      type: 'military',
      archiveLocation: 'Archives Départementales de Loire-Atlantique',
      callNumber: '1 R 1892, matricule n° 1420',
      date: '1914',
      place: 'Nantes (Loire-Atlantique)',
      transcription: `Degré d'instruction : 3 (sait lire, écrire et compter).
Signalement : Cheveux châtains, yeux bleus, front ordinaire, nez rectiligne, visage ovale, taille 1m72.
Affecté au 65e Régiment d'Infanterie de Nantes le 2 août 1914. Blessé le 15 septembre 1914 à la bataille de l'Aisne. Cité à l'ordre du régiment pour acte de bravoure.`,
      notes: 'Détail des campagnes contre l\'Allemagne et décorations attribuées.',
      linkedPersonIds: ['@I8@'],
      linkedFamilyIds: [],
      createdAt: Date.now() - 86400000 * 2,
      updatedAt: Date.now() - 86400000 * 2,
    }
  ];
}
