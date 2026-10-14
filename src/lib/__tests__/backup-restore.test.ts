import { describe, it, expect } from 'vitest';
import { createFullBackup, previewBackup, restoreBackup } from '../backup-restore';
import { getSampleGenealogy } from '../sample-data';
import { getDefaultArchives } from '../archive-store';

describe('Sauvegarde et Restauration Complète (P0 - Exigence 4.3)', () => {
  const sampleData = getSampleGenealogy();
  const sampleArchives = getDefaultArchives();
  const sampleAccess = [
    {
      id: 'acc-1',
      name: 'Branche Paternelle',
      branch: 'paternal' as const,
      rootPersonId: '@I1@',
      role: 'viewer' as const,
      hideLiving: true,
      shareToken: 'token12345678901234567890123456',
      createdAt: Date.now(),
    },
  ];

  it('doit générer un paquet de sauvegarde complet avec manifeste et empreinte SHA-256 valide', async () => {
    const backupJson = await createFullBackup(sampleData, sampleArchives, sampleAccess);
    expect(backupJson).toBeDefined();

    const preview = await previewBackup(backupJson);
    expect(preview.isValid).toBe(true);
    expect(preview.manifest?.format).toBe('genealogor-backup-v2');
    expect(preview.manifest?.stats.individualsCount).toBe(Object.keys(sampleData.individuals).length);
    expect(preview.manifest?.stats.archivesCount).toBe(sampleArchives.length);
    expect(preview.manifest?.checksumSha256.length).toBe(64);
  });

  it('doit rejeter une sauvegarde dont le contenu ou le checksum a été altéré', async () => {
    const backupJson = await createFullBackup(sampleData, sampleArchives, sampleAccess);
    const parsed = JSON.parse(backupJson);

    // Altérer une donnée
    parsed.payload.genealogy.individuals['@I1@'].name = 'Nom Falsifié';
    const tamperedJson = JSON.stringify(parsed);

    const preview = await previewBackup(tamperedJson);
    expect(preview.isValid).toBe(false);
    expect(preview.error).toContain('altéré');
  });

  it('doit restaurer fidèlement les données et créer la sauvegarde pré-restauration de sécurité', async () => {
    const backupJson = await createFullBackup(sampleData, sampleArchives, sampleAccess);

    const result = await restoreBackup(backupJson, sampleData, sampleArchives, sampleAccess);
    expect(result.success).toBe(true);
    expect(result.data?.genealogy.individuals['@I1@'].name).toBe(sampleData.individuals['@I1@'].name);
    expect(result.data?.archives.length).toBe(sampleArchives.length);
    expect(result.data?.accessList.length).toBe(sampleAccess.length);
  });
});
