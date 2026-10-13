# Genealogor — Arbre Généalogique Collaboratif & Archives Numérisées

Application de généalogie complète et moderne reprenant l'ensemble du projet Genealogor (visualisations d'ancêtres, descendants, graphe de force, carte géographique, statistiques, chronologie, contrôle de cohérence, export GEDCOM), enrichie d'un système de partage familial sécurisé par liens privés et chiffrement de bout en bout, d'une collaboration en temps réel avec gestion des droits par branche, et d'un atelier complet d'importation, de transcription et de classement des documents d'archives numérisés.

## Décisions Clés & Validation Utilisateur

> [!IMPORTANT]
> Les trois orientations fonctionnelles suivantes ont été validées lors de la phase de cadrage et guident l'architecture globale de l'application :

- **Synchronisation & Stockage Chiffré** : Stockage local chiffré dans le navigateur (AES-GCM 256 bits dérivé par PBKDF2), associé à un mécanisme de synchronisation en temps réel (WebSockets / relais sécurisé sans stockage tiers non chiffré). Vos données généalogiques et vos documents restent strictement confidentiels et souverains.
- **Gestion des Accès par Branche** : Mots de passe personnalisables par branche (branche paternelle, branche maternelle, arbre complet) et rôles différenciés (Lecteur, Éditeur, Administrateur). Les liens privés peuvent intégrer la clé de déchiffrement dans le fragment d'URL (`#key=...`), non transmis au serveur pour préserver la confidentialité.
- **Import & Traitement des Archives Numérisées** : Atelier dédié au classement par typologie d'actes (naissance, mariage, décès, recensement, notarié, militaire), avec saisie des métadonnées archivistiques (dépôt, cote, vue, date grégorienne/républicaine, lieu), transcription textuelle et association manuelle fluide aux personnes et événements de l'arbre, secondé par une visionneuse haute définition (zoom, rotation, contraste pour calligraphies anciennes).

---

## 1. Vue d'Ensemble & Concept

### Qu'accomplit l'application
Genealogor est une station généalogique complète pour les familles et passionnés d'histoire familiale. Elle permet de :
1. **Explorer et éditer l'arbre** sous de multiples vues complémentaires : Profil biographique riche, Arbre d'ascendance classique ou éventail, Descendance arborescente, Graphe relationnel interactif, Carte géographique des migrations, Chronologie historique, Sablier, Implexe et calcul de consanguinité, Statistiques démographiques et Livret de famille imprimable.
2. **Partager l'arbre de manière privée et sécurisée** via des liens d'invitation avec mot de passe ou clé intégrée, en isolant si souhaité une branche spécifique (paternelle ou maternelle) et en protégeant automatiquement les personnes vivantes.
3. **Collaborer en direct** entre membres de la famille avec indicateur de présence, curseurs distants et réconciliation immédiate des ajouts ou modifications.
4. **Constituer un fonds d'archives numérisées** : importer des scans d'actes d'état civil et registres paroissiaux, renseigner cotes et transcriptions, et les lier précisément aux fiches des ancêtres.

### Public cible
- Le généalogiste référent de la famille qui structure les données, saisit les actes et administre l'arbre.
- Les proches et cousins qui reçoivent un lien privé pour consulter leur branche, enrichir les fiches ou adjoindre des documents photographiques et souvenirs.

---

## 2. Expérience Utilisateur & Design Visuel

Conformément à la charte institutionnelle et éditoriale (référence *Museum, Editorial & Institutional Design*), l'interface adopte une esthétique noble et chaleureuse rappelant les archives historiques et les beaux ouvrages de bibliothèque, tout en offrant une ergonomie moderne et fluide.

### Identité Visuelle & Palette
- **Fond de page (Papier d'archive)** : Teinte albâtre chaleureuse et reposante (`#FBF9F5` / `#F7F4EE` en mode clair, ardoise d'encre sombre `#18181B` en mode nuit).
- **Surfaces & Cartes** : Blanc calcaire pur avec bordures capillaires subtiles (`border-stone-200` / `border-stone-800`), sans surélévation criarde ni ombres exagérées.
- **Typographie** :
  - *Titres & Patronymes* : Serif éditorial élégant (`Playfair Display` ou `Cinzel` / `Merriweather`).
  - *Corps de texte & Interface* : Sans-serif contemporain très lisible (`Plus Jakarta Sans` ou `DM Sans`).
  - *Dates, Cotes & Métadonnées* : Police proportionnelle tabulaire (`font-mono tabular-nums`).
