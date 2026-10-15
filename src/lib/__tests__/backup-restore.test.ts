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

  it('doit rejeter une sauvegarde non chiffrée dont le contenu ou le checksum a été altéré', async () => {
    const backupJson = await createFullBackup(sampleData, sampleArchives, sampleAccess);
    const parsed = JSON.parse(backupJson);

    // Altérer une donnée
    parsed.payload.genealogy.individuals['@I1@'].name = 'Nom Falsifié';
    const tamperedJson = JSON.stringify(parsed);

    const preview = await previewBackup(tamperedJson);
    expect(preview.isValid).toBe(false);
    expect(preview.error).toContain('altéré');
  });

  it('doit chiffrer la sauvegarde avec une phrase secrète en format AES-GCM 256', async () => {
    const passphrase = 'PhraseSecreteFamiliale2026!';
    const encryptedBackupJson = await createFullBackup(sampleData, sampleArchives, sampleAccess, passphrase);

    const parsed = JSON.parse(encryptedBackupJson);
    expect(parsed.manifest.format).toBe('genealogor-backup-v2-encrypted');
    expect(parsed.manifest.isEncrypted).toBe(true);
    expect(parsed.payload).toBeUndefined();
    expect(parsed.encryptedPayload).toBeDefined();
    expect(parsed.encryptedPayload.startsWith('v2:')).toBe(true);

    // Sans mot de passe fourni, la prévisualisation doit signaler que l'archive est chiffrée
    const previewNoPwd = await previewBackup(encryptedBackupJson);
    expect(previewNoPwd.isValid).toBe(false);
    expect(previewNoPwd.isEncrypted).toBe(true);
    expect(previewNoPwd.error).toContain('phrase secrète');

    // Avec un mauvais mot de passe, doit rejeter proprement
    const previewBadPwd = await previewBackup(encryptedBackupJson, 'MauvaisMotDePasse');
    expect(previewBadPwd.isValid).toBe(false);
    expect(previewBadPwd.isEncrypted).toBe(true);
    expect(previewBadPwd.error).toContain('incorrecte');

    // Avec le bon mot de passe, doit valider et déchiffrer
    const previewGoodPwd = await previewBackup(encryptedBackupJson, passphrase);
    expect(previewGoodPwd.isValid).toBe(true);
    expect(previewGoodPwd.manifest?.checksumSha256.length).toBe(64);

    // Restauration réussie avec le bon mot de passe
    const restoreResult = await restoreBackup(encryptedBackupJson, sampleData, sampleArchives, sampleAccess, passphrase);
    expect(restoreResult.success).toBe(true);
    expect(restoreResult.data?.genealogy.individuals['@I1@'].name).toBe(sampleData.individuals['@I1@'].name);
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
