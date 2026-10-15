# 🌳 Genealogor — Arbre Familial, Archives Numérisées & Marquage Photo

<div align="center">

![Genealogor Interface Principale](docs/preview.jpg)

**Plateforme moderne de généalogie collaborative, studio d'archives paléographiques et partage sécurisé par branche.**

[![TypeScript](https://img.shields.io/badge/TypeScript-7.0-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.0-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.3-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.3-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Firebase](https://img.shields.io/badge/Firebase-Firestore%20%26%20Auth-FFCA28?logo=firebase&logoColor=black)](https://firebase.google.com/)
[![WebSockets](https://img.shields.io/badge/WebSockets-TLS%20(wss%3A%2F%2F)-00ADD8?logo=websocket&logoColor=white)](https://developer.mozilla.org/fr/docs/Web/API/WebSocket)
[![Tests](https://img.shields.io/badge/Tests-38%20passés%20(Vitest)-brightgreen?logo=vitest&logoColor=white)](https://vitest.dev/)
[![License](https://img.shields.io/badge/Licence-Apache%202.0-green.svg)](LICENSE)

[✨ Fonctionnalités](#-fonctionnalités-phares) • [🏷️ Marquage Photo](#-marquage-photo-interactif-photo-tagging) • [🔐 Sécurité & Chiffrement](#-sécurité-et-confidentialité) • [⚡ Temps Réel & TLS](#-collaboration-temps-réel--sécurité-tls) • [🚀 Démarrage](#-démarrage-rapide) • [🧪 Tests & Qualité](#-tests-automatisés--couverture)

</div>

---

## 🌟 Présentation

**Genealogor** est une application web conçue pour les passionnés de généalogie, les historiens familiaux et les familles souhaitant explorer, documenter et transmettre leur lignée.

Alliant l'esthétique soignée d'une publication éditoriale d'archive au dynamisme des outils collaboratifs actuels, Genealogor permet de visualiser les lignées familiales, d'indexer des actes manuscrits anciens, de **marquer les visages sur les photographies d'époque**, et de partager des branches spécifiques avec vos proches via des **liens privés protégés par mot de passe**, sans imposer la création d'un compte obligatoire à vos cousins.

---

## ✨ Fonctionnalités Phares

### 🌿 1. Visualisation & Navigation dans l'Arbre
- **Multi-vues synchronisées** :
  - **Vue Arbre classique & Ascendance** : Arbre généalogique hiérarchique avec numérotation **Sosa-Stradonitz** (de cujus = 1, père = 2n, mère = 2n+1).
  - **Descendance & Fratrie** : Visualisation des unions multiples, familles recomposées et enfants.
  - **Fiche Biographique Individuelle** : Synthèse de vie complète (naissance, baptême, mariage, profession, résidences, décès, sépulture, sources et médias).
  - **Chronologie & Frise Historique** : Mise en perspective des étapes familiales avec les grands repères de l'histoire de France (Révolution, Premier Empire, Guerres mondiales).
  - **Carte Géographique** : Cartographie des migrations et dispersion géographique des ancêtres.
  - **Statistiques Généalogiques** : Âge moyen au mariage, longévité par siècle, répartition des naissances par saison et patronymes fréquents.

---

### 🏷️ 2. Studio d'Archives & Marquage Photo Interactif (Photo Tagging)

<div align="center">
  <img src="docs/photo_tagging.jpg" alt="Atelier de marquage de photographies anciennes" width="85%" style="border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.15);" />
  <p><em>Exemple de photographie ancienne de famille (vers 1912) avec marquage interactif des ancêtres.</em></p>
</div>

- **Repères interactifs sur les visages (Photo Tagging)** :
  - **Mode Identification en un clic** : Cliquez sur n'importe quel visage ou personnage d'une photographie de famille pour ouvrir instantanément le dialogue d'association.
  - **Recherche prédictive dans la généalogie** : Saisissez un prénom ou un patronyme pour relier le repère à un ancêtre existant avec rappel de ses dates et lien de parenté.
  - **Infobulles enrichies au survol** : Affiche le nom, les années de naissance/décès, le rôle sur la photo et un bouton d'accès direct à sa fiche individuelle.
  - **Section dédiée sur la fiche individu** : La section *« Photographies & Portraits Identifiés »* récapitule toutes les photos d'archives où la personne a été identifiée, avec puce visuelle et bouton ouvrant directement le cliché dans l'atelier d'archive.
  - **Synchronisation automatique** : L'ajout ou la suppression d'un tag maintient l'intégrité de la liste `linkedPersonIds` du document.

- **Outils d'examen visuel & paléographique** :
  - Zoom haute définition fluide jusqu'à 300 % et déplacement panoramique.
  - Rotation à 90°, 180° et 270° pour les registres numérisés à l'horizontale.
  - Filtres d'amélioration de lecture : Contraste renforcé, Négatif et Nuances de gris (idéal pour les écritures à l'encre délavée et les vieux tirages sépia).
  - **Convertisseur Calendrier Républicain** : Conversion instantanée des dates révolutionnaires françaises (1792–1805 : *Vendémiaire, Brumaire, Nivôse...*) en grégorien.

---

### 🔐 3. Partage Sécurisé & Accès par Branche
- **Liens privés personnalisés** :
  - Génération d'URLs uniques par branche (**Branche Paternelle**, **Branche Maternelle**, ou **Arbre Complet**).
- **Protection par mot de passe de branche** :
  - Vos proches saisissent simplement le mot de passe partagé de leur branche pour déverrouiller l'accès.
  - **Aucun compte requis** : accès immédiat en lecture ou suggestion d'ajouts.
- **Niveaux de permissions granulaires** :
  - 👁️ **Lecteur** : Consultation sécurisée de la branche autorisée.
  - ✏️ **Contributeur / Éditeur** : Enrichissement des fiches et import de nouveaux actes.
  - 👑 **Administrateur** : Contrôle complet, gestion des mots de passe, règles d'accès et export.

---

### 🛡️ 4. Sécurité et Confidentialité (6 Piliers de Contrôle)

| Pilier de Contrôle | Mécanisme implémenté | Statut de validation |
| :--- | :--- | :--- |
| **1. Règles Firestore & Isolation** | ABAC strict dans `firestore.rules`. Un utilisateur ne peut ni lire, ni modifier, ni lister l'arbre ou les archives d'une autre famille. Seul l'administrateur ou le propriétaire peut gérer les accès. | ✅ Vérifié et couvert par tests unitaires dédiés |
| **2. Mode Hors-Ligne & Résilience** | Architecture Local-First avec conteneurs versionnés (`v2.0.0`), file d'attente `PendingChange` et reprise automatique sans écrasement concurrentiel. | ✅ Vérifié et couvert par tests de corruption et replay |
| **3. Chiffrement des Sauvegardes** | Sauvegardes complètes au format `.genealogor.json` protégées en **AES-GCM 256 bits** avec dérivation **PBKDF2** (100k itérations), contrôle d'intégrité **SHA-256** et sauvegarde de secours pré-restauration. | ✅ Vérifié avec tests de mauvaises phrases et intégrité |
| **4. Compatibilité GEDCOM Multi-Logiciels** | Standard GEDCOM 5.5.1 testé avec les exports de **Geneanet, Heredis, Geneatique, MyHeritage, FamilySearch**. Prise en charge des familles recomposées, conjoints multiples, dates approximatives (`VERS`, `BET`, `AVANT`, `APRES`), sources et médias `OBJE`. | ✅ Vérifié en aller-retour (round-trip) sans perte |
| **5. Confidentialité des Personnes Vivantes** | Protection active des contemporains (< 100 ans ou sans date de décès). Anonymisation étanche (`[Privé]`, `[Confidentiel]`, suppression des notes et des lieux précis) appliquée sur toutes les vues, les recherches, les exports, les archives et le temps réel. | ✅ Vérifié de bout en bout |
| **6. Tests Automatisés & Build** | Suite complète de 38 tests unitaires avec Vitest, exécution sous TypeScript strict et build de production optimisé via Vite. | ✅ 38/38 tests validés, build réussi |

---

### ⚡ 5. Collaboration Temps Réel & Sécurité TLS

> 🛡️ **Protection des communications en production** :
> 
> En production (accès via HTTPS), la communication WebSocket bascule automatiquement sur **`wss://` (WebSocket Secure sous TLS)** :
> ```typescript
> const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
> const wsUrl = `${protocol}//${window.location.host}/ws`;
> ```
> 
> Chaque client transmet son jeton de partage (`roomToken`) lors du message `join`. Le serveur Express valide le format des identifiants, applique une limitation de débit (rate limiting à 60 msg/10s), vérifie la taille maximale des payloads (512 Ko) et n'autorise la diffusion d'actions (`sync:action`) qu'aux clients authentifiés ayant rejoint la même salle familiale isolée.

---

## 📐 Architecture Technique

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Navigateur Client (React 19)                    │
│                                                                        │
│   ┌────────────────────┐   ┌───────────────────┐   ┌───────────────┐   │
│   │   Vues Arbre &     │   │ Atelier d'Archive │   │  Gestion des  │   │
│   │   Fiches Personnes │   │ & Photo Tagging   │   │ Accès Branche │   │
│   └─────────┬──────────┘   └─────────┬─────────┘   └───────┬───────┘   │
│             │                        │                     │           │
│             ▼                        ▼                     ▼           │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │            Moteur Central & Gestionnaire d'État                │   │
│   │    - Filtre de branche & Anonymisation vivants (effectiveData) │   │
│   │    - Validateur chronologique & Détecteur de cycles            │   │
│   │    - Moteur cryptographique AES-GCM 256 / PBKDF2 / SHA-256    │   │
│   │    - File d'attente hors-ligne & Résilience Local-First        │   │
│   └───────────────┬────────────────────────────┬───────────────────┘   │
└───────────────────┼────────────────────────────┼───────────────────────┘
                    │                            │
      wss:// (TLS)  ▼                            ▼  HTTPS SDK v13
   ┌────────────────────────────────┐   ┌────────────────────────────────┐
   │    Serveur Node.js / Express   │   │     Google Cloud Firestore     │
   │                                │   │                                │
   │  - Relais WebSocket TLS (wss)  │   │  - Arbres (/trees/{id})        │
   │  - Autorisation des salles     │   │  - Archives numérisées         │
   │  - Rate limiting & assainisse- │   │  - Règles ABAC Zero-Trust      │
   │    ment des messages           │   │  - Isolation multi-familles    │
   └────────────────────────────────┘   └────────────────────────────────┘
```

---

## 🛠️ Pile Technologique

| Domaine | Technologie | Rôle |
| :--- | :--- | :--- |
| **Frontend** | React 19 + TypeScript 7 | Interface utilisateur réactive et typage strict sans concession |
| **Bundler & Build** | Vite 8 + TSX | Compilation instantanée, middlewares de dev et build optimisé |
| **Design System** | Tailwind CSS 4 + Lucide Icons | Typographie éditoriale, thème parchemin musée (`#FBF9F5`) |
| **Backend & Temps Réel** | Express 4 + ws (WebSockets TLS) | Serveur applicatif, relais sécurisé et synchronisation multi-utilisateurs |
| **Persistance Cloud** | Firebase Firestore (SDK v13) | Stockage distribué des arbres généalogiques et fonds d'archives |
| **Authentification** | Firebase Auth (Google Sign-In) | Connexion administrateur et sécurité des écritures |
| **Cryptographie** | Web Crypto API native | PBKDF2 (100k itérations), AES-GCM 256-bit, SHA-256 |
| **Standard Métier** | GEDCOM 5.5.1 + Calendrier Républicain | Interopérabilité généalogique et paléographie française |

---

## 🚀 Démarrage Rapide

### Prérequis
- Node.js (version 20 ou supérieure recommandée)
- npm ou bun

### Installation
```bash
# 1. Cloner le dépôt
git clone https://github.com/votre-compte/genealogor.git
cd genealogor

# 2. Installer les dépendances
npm install

# 3. Lancer le serveur de développement (Express + Vite + WebSocket sur le port 3000)
npm run dev
```

Ouvrez ensuite votre navigateur sur **`http://localhost:3000`** (ou l'URL HTTPS fournie par votre hébergeur).

---

## 🧪 Tests Automatisés & Couverture

La suite de tests unitaires valide l'ensemble des règles métier, de la sécurité et de la résilience :

```bash
# Lancer tous les tests unitaires
npm test
```

### Détail des 7 Suites de Tests (38 tests au total)
1. `src/lib/__tests__/firestore-rules-isolation.test.ts` (7 tests) : Isolation multi-locataires, interdiction des lectures non autorisées, protection des suppressions.
2. `src/lib/__tests__/crypto.test.ts` (6 tests) : Chiffrement AES-GCM 256, sel unique par opération, hachage PBKDF2, génération de jetons.
3. `src/lib/__tests__/backup-restore.test.ts` (4 tests) : Sauvegarde chiffrée avec phrase secrète, détection des mauvaises phrases, intégrité SHA-256, retour arrière de sécurité.
4. `src/lib/__tests__/gedcom.test.ts` (6 tests) : Round-trip GEDCOM, masquage des contemporains, familles recomposées, dates approximatives françaises/anglaises, médias `OBJE` et balises propriétaires.
5. `src/lib/__tests__/offline-and-realtime.test.ts` (5 tests) : Persistance versionnée, file d'attente des modifications hors-ligne, reprise après corruption, marquage photo interactif.
6. `src/lib/__tests__/privacy.test.ts` (5 tests) : Règle des 100 ans, déduction du statut vital via les parents, anonymisation étanche des contemporains.
7. `src/lib/__tests__/validation-and-merge.test.ts` (5 tests) : Validation chronologique (anomalies de dates, parents trop jeunes), détection de cycles interdits, fusion de doublons sans orphelins.

---

## 📄 Scripts Disponibles

- `npm run dev` : Démarre le serveur Express avec relais WebSocket et Vite sur le port 3000.
- `npm run build` : Compile l'application pour la production (`dist/`).
- `npm run start` : Lance l'application en mode production via `server.ts`.
- `npm run test` : Exécute l'ensemble de la suite de tests automatisés avec Vitest.
- `npm run lint` : Vérifie la validité du typage TypeScript (`tsc --noEmit`).

---

<div align="center">
  <sub>Fait avec passion pour la mémoire et la transmission de l'histoire familiale.</sub>
</div>
