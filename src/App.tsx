import React, { useState, useEffect } from 'react';
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
import { PassphraseScreen } from './components/PassphraseScreen';

import { GenealogyData, Individual, ArchiveDocument, BranchAccess, BranchRole, BranchScope } from './types/genealogy';
import { getSampleGenealogy } from './lib/sample-data';
import { getStoredArchives, saveStoredArchives } from './lib/archive-store';
import { filterGenealogyData } from './lib/branch-filter';
import { realtimeClient } from './lib/realtime-client';
import { hashPassword } from './lib/crypto';
import { 
  auth, 
  loginWithGoogle, 
  logoutUser, 
  testFirestoreConnection 
} from './lib/firebase';
import { 
  saveTreeToFirestore, 
  subscribeToTree, 
  saveArchiveToFirestore, 
  deleteArchiveFromFirestore, 
  subscribeToArchives, 
  saveAccessToFirestore, 
  subscribeToAccessList 
} from './lib/firestore-sync';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { Shield, Sparkles, Database } from 'lucide-react';

const LOCAL_DATA_KEY = 'genealogor_tree_data_v2';
const ACCESS_LIST_KEY = 'genealogor_access_list_v2';

export default function App() {
  // Main state
  const [data, setData] = useState<GenealogyData>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_DATA_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return getSampleGenealogy();
  });

  const [archives, setArchives] = useState<ArchiveDocument[]>(() => getStoredArchives());
  const [activeTab, setActiveTab] = useState<ActiveTab>('tree');
  const [selectedPersonId, setSelectedPersonId] = useState<string>(() => data.rootPersonId || Object.keys(data.individuals)[0]);

  // Firebase Auth & Cloud Sync state
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [isCloudSynced, setIsCloudSynced] = useState<boolean>(false);

  // Modals state
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Individual | null>(null);

  // Access control & Private branch links
  const [accessList, setAccessList] = useState<BranchAccess[]>(() => {
    try {
      const saved = localStorage.getItem(ACCESS_LIST_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
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

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // 1. Initialize Firebase Auth and Connection Verification
  useEffect(() => {
    testFirestoreConnection().then(ok => {
      if (ok) setIsCloudSynced(true);
    });

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        showToast(`Connecté avec Google : ${user.displayName || user.email}`);
        setIsCloudSynced(true);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // 2. Subscribe to Firestore when room/tree changes and user is ready
  useEffect(() => {
    if (!roomId) return;

    const unsubTree = subscribeToTree(roomId, (remoteData) => {
      if (remoteData && Object.keys(remoteData.individuals).length > 0) {
        setData(remoteData);
        setIsCloudSynced(true);
      }
    });

    const unsubArch = subscribeToArchives(roomId, (remoteArchives) => {
      if (remoteArchives && remoteArchives.length > 0) {
        setArchives(remoteArchives);
        setIsCloudSynced(true);
      }
    });

    const unsubAccess = subscribeToAccessList(roomId, (remoteAccess) => {
      if (remoteAccess && remoteAccess.length > 0) {
        setAccessList(remoteAccess);
      }
    });

    return () => {
      unsubTree();
      unsubArch();
      unsubAccess();
    };
  }, [roomId]);

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
        if (matchingAccess.passwordHash) {
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

  // 4. Initialize Real-time WebSocket connection
  useEffect(() => {
    realtimeClient.init(
      roomId, 
      currentUser?.displayName || (userRole === 'admin' ? 'Administrateur' : userRole === 'editor' ? 'Éditeur' : 'Visiteur'),
      currentBranchScope
    );

    const unsubConn = realtimeClient.on('connection:change', (info) => {
      setIsWsConnected(info.connected);
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
        setData(msg.payload);
        showToast('Arbre généalogique synchronisé en direct.');
      } else if (msg.action === 'person:edit' && msg.payload) {
        const updatedInd = msg.payload as Individual;
        setData(prev => ({
          ...prev,
          individuals: { ...prev.individuals, [updatedInd.id]: updatedInd }
        }));
        showToast(`Fiche de ${updatedInd.name} mise à jour en direct.`);
      } else if (msg.action === 'archive:add' && msg.payload) {
        const newArchive = msg.payload as ArchiveDocument;
        setArchives(prev => [newArchive, ...prev.filter(a => a.id !== newArchive.id)]);
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

  // 5. Local Storage Fallback Persistence
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_DATA_KEY, JSON.stringify(data));
    } catch (e) {}
  }, [data]);

  useEffect(() => {
    saveStoredArchives(archives);
  }, [archives]);

  useEffect(() => {
    try {
      localStorage.setItem(ACCESS_LIST_KEY, JSON.stringify(accessList));
    } catch (e) {}
  }, [accessList]);

  // Auth Handlers
  const handleLogin = async () => {
    try {
      await loginWithGoogle();
    } catch (e) {
      showToast('Connexion Google annulée ou impossible.');
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
    const inputHash = await hashPassword(enteredPassword);
    if (inputHash === pendingBranchAccess.passwordHash || enteredPassword === pendingBranchAccess.password) {
      setCurrentBranchScope(pendingBranchAccess.branch);
      setUserRole(pendingBranchAccess.role);
      setIsUnlocked(true);
      showToast(`Accès déverrouillé : ${pendingBranchAccess.name}`);
      return true;
    }
    return false;
  };

  // Branch filtering: get active tree data for current viewer
  const effectiveData = React.useMemo(() => {
    if (currentBranchScope === 'all') return data;
    return filterGenealogyData(data, data.rootPersonId || Object.keys(data.individuals)[0], currentBranchScope, true);
  }, [data, currentBranchScope]);

  // Archive count per person
  const archiveCountByPerson = React.useMemo(() => {
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
    };
    setData(nextData);
    
    // Broadcast via WebSocket
    realtimeClient.sendAction('person:edit', updated);

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
    setArchives(prev => [newDoc, ...prev]);
    realtimeClient.sendAction('archive:add', newDoc);

    try {
      await saveArchiveToFirestore(roomId, newDoc, currentUser);
      setIsCloudSynced(true);
    } catch (e) {
      console.warn('Firestore archive save fallback', e);
    }

    showToast(`Acte archivé : ${newDoc.title}`);
  };

  const handleUpdateArchive = async (updated: ArchiveDocument) => {
    setArchives(prev => prev.map(a => a.id === updated.id ? updated : a));
    realtimeClient.sendAction('archive:add', updated);

    try {
      await saveArchiveToFirestore(roomId, updated, currentUser);
      setIsCloudSynced(true);
    } catch (e) {
      console.warn('Firestore archive update fallback', e);
    }

    showToast(`Acte mis à jour : ${updated.title}`);
  };

  const handleDeleteArchive = async (id: string) => {
    setArchives(prev => prev.filter(a => a.id !== id));
    
    try {
      await deleteArchiveFromFirestore(roomId, id);
    } catch (e) {
      console.warn('Firestore delete fallback', e);
    }

    showToast('Acte supprimé du fonds d\'archives.');
  };

  const handleLoadGedcom = async (newData: GenealogyData) => {
    setData(newData);
    if (newData.rootPersonId) setSelectedPersonId(newData.rootPersonId);
    realtimeClient.sendAction('tree:update', newData);

    try {
      await saveTreeToFirestore(roomId, newData, currentUser);
      setIsCloudSynced(true);
    } catch (e) {
      console.warn('Firestore sync fallback', e);
    }

    showToast('Nouvel arbre GEDCOM chargé et synchronisé.');
  };

  const handleResetSample = async () => {
    const sample = getSampleGenealogy();
    setData(sample);
    setSelectedPersonId(sample.rootPersonId || Object.keys(sample.individuals)[0]);
    realtimeClient.sendAction('tree:update', sample);

    try {
      await saveTreeToFirestore(roomId, sample, currentUser);
    } catch (e) {}

    showToast('Arbre de démonstration restauré.');
  };

  const handleAddAccessRule = async (newAcc: BranchAccess) => {
    setAccessList(prev => [newAcc, ...prev]);
    try {
      await saveAccessToFirestore(roomId, newAcc);
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
      />

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
          />
        )}

        {activeTab === 'profile' && (
          <ProfileView
            personId={selectedPersonId}
            data={effectiveData}
            archives={archives}
            onSelectPerson={setSelectedPersonId}
            onEditPerson={(p) => setEditingPerson(p)}
            onOpenArchives={() => setActiveTab('archives')}
            onSelectArchive={(docId) => setActiveTab('archives')}
          />
        )}

        {activeTab === 'archives' && (
          <ArchivesView
            archives={archives}
            data={data}
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

      {/* Floating utility quick actions button for GEDCOM import/export */}
      <div className="fixed bottom-4 right-4 z-30">
        <button
          onClick={() => setIsExportModalOpen(true)}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-stone-800 bg-white/95 border border-stone-300 shadow-md hover:bg-stone-50 transition-all backdrop-blur-xs"
        >
          <Database className="w-3.5 h-3.5 text-amber-800" />
          <span>Fichiers & GEDCOM</span>
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
          setAccessList(prev => prev.filter(a => a.id !== id));
          showToast('Lien d\'accès révoqué.');
        }}
        rootPersonId={data.rootPersonId || Object.keys(data.individuals)[0]}
      />

      {/* Export / Import GEDCOM Modal */}
      <ExportImportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        data={data}
        archives={archives}
        onLoadGedcom={handleLoadGedcom}
        onResetSample={handleResetSample}
      />

      {/* Edit Person Modal */}
      <EditPersonModal
        person={editingPerson}
        isOpen={!!editingPerson}
        onClose={() => setEditingPerson(null)}
        onSave={handleUpdatePerson}
      />

      {/* Footer */}
      <footer className="border-t border-stone-200/80 bg-stone-100/60 py-4 px-6 text-center text-xs text-stone-500 font-mono">
        <span>Genealogor · Recherche historique, archives numérisées, synchronisation Firestore et collaboration familiale</span>
      </footer>

    </div>
  );
}
