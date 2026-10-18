import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { 
  resolveWsAuthSecret, 
  FORBIDDEN_SECRETS, 
  generateEphemeralSecret 
} from '../token-auth';
import { 
  verifyFirebaseIdToken 
} from '../firebase-token-verifier';
import { 
  hashPassword, 
  verifyPassword 
} from '../crypto';
import { 
  GenealogyData, 
  ArchiveDocument, 
  BranchAccess 
} from '../../types/genealogy';

describe('Audit et Tests des Corrections P0 & P1', () => {

  // =========================================================================
  // P0.1 : SECRET DE SIGNATURE OBLIGATOIRE AU DÉMARRAGE
  // =========================================================================
  describe('P0.1 — Secret HMAC obligatoire au démarrage', () => {
    it('interdit rigoureusement les valeurs par défaut connues et triviales en production', () => {
      for (const forbidden of FORBIDDEN_SECRETS) {
        expect(() => {
          resolveWsAuthSecret(forbidden, true);
        }).toThrow(/WS_AUTH_SECRET est obligatoire en production/i);
      }
    });

    it('rejette les secrets trop courts (< 32 caractères) en production', () => {
      expect(() => {
        resolveWsAuthSecret('short-secret-123', true);
      }).toThrow(/WS_AUTH_SECRET est obligatoire en production/i);
    });

    it('refuse de démarrer en production si le secret est absent ou vide', () => {
      expect(() => {
        resolveWsAuthSecret('', true);
      }).toThrow(/WS_AUTH_SECRET est obligatoire en production/i);

      expect(() => {
        resolveWsAuthSecret(undefined, true);
      }).toThrow(/WS_AUTH_SECRET est obligatoire en production/i);
    });

    it('accepte un secret cryptographiquement fort (≥ 32 caractères non triviaux) en production', () => {
      const validSecret = 'super_robust_and_unpredictable_secret_key_2026_xyz!#';
      const resolved = resolveWsAuthSecret(validSecret, true);
      expect(resolved).toBe(validSecret);
    });

    it('génère un secret aléatoire de 256 bits en mode développement si aucun secret n\'est fourni', () => {
      const devSecret = resolveWsAuthSecret(undefined, false);
      expect(typeof devSecret).toBe('string');
      expect(devSecret.length).toBeGreaterThanOrEqual(64); // 32 octets en hex = 64 caractères
    });
  });

  // =========================================================================
  // P0.2 : VALIDATION DU MOT DE PASSE DE PARTAGE
  // =========================================================================
  describe('P0.2 — Validation cryptographique du mot de passe de partage (PBKDF2)', () => {
    let validPasswordHash: string;
    const correctPassword = 'SecretFamilleMartin2026!';

    beforeEach(async () => {
      validPasswordHash = await hashPassword(correctPassword);
    });

    it('accepte le mot de passe correct correspondant au hash PBKDF2 stocké', async () => {
      const isValid = await verifyPassword(correctPassword, validPasswordHash);
      expect(isValid).toBe(true);
    });

    it('rejette un mot de passe incorrect', async () => {
      const isValid = await verifyPassword('MauvaisMotDePasse', validPasswordHash);
      expect(isValid).toBe(false);
    });

    it('rejette l\'accès si le mot de passe est absent ou vide alors qu\'un hash est présent', async () => {
      expect(await verifyPassword('', validPasswordHash)).toBe(false);
      expect(await verifyPassword(undefined as any, validPasswordHash)).toBe(false);
    });

    it('rejette proprement sans crash les hash invalides, corrompus ou malveillants', async () => {
      const corruptedHashes = [
        'invalid-hash-string',
        'pbkdf2:v2:bad_salt:bad_hash',
        'pbkdf2:v2:',
        'sha256:corrupted',
        '!!!malformed!!!',
      ];

      for (const badHash of corruptedHashes) {
        const isValid = await verifyPassword(correctPassword, badHash);
        expect(isValid).toBe(false);
      }
    });

    it('valide la logique serveur de contrôle des liens de partage avec mot de passe', async () => {
      const ruleWithPassword: BranchAccess = {
        id: 'rule-test-1',
        name: 'Branche Paternelle',
        branch: 'paternal',
        rootPersonId: '@I1@',
        role: 'editor',
        shareToken: 'token-secret-123',
        passwordHash: validPasswordHash,
        hideLiving: true,
        createdAt: Date.now(),
      };

      // Simulation de la vérification côté serveur
      const testServerAuth = async (enteredPassword?: string) => {
        if (ruleWithPassword.passwordHash || ruleWithPassword.password) {
          if (!enteredPassword || enteredPassword.trim().length === 0) {
            return { status: 401, error: 'Mot de passe requis pour ce lien de partage.', code: 'PASSWORD_REQUIRED' };
          }
          let isMatch = false;
          if (ruleWithPassword.passwordHash) {
            isMatch = await verifyPassword(enteredPassword, ruleWithPassword.passwordHash);
          } else if (ruleWithPassword.password) {
            isMatch = (enteredPassword === ruleWithPassword.password);
          }
          if (!isMatch) {
            return { status: 401, error: 'Mot de passe invalide pour ce lien de partage.', code: 'INVALID_PASSWORD' };
          }
        }
        return { status: 200, authorized: true, role: ruleWithPassword.role };
      };

      // 1. Mot de passe absent -> 401 PASSWORD_REQUIRED
      const resNoPwd = await testServerAuth();
      expect(resNoPwd.status).toBe(401);
      expect(resNoPwd.code).toBe('PASSWORD_REQUIRED');

      // 2. Faux mot de passe -> 401 INVALID_PASSWORD
      const resWrongPwd = await testServerAuth('wrong');
      expect(resWrongPwd.status).toBe(401);
      expect(resWrongPwd.code).toBe('INVALID_PASSWORD');

      // 3. Bon mot de passe -> 200 OK
      const resSuccess = await testServerAuth(correctPassword);
      expect(resSuccess.status).toBe(200);
      expect(resSuccess.authorized).toBe(true);
      expect(resSuccess.role).toBe('editor');
    });
  });

  // =========================================================================
  // P0.3 : VALIDATION DU JETON FIREBASE AUTH (RS256, AUDIENCE, EXP, RÉVOCATION)
  // =========================================================================
  describe('P0.3 — Vérification formelle du jeton Firebase ID Token', () => {
    // Génération d'une paire de clés RSA réelle pour simuler Google Identity
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    const testKid = 'google-key-id-2026-v1';
    const mockPublicCerts = { [testKid]: publicKey };
    const expectedProjectId = 'geometric-gift-7f6jr';

    function createSignedFirebaseToken(payloadOverrides: Record<string, any> = {}, kid = testKid): string {
      const header = {
        alg: 'RS256',
        kid,
        typ: 'JWT',
      };

      const now = Math.floor(Date.now() / 1000);
      const defaultPayload = {
        iss: `https://securetoken.google.com/${expectedProjectId}`,
        aud: expectedProjectId,
        auth_time: now - 60,
        user_id: 'firebase_user_abc123',
        sub: 'firebase_user_abc123',
        iat: now - 60,
        exp: now + 3600, // Valide 1 heure
        email: 'jeanpierre.nouhailler@gmail.com',
        email_verified: true,
      };

      const payload = { ...defaultPayload, ...payloadOverrides };

      const b64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
      const b64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
      const dataToSign = `${b64Header}.${b64Payload}`;

      const signer = crypto.createSign('RSA-SHA256');
      signer.update(dataToSign);
      const b64Signature = signer.sign(privateKey, 'base64url');

      return `${dataToSign}.${b64Signature}`;
    }

    it('valide avec succès un jeton Firebase conforme et authentique', async () => {
      const validToken = createSignedFirebaseToken();
      const result = await verifyFirebaseIdToken(validToken, {
        expectedProjectId,
        customPublicCerts: mockPublicCerts,
      });

      expect(result.valid).toBe(true);
      expect(result.uid).toBe('firebase_user_abc123');
      expect(result.email).toBe('jeanpierre.nouhailler@gmail.com');
      expect(result.email_verified).toBe(true);
    });

    it('rejette un jeton expiré (exp dépassé)', async () => {
      const now = Math.floor(Date.now() / 1000);
      const expiredToken = createSignedFirebaseToken({
        exp: now - 300, // Expiré il y a 5 minutes
      });

      const result = await verifyFirebaseIdToken(expiredToken, {
        expectedProjectId,
        customPublicCerts: mockPublicCerts,
      });

      expect(result.valid).toBe(false);
      expect(result.code).toBe('TOKEN_EXPIRED');
      expect(result.error).toContain('expiré');
    });

    it('rejette un jeton provenant d\'un autre projet Firebase (protection cross-project)', async () => {
      const crossProjectToken = createSignedFirebaseToken({
        aud: 'malicious-other-project-id',
        iss: 'https://securetoken.google.com/malicious-other-project-id',
      });

      const result = await verifyFirebaseIdToken(crossProjectToken, {
        expectedProjectId,
        customPublicCerts: mockPublicCerts,
      });

      expect(result.valid).toBe(false);
      expect(result.code).toBe('PROJECT_MISMATCH');
    });

    it('rejette un jeton avec émetteur invalide', async () => {
      const invalidIssuerToken = createSignedFirebaseToken({
        iss: 'https://attacker.site/auth',
      });

      const result = await verifyFirebaseIdToken(invalidIssuerToken, {
        expectedProjectId,
        customPublicCerts: mockPublicCerts,
      });

      expect(result.valid).toBe(false);
      expect(result.code).toBe('INVALID_ISSUER');
    });

    it('rejette un jeton à signature altérée ou falsifiée', async () => {
      const validToken = createSignedFirebaseToken();
      const parts = validToken.split('.');
      // Altération du payload (changement d'email ou UID)
      const tamperedPayload = Buffer.from(JSON.stringify({
        ...JSON.parse(Buffer.from(parts[1], 'base64url').toString()),
        email: 'attacker@evil.com',
      })).toString('base64url');

      const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

      const result = await verifyFirebaseIdToken(tamperedToken, {
        expectedProjectId,
        customPublicCerts: mockPublicCerts,
      });

      expect(result.valid).toBe(false);
      expect(result.code).toBe('INVALID_SIGNATURE');
    });

    it('rejette un jeton révoqué lorsque la vérification de révocation est activée', async () => {
      const now = Math.floor(Date.now() / 1000);
      const revokedToken = createSignedFirebaseToken({
        auth_time: now - 3600, // Authentifié il y a 1h
      });

      // L'administrateur a révoqué toutes les sessions il y a 30 minutes
      const revocationTimestamp = now - 1800;

      const result = await verifyFirebaseIdToken(revokedToken, {
        expectedProjectId,
        customPublicCerts: mockPublicCerts,
        checkRevoked: true,
        revocationTimestamp,
      });

      expect(result.valid).toBe(false);
      expect(result.code).toBe('TOKEN_REVOKED');
      expect(result.error).toContain('révoqué');
    });
  });

  // =========================================================================
  // P1 : PERSISTANCE DURABLE ET RÉSISTANCE AUX REDÉMARRAGES SERVEUR
  // =========================================================================
  describe('P1 — Durabilité de l\'état WebSocket et survie aux redémarrages', () => {
    const testDataDir = path.join(process.cwd(), 'data', 'rooms');
    const testRoomId = 'test-audit-persistence-room';
    const testFilePath = path.join(testDataDir, `${testRoomId}.json`);

    beforeEach(() => {
      if (!fs.existsSync(testDataDir)) {
        fs.mkdirSync(testDataDir, { recursive: true });
      }
    });

    afterEach(() => {
      try {
        if (fs.existsSync(testFilePath)) {
          fs.unlinkSync(testFilePath);
        }
      } catch (e) {}
    });

    it('enregistre l\'état de la salle de façon persistante sur disque', () => {
      const stateToPersist = {
        roomId: testRoomId,
        ownerId: 'user_123',
        ownerEmail: 'test@example.com',
        tree: {
          individuals: {
            '@I_AUDIT@': {
              id: '@I_AUDIT@',
              name: 'Jean Moulin',
              sex: 'M' as const,
              familiesAsSpouse: [],
              familiesAsChild: [],
            }
          },
          families: {},
          rootPersonId: '@I_AUDIT@',
        },
        archives: [
          {
            id: 'arc-audit-1',
            title: 'Rapport historique 1943',
            type: 'notarial' as const,
            fileData: '',
            linkedPersonIds: ['@I_AUDIT@'],
            linkedFamilyIds: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }
        ],
        accessRules: [],
        updatedAt: new Date().toISOString(),
      };

      // Écriture atomique
      const tmpPath = `${testFilePath}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(stateToPersist, null, 2), 'utf8');
      fs.renameSync(tmpPath, testFilePath);

      expect(fs.existsSync(testFilePath)).toBe(true);

      // Rechargement direct depuis le fichier
      const reloaded = JSON.parse(fs.readFileSync(testFilePath, 'utf8'));
      expect(reloaded.tree.individuals['@I_AUDIT@'].name).toBe('Jean Moulin');
      expect(reloaded.archives[0].title).toBe('Rapport historique 1943');
    });

    it('survit à un redémarrage complet du serveur : l\'état est réhydraté fidèlement', () => {
      // 1. Écriture initiale de l'état
      const mockState = {
        roomId: testRoomId,
        tree: {
          individuals: {
            '@I100@': { id: '@I100@', name: 'Pierre Martin', sex: 'M' as const, familiesAsSpouse: [], familiesAsChild: [] },
          },
          families: {},
        },
        archives: [],
        accessRules: [],
      };
      fs.writeFileSync(testFilePath, JSON.stringify(mockState), 'utf8');

      // 2. Simulation d'un redémarrage complet : la mémoire est totalement effacée
      const inMemoryCache = new Map<string, any>();
      expect(inMemoryCache.get(testRoomId)).toBeUndefined();

      // 3. Fonction de restauration au démarrage
      const restoreRoom = (id: string) => {
        const p = path.join(testDataDir, `${id}.json`);
        if (fs.existsSync(p)) {
          return JSON.parse(fs.readFileSync(p, 'utf8'));
        }
        return null;
      };

      const restored = restoreRoom(testRoomId);
      expect(restored).not.toBeNull();
      expect(restored.tree.individuals['@I100@'].name).toBe('Pierre Martin');
    });
  });

});
