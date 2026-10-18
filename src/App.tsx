import React, { useState, useEffect, useMemo } from 'react';
import { Navbar, ActiveTab } from './components/Navbar';
import { TreeView } from './components/views/TreeView';
import { ProfileView } from './components/views/ProfileView';
import { ArchivesView } from './components/views/ArchivesView';
import { TimelineView } from './components/views/TimelineView';
import { GeoMapView } from './components/views/GeoMapView';
import { StatsView } from './components/views/StatsView';
import { ShareModal } from './components/ShareModal';
import { ExportImportModal } from './components/ExportImportModal';
import { EditPersonModal } from './components/views/EditPersonModal';
import { MergeModal } from './components/views/MergeModal';
import { PassphraseScreen } from './components/PassphraseScreen';

import { GenealogyData, Individual, ArchiveDocument, BranchAccess, BranchRole, BranchScope } from './types/genealogy';
import { getSampleGenealogy, createEmptyGenealogy, isSampleGenealogy } from './lib/sample-data';
import { getStoredArchives, saveStoredArchives, clearStoredArchives, getDefaultArchives } from './lib/archive-store';
import { filterGenealogyData } from './lib/branch-filter';
import { realtimeClient } from './lib/realtime-client';
import { verifyPassword } from './lib/crypto';
import { validateChronology } from './lib/validation';
import { 
  sanitizePersonForPrivacy, 
  sanitizeGenealogyDataForPrivacy, 
  sanitizeArchivesForPrivacy, 
  getProtectedPersonIds,
  shouldProtectPerson 
} from './lib/privacy';
import { 
  STORAGE_KEYS, 
  setVersionedItem, 
  getVersionedItem, 
  addPendingChange, 
  getPendingChanges, 
  clearPendingChanges,
  updatePendingChange,
  markPendingChangeFailed,
  removePendingChange
} from './lib/storage-manager';
// Les jetons de salle sont émis et signés exclusivement côté serveur via /api/auth/room-token
import { 
  auth, 
  loginWithGoogle, 
  logoutUser, 
  testFirestoreConnection,
  firebaseProjectId,
  checkRedirectAuth
} from './lib/firebase';
import { AuthErrorModal, AuthErrorInfo } from './components/AuthErrorModal';

import { 
  saveTreeToFirestore, 
  subscribeToTree, 
  saveArchiveToFirestore, 
  deleteArchiveFromFirestore, 
  subscribeToArchives, 
  saveAccessToFirestore, 
  subscribeToAccessList,
  clearTreeFromFirestore
} from './lib/firestore-sync';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { Shield, Sparkles, Database, GitMerge, AlertTriangle, Trash2 } from 'lucide-react';