- **Touches colorées & Accents** :
  - Terracotta d'archive (`#9A3412`) pour les actions principales et sceaux.
  - Bleu lapis profond (`#1E3A8A`) pour les liens généalogiques et la lignée masculine.
  - Ocre bronze antique (`#78350F`) pour les événements d'union et documents notariés.
  - Vert sauge historique (`#14532D`) pour les validations et confirmations.
- **Zéro Pill Cliché** : Les métadonnées (dates, lieux, degrés de parenté, cotes) sont affichées en texte pur et aéré avec séparateurs typographiques discrets (`·` ou `/`), sans capsules colorées statiques artificielles.

### Parcours Utilisateur Principaux
1. **Accueil & Arrivée** :
   - Choix entre charger un fichier GEDCOM existant, explorer l'arbre de démonstration ou saisir la clé d'un arbre familial partagé.
2. **Navigation & Arbre** :
   - Barre supérieure conforme au contrat en 3 zones : Titre de l'arbre à gauche, navigation principale au centre (Arbre, Fiche, Archives, Chronologie, Carte, Stats), action de partage et statut de connexion à droite.
   - Vues spécialisées accessibles en un clic sans rechargement.
3. **Espace de Partage & Collaboration** :
   - Modal de partage générant des liens sécurisés :
     - *Lien Branche Paternelle* (protégé par mot de passe dédié, restreint aux ancêtres et collatéraux du père).
     - *Lien Branche Maternelle* (protégé par mot de passe dédié).
     - *Lien Arbre Complet* (accès complet).
   - Mode Collaboratif : badge de présence discret (« 3 membres connectés »), notification visuelle subtile lors de l'ajout d'une source ou d'une note en direct par un proche.
