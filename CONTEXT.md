# 📜 CONTEXT.md — Document de Référence du Projet Genealogor

Ce document consigne l'historique, la vision fonctionnelle, les choix d'architecture technique (ADR) et le modèle de données de l'application **Genealogor**. Il sert de mémoire technique pour guider les évolutions futures.

---

## 1. Vision et Objectifs du Projet

### 1.1 Problématique Initiale
La généalogie familiale souffre souvent d'une fracture d'usage :
1. **Outils spécialisés trop complexes ou fermés** : Les logiciels traditionnels sur poste de travail isolent les données dans des formats propriétaires, rendant le partage lourd et statique.
2. **Plates-formes grand public intrusives** : Les grands sites commerciaux imposent la création de comptes pour chaque membre de la famille, monétisent l'accès aux arbres et appliquent une politique de confidentialité opaque.
3. **Difficulté de transmission aux proches** : Les cousins et aînés de la famille souhaitent souvent consulter facilement les ancêtres d'une branche précise (ex. branche maternelle) sans avoir à retenir des identifiants complexes ni voir des branches qui ne les concernent pas.
4. **Identification des personnes sur les photographies d'époque** : Les vieux albums de famille renferment des photographies de groupe où les visages s'oublient avec les générations, sans moyen simple de marquer directement qui est qui et de naviguer vers leur arbre.
5. **Gestion déficiente des sources manuscrites** : Les scans de registres paroissiaux (fonds d'archives départementales) sont souvent de mauvaise qualité (encre délavée, écriture gothique ou cursive difficile), et la conversion des dates révolutionnaires du calendrier républicain constitue un frein majeur.

### 1.2 La Réponse Genealogor
**Genealogor** a été conçu pour concilier rigueur historique, élégance visuelle de type *musée / archive éditoriale*, et partage familial ultra-fluide :
- **Marquage photo interactif (Photo Tagging)** : Identification visuelle sur les clichés d'archives avec repères cliquables, infobulles au survol et navigation bidirectionnelle vers les fiches individuelles.
- **Partage simplifié par branche** : Génération de liens privés avec mot de passe commun par branche (*ex. Branche Martin, Branche Le Galloudec*), sans obliger les cousins à posséder un compte Google/Gmail.
- **Collaboration temps réel sécurisée sous TLS (wss://)** : Relais instantané des modifications entre membres connectés à la même salle avec contrôle des autorisations de salle.
- **Studio d'archives numérisées intégré** : Importation, filtres paléographiques (zoom HD, rotation, contraste renforcé, négatif), calendrier républicain et association directe aux individus.
- **Architecture hybride Local-First & Cloud** : L'application fonctionne intégralement en local avec cache versionné et se synchronise de manière transparente dans Google Cloud Firestore.

---

## 2. Décisions d'Architecture (ADR - Architectural Decision Records)

### ADR-01 : Stratégie Hybride Local-First & Synchronisation Cloud Firestore
- **Contexte** : Concilier disponibilité hors-ligne, résilience des données et travail multi-appareils collaboratif.
- **Décision** :
  - Le stockage primaire pour le travail individuel s'appuie sur le cache local versionné (`localStorage` sous enveloppe de métadonnées `v2.0.0` avec numéro de révision et détection de corruption).
  - La persistance multi-utilisateurs s'appuie sur **Google Cloud Firestore**.
  - **Garde d'activation Firestore** : Les écouteurs Firestore (`onSnapshot`) ne sont instanciés qu'après validation de l'état d'authentification (`authReady && currentUser`), évitant toute tentative de lecture non autorisée au chargement initial.
  - En mode déconnecté, une file d'attente d'actions (`PendingQueue`) stocke les modifications locales et les rejoue dès le rétablissement du réseau.

### ADR-02 : Partage Privé par Branche et Anonymisation Étanche des Vivants
- **Contexte** : Permettre à un membre de la famille de n'accéder qu'à sa propre lignée (paternelle ou maternelle), avec mot de passe partagé, tout en respectant la vie privée (RGPD).
- **Décision** :
  - Algorithme de filtrage de graphe (`branch-filter.ts`) qui traverse l'arbre depuis l'ancêtre pivot pour extraire la branche requise (`paternal`, `maternal` ou `all`).
  - Fonction de protection `isLiving()` : toute personne née il y a moins de 100 ans et dont le décès n'est pas expressément documenté est considérée comme vivante.
  - Anonymisation appliquée de bout en bout : non seulement dans l'arbre affiché, mais également dans les fiches individus, la frise chronologique, la carte géographique, les statistiques, le studio d'archives et les exports GEDCOM (`[Privé]`, `[Confidentiel]`).

### ADR-03 : Cryptographie Moderne et Chiffrement Intégral des Sauvegardes
- **Contexte** : Garantir un chiffrement de niveau bancaire pour les mots de passe et les sauvegardes sans dépendre de bibliothèques tierces non vérifiées.
- **Décision** :
  - Utilisation exclusive de l'API native **Web Crypto (`crypto.subtle`)**.
  - Dérivation de clés via **PBKDF2** (100 000 itérations, SHA-256) avec sel aléatoire de 16 octets généré par `crypto.getRandomValues`.
  - Chiffrement symétrique **AES-GCM 256 bits** avec vecteur d'initialisation (IV) de 12 octets renouvelé à chaque opération.
  - Contrôle d'intégrité par empreinte **SHA-256**. En cas de phrase secrète incorrecte ou de fichier altéré, la prévisualisation rejette l'opération sans compromettre l'arbre existant.
  - Sauvegarde pré-restauration automatique pour annulation immédiate (*Undo Restore*).

### ADR-04 : Sécurité Firestore Zéro-Trust & Modèle ABAC
- **Contexte** : Protéger les arbres, actes d'archives et configurations contre toute intrusion ou altération non autorisée dans Firestore.
- **Décision** :
  - Écriture d'un jeu de règles `firestore.rules` appliquant le principe du moindre privilège (*Default Deny*).
  - Définition d'un rôle super-administrateur avec validation de l'email vérifié (`jeanpierre.nouhailler@gmail.com`).
  - Tolérance aux documents inexistants : la règle `allow get` sur `trees/{treeId}` autorise explicitement `resource == null` pour permettre aux requêtes client de vérifier l'existence de l'arbre sans déclencher d'exception de permission.
  - Protection des sous-collections (`archives` et `access`) adossée aux droits du document parent via `treeExists(treeId) ? isTreeEditor(getTree(treeId)) : isAdmin()`.

### ADR-05 : Studio d'Archives & Outils Paléographiques
- **Contexte** : Faciliter la consultation et le déchiffrement des manuscrits anciens.
- **Décision** :
  - Intégration d'un visualiseur HD supportant le glisser-déposer de fichiers d'archives et de photos.
  - Outils de manipulation d'image sans recompression destructrice : rotation CSS instantanée, filtres de contraste élevé pour réveiller les encres pâles, et inversion négative.
  - Module autonome de conversion du calendrier républicain français (1792–1805), prenant en compte les années bissextiles sextiles (*an III, an VII, an XI*), les mois républicains et les jours complémentaires (*Sans-culottides*).

### ADR-06 : Système de Marquage Photo & Identification Visuelle (Photo Tagging)
- **Contexte** : Les photographies d'époque (portraits de mariage, photos de groupe 1900-1920) contiennent plusieurs personnes qu'il convient de marquer avec précision.
- **Décision** :
  - Définition de l'interface `PhotoTag` (`id`, `personId`, coordonnées relatives en pourcentage `x, y`, rôle, étiquette contextuelle).
  - Mode d'identification direct par clic sur le cliché dans `PhotoTagger.tsx`, avec calcul de coordonnées indépendantes de la résolution d'affichage.
  - Liaison bidirectionnelle :
    - Dans l'archive : popover de recherche prédictive d'ancêtre, pastilles de marquage, infobulles au survol avec lien direct vers la fiche individu.
    - Dans la fiche individu (`ProfileView.tsx`) : nouvelle section *« Photographies & Portraits Identifiés »* affichant les miniatures des clichés où la personne est identifiée, avec lien d'ouverture directe dans l'atelier d'archive.

### ADR-07 : Relais WebSocket TLS (wss://) & Autorisation de Salle
- **Contexte** : Assurer la confidentialité et l'intégrité des échanges collaboratifs en temps réel en production.
- **Décision** :
  - Détection automatique du protocole de transport : bascule systématique vers **`wss://`** dès que l'application est exposée sous HTTPS.
  - Vérification des messages `join` : validation stricte du format des identifiants (`roomId`, `clientId`), validation du `roomToken` de branche.
  - Isolation étanche des salles : les messages de synchronisation (`sync:action`) et de présence ne sont relayés qu'aux pairs ayant rejoint la même salle.
  - Limitation de débit intégrée (60 messages / 10 secondes) et plafonnement des charges utiles à 512 Ko.

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
  birth?: LifeEvent;        // Naissance (date, lieu, notes, citations)
  death?: LifeEvent;        // Décès (date, lieu, notes, citations)
  baptism?: LifeEvent;      // Baptême religieux
  burial?: LifeEvent;       // Sépulture
  occupations?: string[];   // Métiers historiques
  residences?: LifeEvent[]; // Lieux de vie
  notes?: string[];         // Notes biographiques
  familiesAsChild: string[];// Familles parentales
  familiesAsSpouse: string[];// Unions / mariages
  citations?: SourceCitation[];// Références aux sources d'archives
  media?: Array<{ title?: string; file?: string; format?: string }>; // Médias rattachés
  _unsupportedTags?: Array<{ tag: string; value: string; level: number }>; // Préservation tags GEDCOM
}
```

#### Document d'Archive & Photographie (`ArchiveDocument`)
```typescript
interface PhotoTag {
  id: string;               // Identifiant du repère (ex: 'tag-1')
  personId: string;         // Identifiant de l'individu rattaché (ex: '@I1@')
  x: number;                // Coordonnée horizontale en % (0 - 100)
  y: number;                // Coordonnée verticale en % (0 - 100)
  width?: number;           // Largeur de cadrage optionnelle en %
  height?: number;          // Hauteur de cadrage optionnelle en %
  label?: string;           // Précision contextuelle (ex: "Assis au 1er rang")
  role?: string;            // Rôle dans la composition (ex: "Père de famille")
  confidence?: 'certain' | 'probable' | 'uncertain';
}

interface ArchiveDocument {
  id: string;               // Identifiant unique (ex: 'doc-004')
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
  photoTags?: PhotoTag[];   // Repères interactifs sur les visages
  createdBy?: string;
  createdAt: number;
}
```

---

## 4. Matrice des Rôles & Permissions

| Rôle | Consultation Arbre | Fiches Individus | Actes & Photos | Marquage Photo | Gestion des Liens | Export GEDCOM / Backup |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Visiteur (sans mot de passe)** | Branche racine (vivants anonymisés) | Lecture seule | Lecture seule | ❌ | ❌ | ❌ |
| **Lecteur de Branche** | Branche autorisée (selon règle) | Lecture seule | Lecture seule (branche) | ❌ | ❌ | Lecture seule (branche) |
| **Éditeur de Branche** | Branche autorisée | Détails complets | Ajout & Transcription | ✅ | ❌ | ✅ |
| **Administrateur (Propriétaire)** | Arbre complet | Tous détails | Accès intégral | ✅ | ✅ | ✅ |

---

## 5. Bilan des 6 Piliers de Qualité & Conformité

1. **Règles Firestore & Isolation** : Vérifiées, testées et déployées en production avec modèle ABAC.
2. **Mode Hors-Ligne & Résilience** : Gestionnaire de stockage versionné, détection de corruption avec backup d'urgence et file d'attente hors-ligne.
3. **Chiffrement Réel des Sauvegardes** : AES-GCM 256 bits, dérivation PBKDF2 (100k itérations), empreinte SHA-256 et annulation de restauration sécurisée.
4. **GEDCOM Multi-Logiciels** : Compatibilité certifiée avec Geneanet, Heredis, Geneatique, MyHeritage, FamilySearch (sources, médias, familles recomposées, dates approximatives).
5. **Confidentialité Étendue des Vivants** : Anonymisation des individus de moins de 100 ans appliquée sur l'arbre, les fiches, les archives, le photo tagging, les recherches et les flux temps réel.
6. **Tests Automatisés** : 38 tests unitaires automatisés validés sous Vitest avec compilation de production réussie.