export default function App() {
  // Main state with versioned storage & recovery
  const [data, setData] = useState<GenealogyData>(() => {
    const isCleared = typeof window !== 'undefined' && localStorage.getItem('genealogor_prototype_cleared') === 'true';
    const fallback = isCleared ? createEmptyGenealogy() : getSampleGenealogy();
    const res = getVersionedItem<GenealogyData>(STORAGE_KEYS.TREE, fallback);
    return res.data;
  });

  const [archives, setArchives] = useState<ArchiveDocument[]>(() => {
    const isCleared = typeof window !== 'undefined' && localStorage.getItem('genealogor_prototype_cleared') === 'true';
    const fallback = isCleared ? [] : getStoredArchives();
    const res = getVersionedItem<ArchiveDocument[]>(STORAGE_KEYS.ARCHIVES, fallback);
    return res.data;
  });

  const [activeTab, setActiveTab] = useState<ActiveTab>('tree');
  const [selectedPersonId, setSelectedPersonId] = useState<string>(() => data.rootPersonId || Object.keys(data.individuals)[0] || '');
  const [selectedArchiveId, setSelectedArchiveId] = useState<string>('');

  // Firebase Auth & Cloud Sync state
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [isCloudSynced, setIsCloudSynced] = useState<boolean>(false);

  // Modals state
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Individual | null>(null);

  // Access control & Private branch links
  const [accessList, setAccessList] = useState<BranchAccess[]>(() => {
    const res = getVersionedItem<BranchAccess[]>(STORAGE_KEYS.ACCESS, []);
    return res.data;
  });

  const [currentBranchScope, setCurrentBranchScope] = useState<BranchScope>('all');
  const [userRole, setUserRole] = useState<BranchRole>('admin');
  const [isUnlocked, setIsUnlocked] = useState<boolean>(true);
  const [pendingBranchAccess, setPendingBranchAccess] = useState<BranchAccess | null>(null);

  // Real-time synchronization state
  const [roomId, setRoomId] = useState<string>('famille-martin-1742');
  const [connectedPeerCount, setConnectedPeerCount] = useState<number>(1);
  const [isWsConnected, setIsWsConnected] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [authError, setAuthError] = useState<AuthErrorInfo | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Chronological anomalies detection
  const anomalies = useMemo(() => validateChronology(data), [data]);

  // Détection si les données actuelles correspondent au prototype de démonstration
  const isPrototypeActive = useMemo(() => isSampleGenealogy(data, archives), [data, archives]);

  // 1. Initialize Firebase Auth and Connection Verification
  useEffect(() => {
    testFirestoreConnection().then(ok => {
      if (ok) setIsCloudSynced(true);
    });

    // Check if coming back from a redirect Google sign-in
    checkRedirectAuth().catch((err: any) => {
      console.warn('Redirect sign-in error:', err);
      const code = err?.code || 'auth/unknown';
      if (code === 'auth/unauthorized-domain' || code === 'auth/popup-blocked') {
        setAuthError({
          code,
          message: err?.message || 'Erreur d’authentification.',
          currentDomain: window.location.hostname,
          firebaseProjectId,
        });
      }
    });

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthReady(true);
      if (user) {
        showToast(`Connecté avec Google : ${user.displayName || user.email}`);
        setIsCloudSynced(true);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // 2. Subscribe to Firestore ONLY when auth is ready and user is authenticated
  useEffect(() => {
    if (!authReady || !currentUser || !roomId) return;

    const unsubTree = subscribeToTree(
      roomId, 
      (remoteData) => {
        if (remoteData && Object.keys(remoteData.individuals).length > 0) {
          setData(remoteData);
          setVersionedItem(STORAGE_KEYS.TREE, remoteData);
          setIsCloudSynced(true);
        }
      },
      () => {
        // Le document n'existe pas encore dans Firestore : l'initialiser avec l'arbre local
        if (currentUser) {
          saveTreeToFirestore(roomId, data, currentUser).then(() => {
            setIsCloudSynced(true);
          }).catch(console.warn);
        }
      }
    );

    const unsubArch = subscribeToArchives(roomId, (remoteArchives) => {
      if (remoteArchives && remoteArchives.length > 0) {
        setArchives(remoteArchives);
        setVersionedItem(STORAGE_KEYS.ARCHIVES, remoteArchives);
        setIsCloudSynced(true);
      }
    });

    const unsubAccess = subscribeToAccessList(roomId, (remoteAccess) => {
      if (remoteAccess && remoteAccess.length > 0) {
        setAccessList(remoteAccess);
        setVersionedItem(STORAGE_KEYS.ACCESS, remoteAccess);
      }
    });

    return () => {
      unsubTree();
      unsubArch();
      unsubAccess();
    };
  }, [authReady, currentUser, roomId]);

  // 3. Check URL parameters for private share links on initial load
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    const tokenParam = urlParams.get('token');
    const branchParam = urlParams.get('branch') as BranchScope | null;
    const roleParam = urlParams.get('role') as BranchRole | null;

    if (roomParam) {
      setRoomId(roomParam);
    }

    if (tokenParam) {
      const matchingAccess = accessList.find(a => a.shareToken === tokenParam);
      if (matchingAccess) {
        if (matchingAccess.passwordHash || matchingAccess.password) {
          setIsUnlocked(false);
          setPendingBranchAccess(matchingAccess);
        } else {
          setCurrentBranchScope(matchingAccess.branch);
          setUserRole(matchingAccess.role);
          setIsUnlocked(true);
        }
      } else if (branchParam) {
        setCurrentBranchScope(branchParam);
        if (roleParam) setUserRole(roleParam);
        setIsUnlocked(true);
      }
    }
  }, [accessList]);

  // 4. Initialisation sécurisée de la connexion WebSocket temps réel
  useEffect(() => {
    let isCancelled = false;
    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const invitationToken = urlParams?.get('token') || pendingBranchAccess?.shareToken || '';

    const setupConnection = async () => {
      let token = '';
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (currentUser) {
          const idToken = await currentUser.getIdToken();
          headers['Authorization'] = `Bearer ${idToken}`;
        }

        const res = await fetch('/api/auth/room-token', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            roomId,
            invitationToken: invitationToken || undefined,
            userName: currentUser?.displayName || undefined,
          }),
        });

        if (res.ok) {
          const authData = await res.json();
          if (authData.token) {
            token = authData.token;
            if (authData.role && authData.role !== userRole) {
              setUserRole(authData.role);
            }
            if (authData.branch && authData.branch !== currentBranchScope) {
              setCurrentBranchScope(authData.branch);
            }
          }
        }
      } catch (err) {
        console.warn('Impossible de récupérer le jeton serveur WebSocket:', err);
      }

      if (isCancelled) return;

      realtimeClient.init(
        roomId, 
        currentUser?.displayName || (userRole === 'admin' ? 'Administrateur' : userRole === 'editor' ? 'Éditeur' : 'Visiteur'),
        currentBranchScope,
        token
      );
    };

    setupConnection();

    const unsubConn = realtimeClient.on('connection:change', async (info) => {
      setIsWsConnected(info.connected);
      if (info.connected) {
        // P1 : Traitement résilient des modifications en attente avec acquittement ACK individuel
        const pending = getPendingChanges();
        if (pending.length > 0) {
          let syncedCount = 0;
          for (const change of pending) {
            // Éviter de renvoyer en boucle si déjà en conflit
            if (change.retryCount >= 3) continue;

            updatePendingChange(change.id, { status: 'syncing', lastAttempt: Date.now() });
            const res = await realtimeClient.sendActionWithAck(change.action, change.payload, change.id);
            if (res.success) {
              removePendingChange(change.id);
              syncedCount++;
            } else {
              markPendingChangeFailed(change.id, res.error);
              console.warn(`Échec de confirmation pour la modification ${change.id}:`, res.error);
            }
          }

          if (syncedCount > 0) {
            showToast(`${syncedCount} modification(s) hors-ligne synchronisée(s) et acquittée(s).`);
          }

          // Persistance Firestore traitée comme un canal distinct du simple relais WebSocket
          if (currentUser) {
            try {
              await saveTreeToFirestore(roomId, data, currentUser);
              setIsCloudSynced(true);
            } catch (e) {
              console.warn('Persistance Firestore en arrière-plan:', e);
            }
          }
        }
      }
    });

    const unsubRoom = realtimeClient.on('room:info', (info) => {
      setConnectedPeerCount(info.peerCount || 1);
    });

    const unsubPeerJoined = realtimeClient.on('peer:joined', (info) => {
      setConnectedPeerCount(info.peerCount || 2);
      showToast(`${info.userName || 'Un membre de la famille'} a rejoint l'arbre.`);
    });

    const unsubPeerLeft = realtimeClient.on('peer:left', (info) => {
      setConnectedPeerCount(info.peerCount || 1);
    });

    const unsubSync = realtimeClient.on('sync:action', (msg) => {
      if (msg.action === 'tree:update' && msg.payload) {
        const payloadData = userRole === 'viewer'
          ? sanitizeGenealogyDataForPrivacy(msg.payload)
          : msg.payload;
        setData(payloadData);
        setVersionedItem(STORAGE_KEYS.TREE, payloadData);
        showToast('Arbre généalogique synchronisé en direct.');
      } else if (msg.action === 'person:edit' && msg.payload) {
        let updatedInd = msg.payload as Individual;
        if (userRole === 'viewer' && shouldProtectPerson(updatedInd)) {
          updatedInd = sanitizePersonForPrivacy(updatedInd);
        }
        setData(prev => {
          const next = {
            ...prev,
            individuals: { ...prev.individuals, [updatedInd.id]: updatedInd }
          };
          setVersionedItem(STORAGE_KEYS.TREE, next);
          return next;
        });
        showToast(`Fiche de ${updatedInd.name} mise à jour en direct.`);
      } else if (msg.action === 'archive:add' && msg.payload) {
        const newArchive = msg.payload as ArchiveDocument;
        if (userRole === 'viewer') {
          const protectedIds = getProtectedPersonIds(data);
          const sanitizedList = sanitizeArchivesForPrivacy([newArchive], protectedIds);
          if (sanitizedList.length === 0) return; // Ne pas intégrer l'archive privée
        }
        setArchives(prev => {
          const next = [newArchive, ...prev.filter(a => a.id !== newArchive.id)];
          setVersionedItem(STORAGE_KEYS.ARCHIVES, next);
          return next;
        });
        showToast(`Nouvel acte numérisé ajouté : ${newArchive.title}`);
      }
    });

    return () => {
      unsubConn();
      unsubRoom();
      unsubPeerJoined();
      unsubPeerLeft();
      unsubSync();
    };
  }, [roomId, currentBranchScope, userRole, currentUser]);

  // Auth Handlers
  const handleLogin = async () => {
    try {
      setAuthError(null);
      await loginWithGoogle();
    } catch (e: any) {
      console.error('Erreur connexion Google:', e);
      const code = e?.code || 'auth/unknown';
      const msg = e?.message || 'Erreur inconnue';

      // Unauthorized domain, popup blocked, or other configuration error
      if (
        code === 'auth/unauthorized-domain' || 
        code === 'auth/popup-blocked' || 
        code === 'auth/operation-not-allowed' ||
        code === 'auth/internal-error'
      ) {
        setAuthError({
          code,
          message: msg,
          currentDomain: window.location.hostname,
          firebaseProjectId,
        });
      } else if (code === 'auth/popup-closed-by-user') {
        showToast('Connexion annulée : la fenêtre Google a été fermée.');
      } else {
        // Show detailed toast
        showToast(`Erreur (${code}) : vérifiez la configuration Google.`);
        setAuthError({
          code,
          message: msg,
          currentDomain: window.location.hostname,
          firebaseProjectId,
        });
      }
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
      showToast('Déconnecté.');
    } catch (e) {
      console.error(e);
    }
  };

  // Handle unlocking via passphrase
  const handleUnlockWithPassword = async (enteredPassword: string): Promise<boolean> => {
    if (!pendingBranchAccess) return false;
    let isValid = false;

    if (pendingBranchAccess.passwordHash) {
      isValid = await verifyPassword(enteredPassword, pendingBranchAccess.passwordHash);
    } else if (pendingBranchAccess.password) {
      isValid = enteredPassword === pendingBranchAccess.password;
    }

    if (isValid) {
      setCurrentBranchScope(pendingBranchAccess.branch);
      setUserRole(pendingBranchAccess.role);
      setIsUnlocked(true);
      showToast(`Accès déverrouillé : ${pendingBranchAccess.name}`);
      return true;
    }
    return false;
  };

  // Branch & privacy filtering: get active tree data for current viewer
  const effectiveData = useMemo(() => {
    const rootId = data.rootPersonId || Object.keys(data.individuals)[0] || '';
    if (userRole === 'admin' && currentBranchScope === 'all') {
      return data;
    }
    const hideLiving = userRole !== 'admin';
    return filterGenealogyData(data, rootId, currentBranchScope, hideLiving);
  }, [data, currentBranchScope, userRole]);

  // Branch & privacy filtering: get active archives matching visible individuals and privacy rules
  const effectiveArchives = useMemo(() => {
    let active = archives;
    if (currentBranchScope !== 'all') {
      const allowedIds = new Set(Object.keys(effectiveData.individuals));
      active = archives.filter(arc =>
        arc.linkedPersonIds.length === 0 || arc.linkedPersonIds.some(id => allowedIds.has(id))
      );
    }
    if (userRole !== 'admin') {
      const protectedIds = getProtectedPersonIds(data);
      return sanitizeArchivesForPrivacy(active, protectedIds);
    }
    return active;
  }, [archives, currentBranchScope, effectiveData, userRole, data]);

  // Archive count per person
  const archiveCountByPerson = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const doc of archives) {
      for (const pId of doc.linkedPersonIds) {
        counts[pId] = (counts[pId] || 0) + 1;
      }
    }
    return counts;
  }, [archives]);

  // Handlers for modifying tree & archives with Firestore sync + realtime broadcast
  const handleUpdatePerson = async (updated: Individual) => {
    const nextData = {
      ...data,
      individuals: { ...data.individuals, [updated.id]: updated },
      rootPersonId: data.rootPersonId || updated.id,
    };
    setData(nextData);
    setVersionedItem(STORAGE_KEYS.TREE, nextData);
    setSelectedPersonId(updated.id);

    // Broadcast via WebSocket
    realtimeClient.sendAction('person:edit', updated);

    // File d'attente si hors ligne
    if (!isWsConnected) {
      addPendingChange('person:edit', updated);
    }

    // Persist to Firestore if user is authenticated or room is active
    try {
      await saveTreeToFirestore(roomId, nextData, currentUser);
      setIsCloudSynced(true);
    } catch (e) {
      console.warn('Firestore sync fallback', e);
    }

    showToast(`Fiche de ${updated.name} enregistrée.`);
  };

  const handleAddArchive = async (newDoc: ArchiveDocument) => {
    const nextArchives = [newDoc, ...archives];
    setArchives(nextArchives);
    setVersionedItem(STORAGE_KEYS.ARCHIVES, nextArchives);
    realtimeClient.sendAction('archive:add', newDoc);

    if (!isWsConnected) {
      addPendingChange('archive:add', newDoc);
    }

    try {
      await saveArchiveToFirestore(roomId, newDoc, currentUser);
      setIsCloudSynced(true);
    } catch (e) {
      console.warn('Firestore archive save fallback', e);
    }

    showToast(`Acte archivé : ${newDoc.title}`);
  };

  const handleUpdateArchive = async (updated: ArchiveDocument) => {
    const nextArchives = archives.map(a => a.id === updated.id ? updated : a);
    setArchives(nextArchives);
    setVersionedItem(STORAGE_KEYS.ARCHIVES, nextArchives);
    realtimeClient.sendAction('archive:add', updated);

    if (!isWsConnected) {
      addPendingChange('archive:add', updated);
    }

    try {
      await saveArchiveToFirestore(roomId, updated, currentUser);
      setIsCloudSynced(true);
    } catch (e) {
      console.warn('Firestore archive update fallback', e);
    }

    showToast(`Acte mis à jour : ${updated.title}`);
  };

  const handleDeleteArchive = async (id: string) => {
    const nextArchives = archives.filter(a => a.id !== id);
    setArchives(nextArchives);
    setVersionedItem(STORAGE_KEYS.ARCHIVES, nextArchives);
    realtimeClient.sendAction('archive:delete', id);

    if (!isWsConnected) {
      addPendingChange('archive:delete', id);
    }
    
    try {
      await deleteArchiveFromFirestore(roomId, id, currentUser);
    } catch (e) {
      console.warn('Firestore delete fallback', e);
    }

    showToast('Acte supprimé du fonds d\'archives.');
  };

  const handleLoadGedcom = async (newData: GenealogyData) => {
    setData(newData);
    setVersionedItem(STORAGE_KEYS.TREE, newData);
    if (newData.rootPersonId) setSelectedPersonId(newData.rootPersonId);
    realtimeClient.sendAction('tree:update', newData);

    if (!isWsConnected) {
      addPendingChange('tree:update', newData);
    }

    try {
      await saveTreeToFirestore(roomId, newData, currentUser);
      setIsCloudSynced(true);
    } catch (e) {
      console.warn('Firestore sync fallback', e);
    }

    showToast('Nouvel arbre GEDCOM chargé et synchronisé.');
  };

  const handleRestoreBackup = async (payload: { genealogy: GenealogyData; archives: ArchiveDocument[]; accessList: BranchAccess[] }) => {
    setData(payload.genealogy);
    setArchives(payload.archives);
    setAccessList(payload.accessList);

    setVersionedItem(STORAGE_KEYS.TREE, payload.genealogy);
    setVersionedItem(STORAGE_KEYS.ARCHIVES, payload.archives);
    setVersionedItem(STORAGE_KEYS.ACCESS, payload.accessList);

    if (payload.genealogy.rootPersonId) {
      setSelectedPersonId(payload.genealogy.rootPersonId);
    }

    realtimeClient.sendAction('tree:update', payload.genealogy);

    try {
      await saveTreeToFirestore(roomId, payload.genealogy, currentUser);
      setIsCloudSynced(true);
    } catch (e) {}

    showToast('Sauvegarde complète restaurée avec succès.');
  };

  const handleCreateNewPerson = () => {
    const existingIds = Object.keys(data.individuals);
    let nextNum = 1;
    while (existingIds.includes(`@I${nextNum}@`)) {
      nextNum++;
    }
    const newPerson: Individual = {
      id: `@I${nextNum}@`,
      name: 'Nouveau Membre',
      sex: 'M',
      familiesAsChild: [],
      familiesAsSpouse: [],
      notes: [],
    };
    setEditingPerson(newPerson);
  };

  const handleClearPrototype = async () => {
    const emptyTree = createEmptyGenealogy('Mon Arbre Généalogique');
    const emptyArchives: ArchiveDocument[] = [];
    const emptyAccess: BranchAccess[] = [];

    if (typeof window !== 'undefined') {
      localStorage.setItem('genealogor_prototype_cleared', 'true');
    }

    setData(emptyTree);
    setArchives(emptyArchives);
    setAccessList(emptyAccess);
    setSelectedPersonId('');
    setSelectedArchiveId('');

    setVersionedItem(STORAGE_KEYS.TREE, emptyTree);
    setVersionedItem(STORAGE_KEYS.ARCHIVES, emptyArchives);
    setVersionedItem(STORAGE_KEYS.ACCESS, emptyAccess);
    clearStoredArchives();

    realtimeClient.sendAction('tree:update', emptyTree);

    try {
      await clearTreeFromFirestore(roomId, currentUser);
    } catch (e) {
      console.warn('Erreur Firestore lors de la réinitialisation', e);
    }

    showToast('Toutes les données du prototype ont été effacées. Arbre vierge prêt.');
  };

  const handleResetSample = async () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('genealogor_prototype_cleared');
    }
    const sample = getSampleGenealogy();
    const defaultArchives = getDefaultArchives();

    setData(sample);
    setArchives(defaultArchives);
    setVersionedItem(STORAGE_KEYS.TREE, sample);
    setVersionedItem(STORAGE_KEYS.ARCHIVES, defaultArchives);
    saveStoredArchives(defaultArchives);

    const rootId = sample.rootPersonId || Object.keys(sample.individuals)[0] || '';
    setSelectedPersonId(rootId);
    realtimeClient.sendAction('tree:update', sample);

    try {
      await saveTreeToFirestore(roomId, sample, currentUser);
      for (const docItem of defaultArchives) {
        await saveArchiveToFirestore(roomId, docItem, currentUser);
      }
    } catch (e) {}

    showToast('Arbre de démonstration (Famille Martin) rechargé.');
  };

  const handleAddAccessRule = async (newAcc: BranchAccess) => {
    const next = [newAcc, ...accessList];
    setAccessList(next);
    setVersionedItem(STORAGE_KEYS.ACCESS, next);
    try {
      await saveAccessToFirestore(roomId, newAcc, currentUser);
    } catch (e) {}
    showToast(`Lien pour ${newAcc.name} créé.`);
  };

  // If private link is protected and locked, show passphrase screen
  if (!isUnlocked && pendingBranchAccess) {
    return (
      <PassphraseScreen
        branchName={pendingBranchAccess.name}
        onUnlock={handleUnlockWithPassword}
        onContinueAsGuest={() => {
          setIsUnlocked(true);
          setCurrentBranchScope('paternal');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#FBF9F5] text-stone-900 flex flex-col font-sans">
      
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenShareModal={() => setIsShareModalOpen(true)}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        currentAccess={accessList.find(a => a.branch === currentBranchScope)}
        userRole={userRole}
        connectedPeerCount={connectedPeerCount}
        isWsConnected={isWsConnected}
        treeTitle={data.sourceHeader || 'Famille Martin'}
        currentUser={currentUser}
        onLogin={handleLogin}
        onLogout={handleLogout}
        isCloudSynced={isCloudSynced}
        isPrototypeActive={isPrototypeActive}
      />

      {/* Prototype active banner with quick erase action */}
      {isPrototypeActive && (
        <div className="bg-amber-50/90 border-b border-amber-200/90 px-4 md:px-8 py-2 text-xs text-amber-950 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-200 text-amber-900 uppercase tracking-wide">
              Mode Démonstration
            </span>
            <span className="text-amber-900">
              Vous visualisez actuellement l'arbre d'exemple (Famille Martin & actes de test).
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsExportModalOpen(true)}
            className="text-xs font-semibold text-rose-800 hover:text-rose-950 underline hover:no-underline flex items-center gap-1 cursor-pointer"
          >
            Effacer toutes les données du prototype →
          </button>
        </div>
      )}

      {/* Anomalies alert bar if any detected */}
      {anomalies.length > 0 && activeTab === 'tree' && (
        <div className="bg-amber-50 border-b border-amber-200/80 px-4 md:px-8 py-2 text-xs text-amber-900 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-800 shrink-0" />
            <span>
              <strong>Contrôle de cohérence :</strong> {anomalies.length} anomalie(s) chronologique(s) détectée(s) (ex : {anomalies[0].message}).
            </span>
          </div>
          <button
            onClick={() => setActiveTab('stats')}
            className="font-bold underline hover:text-amber-950 shrink-0"
          >
            Examiner dans les statistiques →
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 pb-16">
        {activeTab === 'tree' && (
          <TreeView
            data={effectiveData}
            selectedPersonId={selectedPersonId}
            onSelectPerson={setSelectedPersonId}
            onViewProfile={(id) => {
              setSelectedPersonId(id);
              setActiveTab('profile');
            }}
            onViewArchives={(id) => {
              setSelectedPersonId(id);
              setActiveTab('archives');
            }}
            archiveCountByPerson={archiveCountByPerson}
            onAddNewPerson={handleCreateNewPerson}
            onOpenImportModal={() => setIsExportModalOpen(true)}
            onResetSample={handleResetSample}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileView
            personId={selectedPersonId}
            data={effectiveData}
            archives={effectiveArchives}
            onSelectPerson={setSelectedPersonId}
            onEditPerson={(p) => setEditingPerson(p)}
            onOpenArchives={() => setActiveTab('archives')}
            onSelectArchive={(docId) => {
              setSelectedArchiveId(docId);
              setActiveTab('archives');
            }}
            onAddNewPerson={handleCreateNewPerson}
            onOpenImportModal={() => setIsExportModalOpen(true)}
          />
        )}

        {activeTab === 'archives' && (
          <ArchivesView
            archives={effectiveArchives}
            data={effectiveData}
            selectedArchiveId={selectedArchiveId}
            onAddArchive={handleAddArchive}
            onUpdateArchive={handleUpdateArchive}
            onDeleteArchive={handleDeleteArchive}
            onSelectPerson={(pId) => {
              setSelectedPersonId(pId);
              setActiveTab('profile');
            }}
          />
        )}

        {activeTab === 'timeline' && (
          <TimelineView
            data={effectiveData}
            onSelectPerson={(id) => {
              setSelectedPersonId(id);
              setActiveTab('profile');
            }}
          />
        )}

        {activeTab === 'map' && (
          <GeoMapView
            data={effectiveData}
            onSelectPerson={(id) => {
              setSelectedPersonId(id);
              setActiveTab('profile');
            }}
          />
        )}

        {activeTab === 'stats' && (
          <StatsView
            data={effectiveData}
            archiveCount={archives.length}
          />
        )}
      </main>

      {/* Floating utility quick actions button for GEDCOM & Duplicates */}
      <div className="fixed bottom-4 right-4 z-30 flex items-center gap-2">
        <button
          onClick={() => setIsMergeModalOpen(true)}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-stone-800 bg-white/95 border border-stone-300 shadow-md hover:bg-stone-50 transition-all backdrop-blur-xs"
        >
          <GitMerge className="w-3.5 h-3.5 text-amber-800" />
          <span>Fusionner les doublons</span>
        </button>

        <button
          onClick={() => setIsExportModalOpen(true)}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-stone-800 bg-white/95 border border-stone-300 shadow-md hover:bg-stone-50 transition-all backdrop-blur-xs"
        >
          <Database className="w-3.5 h-3.5 text-amber-800" />
          <span>Fichiers & Sauvegardes</span>
        </button>
      </div>

      {/* Floating realtime toast */}
      {toastMessage && (
        <div className="fixed bottom-4 left-4 z-50 bg-stone-900 text-white px-4 py-2.5 rounded-xl text-xs font-medium shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Share & Branch Permissions Modal */}
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        data={data}
        roomId={roomId}
        accessList={accessList}
        onAddAccess={handleAddAccessRule}
        onDeleteAccess={(id) => {
          const next = accessList.filter(a => a.id !== id);
          setAccessList(next);
          setVersionedItem(STORAGE_KEYS.ACCESS, next);
          showToast('Lien d\'accès révoqué.');
        }}
        rootPersonId={data.rootPersonId || Object.keys(data.individuals)[0]}
      />

      {/* Export / Import GEDCOM & Backup Modal */}
      <ExportImportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        data={userRole === 'admin' ? data : effectiveData}
        archives={userRole === 'admin' ? archives : effectiveArchives}
        accessList={accessList}
        onLoadGedcom={handleLoadGedcom}
        onRestoreBackup={handleRestoreBackup}
        onResetSample={handleResetSample}
        onClearPrototype={handleClearPrototype}
        isPrototypeActive={isPrototypeActive}
      />

      {/* Merge Duplicates Modal */}
      <MergeModal
        isOpen={isMergeModalOpen}
        onClose={() => setIsMergeModalOpen(false)}
        data={data}
        onMergeComplete={(newData) => {
          setData(newData);
          setVersionedItem(STORAGE_KEYS.TREE, newData);
          realtimeClient.sendAction('tree:update', newData);
          try {
            saveTreeToFirestore(roomId, newData, currentUser);
          } catch (e) {}
          showToast('Doublons fusionnés avec succès sans perte de données.');
        }}
      />

      {/* Edit Person Modal */}
      <EditPersonModal
        person={editingPerson}
        isOpen={!!editingPerson}
        onClose={() => setEditingPerson(null)}
        onSave={handleUpdatePerson}
      />

      {/* Auth Error Diagnostic Modal */}
      {authError && (
        <AuthErrorModal
          errorInfo={authError}
          onClose={() => setAuthError(null)}
          onSuccess={() => {
            setAuthError(null);
            showToast('Connexion Google réussie !');
          }}
        />
      )}

      {/* Footer */}
      <footer className="border-t border-stone-200/80 bg-stone-100/60 py-4 px-6 text-center text-xs text-stone-500 font-mono">
        <span>Genealogor · Recherche historique, archives numérisées, synchronisation Firestore et collaboration familiale</span>
      </footer>

    </div>
  );
}
