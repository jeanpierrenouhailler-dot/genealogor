# 📜 CONTEXT.md — Document de Référence du Projet Genealogor

Ce document consigne l'historique, la vision fonctionnelle, les choix d'architecture technique (ADR) et le modèle de données de l'application **Genealogor**. Il sert de mémoire technique pour guider les évolutions futures.

---

## 1. Vision et Objectifs du Projet

### 1.1 Problématique Initiale
La généalogie familiale souffre souvent d'une fracture d'usage :
1. **Outils spécialisés trop complexes ou fermés** : Les logiciels traditionnels sur poste de travail isolent les données dans des formats propriétaires, rendant le partage lourd et statique.
2. **Plates-formes grand public intrusives** : Les grands sites commerciaux imposent la création de comptes pour chaque membre de la famille, monétisent l'accès aux arbres et appliquent une politique de confidentialité opaque.
3. **Difficulté de transmission aux proches** : Les cousins et aînés de la famille souhaitent souvent consulter facilement les ancêtres d'une branche précise (ex. branche maternelle) sans avoir à retenir des identifiants complexes ni voir des branches qui ne les concernent pas.
4. **Gestion déficiente des sources manuscrites** : Les scans de registres paroissiaux (fonds d'archives départementales) sont souvent de mauvaise qualité (encre délavée, écriture gothique ou cursive difficile), et la conversion des dates révolutionnaires du calendrier républicain constitue un frein majeur.

### 1.2 La Réponse Genealogor
**Genealogor** a été conçu pour concilier rigueur historique, élégance visuelle de type *musée / archive éditoriale*, et partage familial ultra-fluide :
- **Partage simplifié par branche** : Génération de liens privés avec mot de passe commun par branche (*ex. Branche Martin, Branche Le Galloudec*), sans obliger les cousins à posséder un compte Google/Gmail.
- **Collaboration temps réel** : Relais instantané des modifications entre membres connectés à la même salle.
- **Studio d'archives numérisées intégré** : Importation, filtres paléographiques (zoom HD, rotation, contraste renforcé, négatif), calendrier républicain et association directe aux individus.
- **Architecture hybride Local-First & Cloud** : L'application fonctionne intégralement en local avec cache versionné et peut se synchroniser de manière transparente dans Google Cloud Firestore.

---

## 2. Décisions d'Architecture (ADR - Architectural Decision Records)

### ADR-01 : Stratégie Hybride Local-First & Synchronisation Cloud Firestore
- **Contexte** : L'utilisateur a exprimé le besoin de stockage local chiffré tout en permettant la collaboration en temps réel et la sauvegarde en ligne.
- **Décision** :
  - Le stockage primaire pour le travail individuel s'appuie sur le cache local versionné (`localStorage` / `IndexedDB` avec enveloppe de métadonnées et intégrité).
  - La persistance multi-utilisateurs et la sauvegarde distante s'appuient sur **Google Cloud Firestore**.
  - **Garde d'activation Firestore** : Les écouteurs Firestore (`onSnapshot`) ne sont instanciés qu'après validation de l'état d'authentification (`authReady && currentUser`), évitant toute tentative de lecture non autorisée au chargement initial.
  - En mode déconnecté, une file d'attente d'actions (`PendingQueue`) stocke les modifications locales et les rejoue dès le rétablissement du réseau.

### ADR-02 : Partage Privé par Branche et Anonymisation des Personnes Vivantes
- **Contexte** : Permettre à un membre de la famille de n'accéder qu'à sa propre lignée (paternelle ou maternelle), avec mot de passe partagé, tout en respectant la vie privée (RGPD).
- **Décision** :
  - Algorithme de filtrage de graphe (`branch-filter.ts`) qui traverse l'arbre depuis l'ancêtre pivot pour extraire la branche requise (`paternal`, `maternal` ou `all`).
  - Fonction de protection `isLiving()` : toute personne née il y a moins de 100 ans et dont le décès n'est pas expressément documenté est considérée comme vivante. Ses dates précises, lieux et notes privées sont automatiquement masqués pour les accès visiteurs et tiers.
  - Validation du mot de passe de branche réalisée localement via dérivation sécurisée sans exposer les données des autres branches.

### ADR-03 : Cryptographie Moderne et Respect de la Web Crypto API
- **Contexte** : Garantir un chiffrement de niveau bancaire pour les mots de passe et les exports sans dépendre de bibliothèques tierces obsolètes ou vulnérables.
- **Décision** :
  - Utilisation exclusive de l'API native **Web Crypto (`crypto.subtle`)**.
  - Dérivation de clés via **PBKDF2** (100 000 itérations, SHA-256) avec sel aléatoire de 16 octets généré par `crypto.getRandomValues`.
  - Chiffrement symétrique **AES-GCM 256 bits** avec vecteur d'initialisation (IV) de 12 octets renouvelé à chaque opération.
  - Format de conteneur versionné `v2:<base64(salt + iv + ciphertext)>`.

### ADR-04 : Sécurité Firestore Zéro-Trust & Modèle ABAC
- **Contexte** : Protéger les arbres, actes d'archives et configurations contre toute intrusion ou altération non autorisée dans Firestore.
- **Décision** :
  - Écriture d'un jeu de règles `firestore.rules` appliquant le principe du moindre privilège (*Default Deny*).
  - Définition d'un rôle super-administrateur avec validation de l'email vérifié (`jeanpierre.nouhailler@gmail.com`).
  - Tolérance aux documents inexistants : la règle `allow get` sur `trees/{treeId}` autorise explicitement `resource == null` pour permettre aux requêtes client de vérifier l'existence de l'arbre sans déclencher d'exception de permission.
  - Protection des sous-collections (`archives` et `access`) adossée aux droits du document parent via `treeExists(treeId) ? isTreeEditor(getTree(treeId)) : isAdmin()`.

### ADR-05 : Studio d'Archives & Outils Paléographiques
- **Contexte** : Les généalogistes travaillent continuellement avec des manuscrits anciens difficiles à déchiffrer.
- **Décision** :
  - Intégration d'un visualiseur HD supportant le glisser-déposer de fichiers.
  - Outils de manipulation d'image sans recompression destructrice : rotation CSS instantanée, filtres de contraste élevé pour réveiller les encres pâles, et inversion négative.
  - Module autonome de conversion du calendrier républicain français (1792–1805), prenant en compte les années bissextiles sextiles (*an III, an VII, an XI*), les mois républicains (30 jours chacun) et les jours complémentaires (*Sans-culottides*).

---

## 3. Modèle de Données

### 3.1 Entités Principales (`src/types/genealogy.ts`)

#### Individu (`Individual`)
```typescript
interface Individual {
  id: string;               // Identifiant unique (ex: '@I1@')
  name: string;             // Nom complet d'usage (ex: "Pierre MARTIN")
  givenName?: string;       // Prénoms (ex: "Pierre Jean-Baptiste")
  surname?: string;         // Patronyme de naissance (ex: "MARTIN")
  sex: 'M' | 'F' | 'X';     // Sexe biologique
  birth?: LifeEvent;        // Naissance (date, lieu, notes)
  death?: LifeEvent;        // Décès (date, lieu, cause)
  baptism?: LifeEvent;      // Baptême religieux
  burial?: LifeEvent;       // Sépulture
  occupation?: string;      // Métier / Profession historique
  residence?: string;       // Domicile principal
  notes?: string[];         // Notes biographiques
  familyAsChild?: string;   // Référence à la famille parentale
  familyAsSpouse?: string[];// Références aux unions / mariages
}
```

#### Document d'Archive & Photographie (`ArchiveDocument`)
```typescript
interface PhotoTag {
  id: string;               // Identifiant du repère (ex: 'tag-1')
  personId: string;         // Identifiant de l'individu rattaché (ex: '@I7@')
  x: number;                // Coordonnée horizontale en % (0 - 100)
  y: number;                // Coordonnée verticale en % (0 - 100)
  width?: number;           // Largeur de cadrage optionnelle en %
  height?: number;          // Hauteur de cadrage optionnelle en %
  label?: string;           // Précision contextuelle (ex: "Assis au 1er rang")
  createdAt?: number;
}

interface ArchiveDocument {
  id: string;               // Identifiant unique (ex: 'arch-1742-01')
  title: string;            // Titre descriptif de l'acte ou de la photo
  type: ArchiveDocumentType;// 'birth' | 'marriage' | 'death' | 'photo' | ...
  archiveLocation?: string; // Ex: "Archives Départementales d'Ille-et-Vilaine"
  callNumber?: string;      // Ex: "3 E 142/5 - Vue 42/189" ou cote d'album
  date?: string;            // Date grégorienne ou brute
  republicanDate?: string;  // Ex: "14 Frimaire an II"
  place?: string;           // Commune, paroisse ou atelier photo
  transcription?: string;   // Transcription littérale ou description du cliché
  notes?: string;           // Mentions marginales ou contexte de la prise de vue
  fileData?: string;        // Données d'image (data URL ou URL de stockage)
  linkedPersonIds: string[];// Identifiants des individus rattachés
  photoTags?: PhotoTag[];   // Repères cliquables interactifs sur les visages
  createdBy?: string;
  createdAt: number;
}
```

#### Règle d'Accès de Branche (`BranchAccess`)
```typescript
interface BranchAccess {
  id: string;               // Identifiant unique
  name: string;             // Libellé de la branche (ex: "Cousins côté paternel")
  branch: BranchScope;      // 'paternal' | 'maternal' | 'all'
  role: BranchRole;         // 'viewer' | 'editor' | 'admin'
  password?: string;        // Mot de passe clair (optionnel, pour mémo créateur)
  passwordHash?: string;    // Hachage cryptographique SHA-256
  hideLiving: boolean;      // Masquage automatique des contemporains
  shareToken: string;       // Jeton unique pour l'URL de partage
  createdAt: number;
}
```

---

## 4. Matrice des Rôles & Permissions

| Rôle | Consultation Arbre | Fiches Individus | Actes & Archives | Ajout / Édition | Gestion des Liens | Export GEDCOM |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Visiteur (sans mot de passe)** | Branche racine (vivants masqués) | Lecture seule | Lecture seule | ❌ | ❌ | ❌ |
| **Lecteur de Branche** | Branche autorisée (selon règle) | Lecture seule | Lecture seule | ❌ | ❌ | Lecture seule |
| **Éditeur de Branche** | Branche autorisée | Détails complets | Ajout & Transcription | ✅ | ❌ | ✅ |
| **Administrateur (Propriétaire)** | Arbre complet | Tous détails | Accès intégral | ✅ | ✅ | ✅ |

---

## 5. Perspectives & Évolutions Futures

1. **Reconnaissance optique de caractères (OCR) assistée pour manuscrits anciens** : Assistant de transcription paléographique avec détection des abréviations latines et de l'ancien français.
2. **Synchronisation multilatérale P2P WebRTC Direct** : Partage direct de navigateur à navigateur sans transit serveur pour les fichiers volumineux de haute définition.
3. **Cartographie interactive Leaflet / OpenStreetMap** : Tracé vectoriel des itinéraires migratoires générationnels sur fond de carte de Cassini.
