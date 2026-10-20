# 📝 CHANGELOG.md — Journal des Modifications

Toutes les modifications notables apportées au projet **Genealogor** sont consignées dans ce fichier.
Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/), et ce projet adhère au [Semantic Versioning](https://semver.org/lang/fr/).

## [2.5.0] — 2026-10-20

### 🌟 Ajouté
- **🍔 Menu Hamburger ergonomique par Catégories** :
  - Nouveau tiroir latéral interactif accessible depuis la barre supérieure (`HamburgerMenu.tsx`).
  - Catégorisation claire en 4 pôles : *Exploration & Visualisation* (Arbre, Fiches, Archives, Frise, Carte, Statistiques), *Partage & Collaboration* (Partage par branche, Relais WebSocket, Cloud Firestore), *Données & Sauvegardes* (GEDCOM 5.5.1, Sauvegarde chiffrée AES-GCM, Restauration), *Paramètres & Accessibilité*.
- **⚙️ Paramètres Système & Mises à Jour Automatiques en Arrière-Plan** :
  - Modale dédiée `SystemSettingsModal.tsx` affichant la date de release officielle (*20 octobre 2026*) et l'horodatage précis de la dernière vérification.
  - Bouton **« Vérifier les mises à jour »** avec contournement du cache navigateur (`/api/system/version`).
  - Bouton **« Forcer la mise à jour »** purgeant les caches locaux du Service Worker (`caches.delete`) et réenregistrant les workers sans toucher aux données locales.
  - Service d'arrière-plan autonome `VersionService` vérifiant périodiquement les nouvelles versions selon un intervalle paramétrable et à chaque reprise d'activité d'onglet.
- **🌙 Thème Sombre Intégral (Dark Mode)** :
  - Implémentation complète du Dark Mode avec support natif Tailwind CSS (`dark:` classes).
  - Palette soignée : `#121418` pour les fonds, `#1A1D24` pour les cartes et modales, et bordures adoucies en `dark:border-stone-800`.
  - Bascule instantanée à 3 états : Clair, Sombre et Automatique (détection de `prefers-color-scheme`).
- **⚖️ Onboarding avec Clause d'Exonération de Responsabilité Légale** :
  - Dialogue de premier accueil `OnboardingModal.tsx` imposant la lecture et l'acceptation d'une clause de non-responsabilité juridique formelle stipulant expressément que l'auteur et l'éditeur ne sauraient être tenus responsables des données saisies ou importées par les utilisateurs.
- **💡 Onboarding Contextuel & Infobulles par Écran** :
  - Composant `ContextualGuide.tsx` fournissant un bandeau explicatif pliable sur chaque écran (`tree`, `profile`, `archives`, `timeline`, `map`, `stats`) avec conseils méthodologiques.
  - Composant `InfoTooltip.tsx` déployé sur tous les contrôles clés (numérotation Sosa, recherche, profondeur de générations, modes d'arbre, formats de dates, champs biographiques).
- **📲 Bouton « Installer l'application » (PWA)** :
  - Bouton interactif `PwaInstallButton.tsx` détectant l'événement `beforeinstallprompt` pour installer Genealogor directement sur l'écran d'accueil mobile ou desktop en un clic.
- **🎨 Logo Héraldique & Documentation Visuelle** :
  - Logo SVG vectoriel doré et héraldique (`/logo.svg`).
  - Intégration de la capture d'écran de l'application dans la documentation (`docs/app_screenshot.png`).

### 🛡️ Sécurité & Résilience Firestore (P1)
- **Contrôle Strict des Statuts d'Écriture Firestore (`server.ts` & `firestore-sync-action.ts`)** :
  - Vérification systématique du code HTTP `res.ok` sur chaque document de règle d'accès synchronisé.
  - Interruption immédiate et signalement explicite d'erreur en cas d'échec partiel (sans annoncer de synchronisation complète abusive).
  - Suppression physique et marquage effectif des règles révoquées dans Firestore (`revoked: true`).
  - Validation par 114 tests unitaires sous Vitest.

---

## [1.3.0] — 2026-10-15

### 🛡️ Sécurité, Audit & Chiffrement Renforcé
- **Audit & Validation des 6 Piliers de Contrôle Qualité** :
  - **1. Règles Firestore & Isolation multi-familles** : Validation des règles ABAC zéro-trust garantissant l'étanchéité absolue entre familles (tests unitaires dans `firestore-rules-isolation.test.ts`).
  - **2. Résilience Hors-Ligne & Local-First** : Persistance versionnée avec gestionnaire `v2.0.0`, protection contre les corruptions de données avec sauvegarde d'urgence, et replay des modifications via file d'attente `PendingQueue`.
  - **3. Chiffrement Réel des Sauvegardes Exportées** : Implémentation du chiffrement symétrique **AES-GCM 256 bits** avec dérivation **PBKDF2** (100k itérations, SHA-256) pour les fichiers `.genealogor.json`, détection et rejet propre des mauvaises phrases secrètes sans altération de l'état, et sauvegarde de secours pré-restauration pour annulation en un clic.
  - **4. Compatibilité Multi-Logiciels GEDCOM 5.5.1** : Prise en charge éprouvée des exports de **Geneanet, Heredis, Geneatique, MyHeritage, FamilySearch**, incluant les sources d'archives (`TITL`, `AUTH`), les médias (`OBJE`, `FILE`), les familles recomposées à conjoints multiples, les dates approximatives (`VERS`, `BET`, `AVANT`, `APRES`) et la préservation intégrale des balises propriétaires.
  - **5. Confidentialité Étanche des Contemporains** : Protection systématique des personnes nées il y a moins de 100 ans étendue à toutes les vues (Arbre, Fiches, Frise, Carte, Stats), mais aussi à l'atelier d'archives, aux exports GEDCOM et aux flux temps réel (`[Privé]`, `[Confidentiel]`).
  - **6. Suite de Tests Automatisés & Build** : 38 tests unitaires automatisés sous Vitest validés avec 100 % de succès et compilation de production propre.

- **Sécurité TLS WebSocket en Production (`wss://`) & Autorisation de Salle** :
  - Détection automatique et bascule vers **`wss://`** dès que l'application est consultée sous HTTPS.
  - Transmission du jeton d'autorisation de branche (`roomToken`) lors du message `join`.
  - Contrôle d'accès et limitation de débit (rate limit) à 60 messages / 10s côté serveur Express.

---

## [1.2.0] — 2026-10-15

### 🌟 Ajouté
- **Système Interactif de Marquage de Personnes sur Photos (Photo Tagging)** :
  - **Repérage direct sur les photographies et scans** : Clic sur n'importe quelle zone d'un cliché (visage, personne assise/debout) pour placer une étiquette interactive avec coordonnées relatives proportionnelles en pourcentage.
  - **Liaison directe avec l'arbre familial** : Boîte de recherche instantanée pour rattacher le tag à n'importe quel individu de l'arbre généalogique avec indication de son sexe, patronyme et dates de vie.
  - **Infobulles riches & interactives au survol** : Affichage d'une carte d'identité flottante présentant le nom complet, les dates de vie, le rôle ou la précision contextuelle, et un bouton d'accès direct vers sa fiche.
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
  - File d'attente hors-ligne (`PendingQueue`) rejouant automatiquement les modifications lors de la reconexion.
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
