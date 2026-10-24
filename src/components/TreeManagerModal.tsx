import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, FolderTree, Plus, Search, Check, RefreshCw, Cloud, HardDrive, 
  Trash2, ArrowRight, Sparkles, AlertCircle, Info, ExternalLink, GitFork, Users
} from 'lucide-react';
import { User } from 'firebase/auth';
import { 
  KnownTree, 
  getKnownTrees, 
  recordKnownTree, 
  removeKnownTreeFromLocal, 
  slugifyTreeId, 
  isValidTreeId,
  DEFAULT_SAMPLE_TREE
} from '../lib/tree-manager';
import { listUserTreesFromFirestore, TreeFirestoreSummary } from '../lib/firestore-sync';
import { InfoTooltip } from './InfoTooltip';
import { getSampleGenealogy, createEmptyGenealogy } from '../lib/sample-data';
import { GenealogyData } from '../types/genealogy';

interface TreeManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRoomId: string;
  currentTreeTitle: string;
  currentPersonCount: number;
  currentArchiveCount: number;
  currentUser: User | null;
  onSwitchTree: (treeId: string, title?: string, templateData?: GenealogyData) => void;
}

export const TreeManagerModal: React.FC<TreeManagerModalProps> = ({
  isOpen,
  onClose,
  currentRoomId,
  currentTreeTitle,
  currentPersonCount,
  currentArchiveCount,
  currentUser,
  onSwitchTree,
}) => {
  const [activeTab, setActiveTab] = useState<'switch' | 'create'>('switch');
  const [searchTerm, setSearchTerm] = useState('');
  const [knownTrees, setKnownTrees] = useState<KnownTree[]>([]);
  const [firestoreTrees, setFirestoreTrees] = useState<TreeFirestoreSummary[]>([]);
  const [isLoadingCloud, setIsLoadingCloud] = useState(false);
  const [cloudError, setCloudError] = useState<string | null>(null);

  // Formulaire de création
  const [newTitle, setNewTitle] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);
  const [starterTemplate, setStarterTemplate] = useState<'empty' | 'sample'>('empty');
  const [formError, setFormError] = useState<string | null>(null);

  // Charger les arbres connus et Firestore à l'ouverture
  useEffect(() => {
    if (!isOpen) return;
    const local = getKnownTrees();
    setKnownTrees(local);

    // Enregistrer l'arbre courant s'il n'est pas encore consigné
    if (currentRoomId) {
      recordKnownTree({
        id: currentRoomId,
        title: currentTreeTitle || currentRoomId,
        personCount: currentPersonCount,
        lastOpenedAt: Date.now(),
      });
    }

    if (currentUser) {
      loadFirestoreTrees();
    }
  }, [isOpen, currentRoomId, currentTreeTitle, currentPersonCount, currentUser]);

  const loadFirestoreTrees = async () => {
    if (!currentUser) return;
    setIsLoadingCloud(true);
    setCloudError(null);
    try {
      const list = await listUserTreesFromFirestore(currentUser);
      setFirestoreTrees(list);

      // Fusionner les arbres Firestore dans les arbres connus locaux
      for (const ft of list) {
        recordKnownTree({
          id: ft.id,
          title: ft.title,
          personCount: ft.personCount,
          ownerEmail: ft.ownerEmail,
          lastOpenedAt: ft.updatedAt ? new Date(ft.updatedAt).getTime() : Date.now(),
        });
      }
      setKnownTrees(getKnownTrees());
    } catch (e: any) {
      setCloudError('Impossible de récupérer la liste des arbres Firestore.');
    } finally {
      setIsLoadingCloud(false);
    }
  };

  // Synchroniser le slug avec le titre lors de la frappe
  const handleTitleChange = (val: string) => {
    setNewTitle(val);
    if (!isSlugManuallyEdited) {
      setNewSlug(slugifyTreeId(val));
    }
    setFormError(null);
  };

  const handleSlugChange = (val: string) => {
    setIsSlugManuallyEdited(true);
    setNewSlug(slugifyTreeId(val));
    setFormError(null);
  };

  // Liste fusionnée dédoublonnée
  const allTrees = useMemo(() => {
    const map = new Map<string, KnownTree>();

    for (const tree of knownTrees) {
      map.set(tree.id, tree);
    }

    for (const ft of firestoreTrees) {
      const existing = map.get(ft.id);
      map.set(ft.id, {
        id: ft.id,
        title: ft.title,
        personCount: ft.personCount ?? existing?.personCount,
        ownerEmail: ft.ownerEmail,
        lastOpenedAt: existing?.lastOpenedAt || Date.now(),
        isSample: ft.id === DEFAULT_SAMPLE_TREE.id,
      });
    }

    return Array.from(map.values()).sort((a, b) => {
      // Arbre actuel en premier, puis par date d'ouverture
      if (a.id === currentRoomId) return -1;
      if (b.id === currentRoomId) return 1;
      return b.lastOpenedAt - a.lastOpenedAt;
    });
  }, [knownTrees, firestoreTrees, currentRoomId]);

  // Filtrage par recherche
  const filteredTrees = useMemo(() => {
    if (!searchTerm.trim()) return allTrees;
    const q = searchTerm.toLowerCase();
    return allTrees.filter(t => 
      t.title.toLowerCase().includes(q) || 
      t.id.toLowerCase().includes(q)
    );
  }, [allTrees, searchTerm]);

  // Action : Basculer sur un arbre
  const handleSelectTree = (treeId: string, title?: string) => {
    if (treeId === currentRoomId) {
      onClose();
      return;
    }
    recordKnownTree({ id: treeId, title: title || treeId, lastOpenedAt: Date.now() });
    onSwitchTree(treeId, title);
    onClose();
  };

  // Action : Supprimer de l'historique local
  const handleDeleteLocal = (e: React.MouseEvent, treeId: string) => {
    e.stopPropagation();
    const updated = removeKnownTreeFromLocal(treeId);
    setKnownTrees(updated);
  };

  // Action : Création d'un nouvel arbre
  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = slugifyTreeId(newSlug || newTitle);
    
    if (!isValidTreeId(cleanId)) {
      setFormError('L\'identifiant doit comporter entre 3 et 64 caractères alphanumériques ou tirets (a-z, 0-9, -).');
      return;
    }

    const title = newTitle.trim() || `Arbre ${cleanId}`;
    const initialData = starterTemplate === 'sample' 
      ? getSampleGenealogy() 
      : createEmptyGenealogy(title);

    initialData.sourceHeader = title;

    recordKnownTree({
      id: cleanId,
      title,
      personCount: Object.keys(initialData.individuals).length,
      lastOpenedAt: Date.now(),
    });

    onSwitchTree(cleanId, title, initialData);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="tree-manager-title"
        className="bg-[#FBF9F5] dark:bg-[#1A1D24] border border-stone-300 dark:border-stone-700 shadow-2xl rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden text-stone-900 dark:text-stone-100 transition-colors"
      >
        {/* En-tête */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200/80 dark:border-stone-800 bg-stone-100/70 dark:bg-stone-900/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300">
              <FolderTree className="w-5 h-5" />
            </div>
            <div>
              <h2 id="tree-manager-title" className="font-serif text-lg font-bold text-stone-900 dark:text-stone-100">
                Gestionnaire d'Arbres Généalogiques
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Basculez entre vos différentes familles ou créez un nouvel arbre indépendant.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-100 rounded-lg hover:bg-stone-200/50 dark:hover:bg-stone-800 transition-colors cursor-pointer"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Encadré Arbre Actif */}
        <div className="px-6 pt-4 pb-2">
          <div className="p-3.5 rounded-xl bg-amber-50/90 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/40 flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-mono font-bold tracking-wider px-1.5 py-0.5 rounded bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200">
                  Arbre Actif
                </span>
                <span className="font-serif font-bold text-base text-stone-900 dark:text-stone-100 truncate">
                  {currentTreeTitle || 'Famille Martin'}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-stone-600 dark:text-stone-300 font-mono">
                <span>Salon : <strong>{currentRoomId}</strong></span>
                <span>•</span>
                <span>{currentPersonCount} individu(s)</span>
                <span>•</span>
                <span>{currentArchiveCount} acte(s)</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-md">
                <Check className="w-3 h-3" /> Connecté
              </span>
            </div>
          </div>
        </div>

        {/* Onglets Navigation Modale */}
        <div className="px-6 pt-2 flex border-b border-stone-200 dark:border-stone-800">
          <button
            type="button"
            onClick={() => setActiveTab('switch')}
            className={`pb-3 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'switch'
                ? 'border-amber-900 dark:border-amber-400 text-amber-900 dark:text-amber-400'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-300'
            }`}
          >
            <FolderTree className="w-4 h-4" />
            <span>Mes Arbres ({allTrees.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`pb-3 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'create'
                ? 'border-amber-900 dark:border-amber-400 text-amber-900 dark:text-amber-400'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-300'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>Créer un Nouvel Arbre</span>
          </button>
        </div>

        {/* Corps de la Modale */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          
          {/* ONGLET 1 : CHANGER D'ARBRE / LISTE */}
          {activeTab === 'switch' && (
            <div className="space-y-4">
              
              {/* Barre d'outils liste : Recherche + Actualiser Cloud */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Filtrer par nom ou identifiant de salon..."
                    className="w-full text-xs bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg pl-8 pr-3 py-2 text-stone-800 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-amber-800"
                  />
                  <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-2.5" />
                </div>

                {currentUser && (
                  <button
                    type="button"
                    onClick={loadFirestoreTrees}
                    disabled={isLoadingCloud}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-stone-700 dark:text-stone-300 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 rounded-lg border border-stone-300 dark:border-stone-700 transition-colors cursor-pointer"
                    title="Actualiser depuis Google Cloud Firestore"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingCloud ? 'animate-spin text-amber-600' : ''}`} />
                    <span>Actualiser Cloud</span>
                  </button>
                )}
              </div>

              {cloudError && (
                <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-lg text-xs text-rose-800 dark:text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{cloudError}</span>
                </div>
              )}

              {/* Liste des cartes d'arbres */}
              <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                {filteredTrees.map(tree => {
                  const isCurrent = tree.id === currentRoomId;

                  return (
                    <div
                      key={tree.id}
                      onClick={() => handleSelectTree(tree.id, tree.title)}
                      className={`group p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isCurrent
                          ? 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 ring-1 ring-amber-500/40 shadow-xs'
                          : 'bg-white dark:bg-stone-900/60 border-stone-200 dark:border-stone-800 hover:border-amber-300 dark:hover:border-amber-700/60 hover:bg-amber-50/30 dark:hover:bg-stone-800/60'
                      }`}
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-serif font-bold text-sm text-stone-900 dark:text-stone-100 group-hover:text-amber-900 dark:group-hover:text-amber-300 transition-colors">
                            {tree.title}
                          </span>
                          {isCurrent && (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200 font-bold">
                              Actif
                            </span>
                          )}
                          {tree.isSample && (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 border border-stone-200 dark:border-stone-700">
                              Démonstration
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-stone-500 dark:text-stone-400 font-mono">
                          <span className="text-[11px] bg-stone-100 dark:bg-stone-800/80 px-1.5 py-0.5 rounded">
                            salon: {tree.id}
                          </span>
                          {tree.personCount !== undefined && (
                            <span>{tree.personCount} personne(s)</span>
                          )}
                          {tree.ownerEmail && (
                            <span className="truncate max-w-[140px]" title={tree.ownerEmail}>
                              {tree.ownerEmail}
                            </span>
                          )}
                        </div>

                        {tree.description && (
                          <p className="text-xs text-stone-600 dark:text-stone-400 italic truncate">
                            {tree.description}
                          </p>
                        )}
                      </div>

                      {/* Bouton d'action droit */}
                      <div className="flex items-center gap-2 shrink-0">
                        {!isCurrent && (
                          <button
                            type="button"
                            onClick={() => handleSelectTree(tree.id, tree.title)}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-900 hover:bg-amber-950 dark:bg-amber-800 dark:hover:bg-amber-700 text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <span>Ouvrir</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Supprimer de l'historique local (sauf sample et arbre actif) */}
                        {!tree.isSample && !isCurrent && (
                          <button
                            type="button"
                            onClick={(e) => handleDeleteLocal(e, tree.id)}
                            className="p-1.5 text-stone-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                            title="Retirer de l'historique local"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {filteredTrees.length === 0 && (
                  <div className="p-8 text-center text-xs text-stone-500 dark:text-stone-400 space-y-2">
                    <p>Aucun arbre ne correspond à votre recherche.</p>
                    <button
                      type="button"
                      onClick={() => setActiveTab('create')}
                      className="text-amber-800 dark:text-amber-400 font-semibold underline"
                    >
                      Créer un nouvel arbre maintenant →
                    </button>
                  </div>
                )}
              </div>

              {/* Raccourci pour rejoindre par ID direct */}
              <div className="pt-3 border-t border-stone-200 dark:border-stone-800 text-xs text-stone-500 dark:text-stone-400 flex items-center justify-between">
                <span>Vous possédez un identifiant de salon partagé par un proche ?</span>
                <button
                  type="button"
                  onClick={() => {
                    const id = prompt('Entrez l\'identifiant de salon (ex: famille-dupont-1850) :');
                    if (id && isValidTreeId(slugifyTreeId(id))) {
                      handleSelectTree(slugifyTreeId(id));
                    }
                  }}
                  className="font-semibold text-amber-800 dark:text-amber-400 hover:underline cursor-pointer"
                >
                  Rejoindre par identifiant →
                </button>
              </div>

            </div>
          )}

          {/* ONGLET 2 : CRÉER UN NOUVEL ARBRE */}
          {activeTab === 'create' && (
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              
              <div className="space-y-3 bg-white dark:bg-stone-900/60 p-4 rounded-xl border border-stone-200 dark:border-stone-800">
                
                {/* Titre de l'arbre */}
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <label className="text-xs font-semibold text-stone-800 dark:text-stone-200">
                      Nom de la Famille ou Titre de l'Arbre
                    </label>
                    <InfoTooltip content="Nom d'affichage qui apparaîtra dans la barre supérieure et sur les fiches (ex: Famille Bernard, Lignée de Keravel)." />
                  </div>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={e => handleTitleChange(e.target.value)}
                    placeholder="Ex: Famille Bernard, Généalogie d'Auvergne..."
                    className="w-full text-xs bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-2.5 text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-amber-800"
                  />
                </div>

                {/* Slug / Identifiant de salon */}
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <label className="text-xs font-semibold text-stone-800 dark:text-stone-200">
                      Identifiant unique du salon (URL & Firestore)
                    </label>
                    <InfoTooltip content="Identifiant technique unique utilisé dans l'URL ?room=... et dans les règles de stockage Firestore. Lettres minuscules, chiffres et tirets uniquement." />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-stone-400 bg-stone-100 dark:bg-stone-800 px-2 py-2 rounded-lg border border-stone-200 dark:border-stone-700 select-none">
                      ?room=
                    </span>
                    <input
                      type="text"
                      required
                      value={newSlug}
                      onChange={e => handleSlugChange(e.target.value)}
                      placeholder="famille-bernard"
                      className="w-full text-xs font-mono bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-2.5 text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-amber-800"
                    />
                  </div>
                  <span className="text-[11px] text-stone-500 font-mono mt-1 block">
                    Format : 3 à 64 caractères, uniquement a-z, 0-9 et tirets (-)
                  </span>
                </div>

              </div>

              {/* Point de départ */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-stone-800 dark:text-stone-200 block">
                  Contenu initial de l'arbre
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-colors ${
                    starterTemplate === 'empty'
                      ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800'
                      : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 hover:bg-stone-50'
                  }`}>
                    <input
                      type="radio"
                      name="template"
                      value="empty"
                      checked={starterTemplate === 'empty'}
                      onChange={() => setStarterTemplate('empty')}
                      className="mt-0.5 text-amber-800 focus:ring-amber-800"
                    />
                    <div className="text-xs space-y-0.5">
                      <strong className="block text-stone-900 dark:text-stone-100">Arbre Vierge</strong>
                      <span className="text-stone-500 dark:text-stone-400">
                        Démarrez une nouvelle généalogie vide prête pour la saisie manuelle ou un import GEDCOM (.ged).
                      </span>
                    </div>
                  </label>

                  <label className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-colors ${
                    starterTemplate === 'sample'
                      ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800'
                      : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 hover:bg-stone-50'
                  }`}>
                    <input
                      type="radio"
                      name="template"
                      value="sample"
                      checked={starterTemplate === 'sample'}
                      onChange={() => setStarterTemplate('sample')}
                      className="mt-0.5 text-amber-800 focus:ring-amber-800"
                    />
                    <div className="text-xs space-y-0.5">
                      <strong className="block text-stone-900 dark:text-stone-100">Copie Arbre Martin</strong>
                      <span className="text-stone-500 dark:text-stone-400">
                        Duplique les 4 générations d'exemple avec photos pour s'entraîner ou faire des tests.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {formError && (
                <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-lg text-xs text-rose-800 dark:text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Boutons formulaire */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-200 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setActiveTab('switch')}
                  className="px-4 py-2 text-xs font-medium text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors cursor-pointer"
                >
                  Annuler
                </button>

                <button
                  type="submit"
                  className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-amber-900 hover:bg-amber-950 dark:bg-amber-800 dark:hover:bg-amber-700 rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Créer et Ouvrir l'Arbre</span>
                </button>
              </div>

            </form>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-stone-200/80 dark:border-stone-800 bg-stone-100/70 dark:bg-stone-900/60 flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
          <div className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5" />
            <span>Chaque arbre dispose de son propre salon WebSocket et de ses collections d'archives étanches.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="font-medium hover:text-stone-800 dark:hover:text-stone-200"
          >
            Fermer
          </button>
        </div>

      </div>
    </div>
  );
};