4. **Atelier des Archives Numérisées** :
   - Bibliothèque des pièces justificatives avec filtres par type (Naissances, Mariages, Décès, Recensements, Notariat, Militaire).
   - Fiche de numérisation avec visualiseur HD (zoom fluide molette, rotation à 90°, filtre haute netteté/négatif pour lecture d'encre fanée).
   - Zone de transcription face à l'acte avec sélection des individus rattachés et génération automatique de la source GEDCOM.

---

## 3. Décisions Produits & Arbitrages Techniques

### 1. Architecture de Partage & Chiffrement
- **Approche retenue** : Chiffrement client AES-GCM 256 bits avec dérivation de clé PBKDF2 (SHA-256, 100 000 itérations).
- **Pourquoi** : Garantit une stricte confidentialité des données familiales. Même transitant par le serveur relais temps réel, les données ne sont jamais lisibles en clair par un tiers.
- **Protection des personnes vivantes** : Option d'anonymisation automatique pour les invités (remplacement du prénom et masquage des dates pour toute personne née il y a moins de 100 ans sans date de décès).

### 2. Moteur Temps Réel
- **Approche retenue** : Serveur WebSocket léger intégré à l'application Node/Express agissant comme un bus de relais de salon (`room-based`), supportant l'échange direct de messages chiffrés et la synchronisation incrémentale.
- **Résilience** : En l'absence de réseau, l'application fonctionne à 100% hors ligne grâce au stockage local (IndexedDB / localStorage) et au mode PWA.

### 3. Gestion des Médias & Documents d'Archives
- **Approche retenue** : Stockage local des documents numérisés compressés dans IndexedDB avec aperçus optimisés, et option d'export/sauvegarde sous forme de paquet zip d'archives avec manifest JSON normalisé.
- **Association généalogique** : Chaque document peut être rattaché soit à un individu, soit à une union (famille), soit directement à un événement spécifique (ex: Baptême du 14 mai 1742).

---

## 4. Architecture Technique & Stratégie des Données

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              INTERFACE CLIENT                                │
│                                                                             │
│  ┌────────────────────────┐  ┌───────────────────────┐  ┌────────────────┐  │
│  │    Barre Supérieure    │  │  Vues Généalogiques   │  │    Atelier     │  │
│  │ (Titre · Nav · Partage)│  │(Arbre/Fiche/Carte/...)│  │   Archives HD  │  │
│  └───────────┬────────────┘  └───────────┬───────────┘  └────────┬───────┘  │
│              │                           │                       │          │
│  ┌───────────▼───────────────────────────▼───────────────────────▼───────┐  │
│  │                    Moteur d'État Genealogor                           │  │
│  │  - Arbre généalogique en mémoire (Individus, Familles, Événements)    │  │
│  │  - Registre des Archives & Médias (Cotes, Transcriptions, Liaisons)   │  │
│  │  - Gestionnaire de permissions (Paternelle, Maternelle, Admin)        │  │
│  └───────────────────────────┬───────────────────────────────────────────┘  │
│                              │                                              │
│  ┌───────────────────────────▼───────────────────────────────────────────┐  │
│  │                 Couche Sécurité & Synchronisation                     │  │
│  │  - CryptoManager : AES-GCM 256 bits, PBKDF2, hachage d'accès          │  │
│  │  - RealtimeSync : Client WebSocket salon chiffré                      │  │
│  │  - StorageManager : IndexedDB (Documents d'archives) + LocalStorage   │  │
│  └───────────────────────────┬───────────────────────────────────────────┘  │
└──────────────────────────────┼──────────────────────────────────────────────┘
                               │ WebSocket chiffré (wss://)
┌──────────────────────────────▼──────────────────────────────────────────────┐
│                    SERVEUR RELAIS TEMPS RÉEL (Node.js)                      │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  - Gestionnaire de salons privés (/ws/rooms/:roomId)                  │  │
│  │  - Relais de paquets chiffrés de bout en bout (Zéro Connaissance)     │  │
│  │  - Suivi de présence des membres connectés                            │  │
│  │  - Service statique Vite / PWA sur port 3000                          │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Modèle de Données Étendu

1. **Permissions & Accès (`BranchAccess`)** :
   - `id`: identifiant unique du droit
   - `branch`: `'all' | 'paternal' | 'maternal' | 'custom'`
   - `rootPersonId`: identifiant de l'ancêtre pivot pour le filtre de branche
   - `role`: `'viewer' | 'editor' | 'admin'`
   - `passwordHash`: empreinte salée pour la vérification d'accès
   - `hideLiving`: booléen masquant les personnes vivantes
   - `shareToken`: jeton unique pour le lien d'accès direct

2. **Documents d'Archives (`ArchiveDocument`)** :
   - `id`: identifiant UUID
   - `title`: titre descriptif (ex: *Acte de baptême de François Martin*)
   - `type`: `'birth' | 'baptism' | 'marriage' | 'death' | 'burial' | 'census' | 'notarial' | 'military' | 'other'`
   - `archiveLocation`: dépôt d'archives (ex: *AD Ille-et-Vilaine*)
   - `callNumber`: cote d'archive (ex: *10 NUM 35001 23, vue 42/180*)
   - `date`: date de l'acte (avec support républicain/grégorien)
   - `place`: commune / paroisse
   - `transcription`: transcription fidèle du texte ancien
   - `notes`: remarques paléographiques ou historiques
   - `fileData`: URL de données ou blob local stocké en IndexedDB
   - `mimeType`: type de fichier (image/jpeg, image/png, application/pdf)
   - `linkedPersonIds`: liste des identifiants des individus associés
   - `linkedFamilyIds`: liste des familles associées
   - `linkedEventId`: identifiant de l'événement précis lié

3. **Événements Collaboratifs Temps Réel (`SyncAction`)** :
   - `roomId`: identifiant du salon familial partagé
   - `clientId`: identifiant de session de l'utilisateur
   - `authorName`: nom affiché du contributeur
   - `action`: `'tree:update' | 'person:edit' | 'archive:add' | 'presence:ping'`
   - `payload`: données chiffrées de l'action
   - `timestamp`: horodatage pour résolution de conflits (dernier écrit l'emporte)

---

## 5. Étapes de Mise en Œuvre

1. **Intégration du socle Genealogor** : Déploiement des types généalogiques complets, du parser/serializer GEDCOM, des bibliothèques de calcul (Sosa, Implexe, calendrier républicain, géolocalisation) et des composants de visualisation.
2. **Module de Sécurité & Liens de Partage par Branche** : Implémentation du système de restriction de branches, dérivation de clés cryptographiques, générateur de liens privés et écran d'accueil avec déverrouillage par mot de passe.
3. **Serveur & Client de Collaboration Temps Réel** : Mise en place du serveur WebSocket Express sur port 3000, protocole de synchronisation d'état et bandeau de présence collaborative.
4. **Atelier des Archives Numérisées** : Création de la vue d'archives avec import glisser-déposer, visionneuse haute définition avec contrôles d'image (zoom, contraste, rotation), formulaire de métadonnées et liaison avec les individus et événements.
5. **Finitions & Validation** : Vérification de la compatibilité responsive, des tests de non-régression et compilation complète de l'application.
