# 📝 CHANGELOG.md — Journal des Modifications

Toutes les modifications notables apportées au projet **Genealogor** sont consignées dans ce fichier.
Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/), et ce projet adhère au [Semantic Versioning](https://semver.org/lang/fr/).

---

## [1.2.0] — 2026-10-15

### 🌟 Ajouté
- **Système Interactif de Marquage de Personnes sur Photos (Photo Tagging)** :
  - **Repérage direct sur les photographies et scans** : Possibilité de cliquer sur n'importe quelle zone d'un cliché (visage, personne assise/debout) pour placer une étiquette interactive avec coordonnées relatives proportionnelles en pourcentage.
  - **Liaison directe avec l'arbre familial** : Boîte de recherche instantanée pour rattacher le tag à n'importe quel individu de l'arbre généalogique avec indication de son sexe, patronyme et dates de vie.
  - **Infobulles riches & interactives au survol** : Affichage d'une carte d'identité flottante présentant le nom complet, les dates de vie, le rôle ou la précision (ex : *« Assis au centre, 82 ans »*), et un bouton d'accès direct vers sa fiche.
  - **Navigation instantanée vers la fiche ancêtre** : Un clic sur un repère photo ouvre immédiatement la fiche généalogique complète de la personne concernée.
  - **Galerie des photographies identifiées dans la fiche individu (`ProfileView`)** :
    - Nouvelle section dédiée présentant toutes les photographies d'époque où la personne a été marquée, avec vignette haute résolution, badge de positionnement visuel (`✓`) et rôle contextuel.
    - Clic sur une photo depuis la fiche individuelle pour l'ouvrir immédiatement dans l'atelier archives (`ArchivesView`) centrée sur la photo avec les repères activés.
  - **Typologie 'photo' & filtrage d'archives** : Intégration de la typologie *« Photographie / Portrait »* dans le catalogue et ajout d'un filtre rapide *« Photos »*.
  - **Cliché de démonstration enrichi** : Ajout d'un portrait de famille d'époque (1912) avec repères interactifs préconfigurés sur Louis Martin, Henri Martin et Jeanne Martin.
  - **Synchronisation automatique** : Les identifiants des personnes tagguées sont automatiquement répercutés dans `linkedPersonIds` et synchronisés en temps réel via Firestore et le relais local.

---

## [1.1.0] — 2026-10-14

### 🌟 Ajouté
- **Studio d'Archives Numérisées Haute Définition** :
  - Support de l'importation de documents d'archives numérisés (actes de baptême/naissance, mariage, décès/sépulture, recensements, fiches matricules, actes notariés).
  - Visionneuse d'actes haute définition avec zoom fluide, translation panoramique et rotation à 90°, 180° et 270°.
  - Outils d'aide à la paléographie : filtres de contraste renforcé et inversion négative pour la lecture des encres délavées.
  - Convertisseur bidirectionnel du calendrier républicain français (1792–1805) avec prise en compte des années sextiles et des Sans-culottides.
  - Module d'association manuelle des actes aux fiches individuelles et conjugales de l'arbre.
- **Partage Sécurisé par Branche & Liens Privés** :
  - Génération de liens d'invitation uniques avec délimitation du périmètre (*Branche Paternelle*, *Branche Maternelle*, ou *Arbre Complet*).
  - Protection par mot de passe partagé de branche permettant aux proches d'accéder sans obligation de compte Google ou adresse Gmail.
  - Définition de rôles granulaires : *Lecteur*, *Éditeur / Contributeur*, *Administrateur*.
  - Écran de déverrouillage par mot de passe (`PassphraseScreen`) élégant et ergonomique.
- **Collaboration Temps Réel & Présence** :
  - Serveur de relais WebSocket (`server.ts`) avec support des salles virtuelles isolées par famille.
  - Détection en direct des pairs connectés et indicateur de présence dans la barre de navigation.
  - File d'attente hors-ligne (`PendingQueue`) rejouant automatiquement les modifications lors de la reconnexion.
- **Sauvegarde Complète & Fusion Intelligente** :
  - Exportation / Importation d'une archive intégrale chiffrée (arbre + actes numérisés + règles d'accès) avec empreinte de contrôle SHA-256.
  - Assistant de fusion pour résoudre les doublons d'individus avec comparaison attribut par attribut.
- **Documentation et Visuels** :
  - Capture d'écran représentative du studio et de l'arbre généré dans `docs/preview.jpg`.
  - Création du `README.md` enrichi avec badges, icônes et présentation fonctionnelle.
  - Rédaction du document de référence `CONTEXT.md` regroupant les décisions d'architecture (ADR).

### ⚡ Modifié
- **Règles de Sécurité Firestore (`firestore.rules`)** :
  - Renforcement du modèle ABAC zéro-trust sur la collection `/trees/{treeId}` et ses sous-collections.
  - Attribution des privilèges administrateur pour l'adresse vérifiée `jeanpierre.nouhailler@gmail.com`.
  - Tolérance aux vérifications sur documents inexistants (`resource == null`) pour éviter les faux positifs d'autorisation.
- **Cycle de Vie et Abonnements Réactifs (`App.tsx` & `firestore-sync.ts`)** :
  - Conditionnement strict de l'instanciation des écouteurs Firestore (`onSnapshot`) à l'état `authReady && currentUser`.
  - Initialisation automatique et transparente de l'arbre distant lors de la première connexion de l'administrateur.
  - Sécurisation des signatures des fonctions de persistance (`saveArchiveToFirestore`, `deleteArchiveFromFirestore`, `saveAccessToFirestore`) avec vérification de l'utilisateur authentifié.

### 🐛 Corrigé
- **Résolution des erreurs de permission Firestore** :
  - Élimination des exceptions `Missing or insufficient permissions` au démarrage lorsque l'utilisateur n'est pas encore connecté.
- **Corrections de typage TypeScript** :
  - Correction de l'accès invalide à la propriété `place` dans `MergeModal.tsx` (`personB.birth.place`).
  - Cast explicite du sel cryptographique vers `BufferSource` dans `crypto.ts` pour conformité stricte avec les définitions Web Crypto API.
  - Validation du compilateur TypeScript (`tsc --noEmit`) avec 0 erreur.

---

## [1.0.0] — 2026-10-13

### 🚀 Initialisation
- Reprise du projet Genealogor et migration vers une stack moderne React 19 + TypeScript + Vite + Tailwind CSS.
- Arbre généalogique interactif avec ascendance, descendance et numérotation Sosa-Stradonitz.
- Fiches biographiques avec événements de vie et visualisations annexes (frise historique, carte de migration, statistiques).
- Parseur et sérialiseur GEDCOM 5.5.1 conformes aux standards de l'industrie généalogique.
- Configuration initiale de Firebase Firestore et Express en mode serveur unifié.
