import React from 'react';
import { Share2, Users, Shield, BookOpen, Clock, MapPin, BarChart3, GitFork } from 'lucide-react';
import { BranchAccess, BranchRole } from '../types/genealogy';

export type ActiveTab = 'tree' | 'profile' | 'archives' | 'timeline' | 'map' | 'stats';

interface NavbarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onOpenShareModal: () => void;
  onOpenExportModal: () => void;
  currentAccess?: BranchAccess;
  userRole: BranchRole;
  connectedPeerCount: number;
  isWsConnected: boolean;
  treeTitle: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  onOpenShareModal,
  currentAccess,
  userRole,
  connectedPeerCount,
  isWsConnected,
  treeTitle,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-[#FBF9F5]/95 backdrop-blur-md border-b border-stone-200/80 px-4 md:px-8 py-3 transition-colors">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-8">
        
        {/* Zone 1: Single text element wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => onTabChange('tree')}
            className="text-left group focus:outline-none"
          >
            <span className="font-serif text-2xl font-bold tracking-tight text-stone-900 group-hover:text-amber-800 transition-colors">
              Genealogor
            </span>
            <span className="hidden sm:inline-block ml-2 text-xs font-mono text-stone-500 tracking-wider">
              {currentAccess?.branch === 'paternal' ? '· Branche Paternelle' : currentAccess?.branch === 'maternal' ? '· Branche Maternelle' : ''}
            </span>
          </button>
        </div>

        {/* Zone 2: Navigation Links (single-line whitespace-nowrap) */}
        <nav className="hidden lg:flex items-center gap-1 xl:gap-2 text-sm font-medium text-stone-600">
          <button
            onClick={() => onTabChange('tree')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'tree' ? 'text-amber-900 bg-amber-50 font-semibold shadow-xs' : 'hover:text-stone-900 hover:bg-stone-100/70'
            }`}
          >
            <GitFork className="w-4 h-4 text-amber-700" />
            <span>Arbre</span>
          </button>

          <button
            onClick={() => onTabChange('profile')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'profile' ? 'text-amber-900 bg-amber-50 font-semibold shadow-xs' : 'hover:text-stone-900 hover:bg-stone-100/70'
            }`}
          >
            <Users className="w-4 h-4 text-stone-600" />
            <span>Fiche Individu</span>
          </button>

          <button
            onClick={() => onTabChange('archives')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'archives' ? 'text-amber-900 bg-amber-50 font-semibold shadow-xs' : 'hover:text-stone-900 hover:bg-stone-100/70'
            }`}
          >
            <BookOpen className="w-4 h-4 text-amber-800" />
            <span>Archives & Actes</span>
          </button>

          <button
            onClick={() => onTabChange('timeline')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'timeline' ? 'text-amber-900 bg-amber-50 font-semibold shadow-xs' : 'hover:text-stone-900 hover:bg-stone-100/70'
            }`}
          >
            <Clock className="w-4 h-4 text-stone-600" />
            <span>Chronologie</span>
          </button>

          <button
            onClick={() => onTabChange('map')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'map' ? 'text-amber-900 bg-amber-50 font-semibold shadow-xs' : 'hover:text-stone-900 hover:bg-stone-100/70'
            }`}
          >
            <MapPin className="w-4 h-4 text-stone-600" />
            <span>Carte</span>
          </button>

          <button
            onClick={() => onTabChange('stats')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'stats' ? 'text-amber-900 bg-amber-50 font-semibold shadow-xs' : 'hover:text-stone-900 hover:bg-stone-100/70'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-stone-600" />
            <span>Statistiques</span>
          </button>
        </nav>

        {/* Zone 3: 1 Primary Action (Partager) + statut de collaboration */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Indicateur de présence collaborative */}
          <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-stone-600 bg-stone-100/80 px-2.5 py-1 rounded-full border border-stone-200/60">
            <span
              className={`w-2 h-2 rounded-full ${
                isWsConnected ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
            <span>{connectedPeerCount} en direct</span>
          </div>

          {/* Bouton de partage sécurisé */}
          <button
            onClick={onOpenShareModal}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold tracking-wide text-white bg-amber-900 hover:bg-amber-950 active:scale-98 rounded-lg shadow-sm transition-all whitespace-nowrap shrink-0"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Partager l'Arbre</span>
          </button>
        </div>
      </div>

      {/* Mobile nav bar navigation */}
      <div className="lg:hidden flex items-center justify-between gap-1 overflow-x-auto pt-2 pb-1 border-t border-stone-200/60 mt-2 text-xs">
        <button
          onClick={() => onTabChange('tree')}
          className={`px-2.5 py-1 rounded whitespace-nowrap ${activeTab === 'tree' ? 'font-bold text-amber-900 bg-amber-50' : 'text-stone-600'}`}
        >
          Arbre
        </button>
        <button
          onClick={() => onTabChange('profile')}
          className={`px-2.5 py-1 rounded whitespace-nowrap ${activeTab === 'profile' ? 'font-bold text-amber-900 bg-amber-50' : 'text-stone-600'}`}
        >
          Fiche
        </button>
        <button
          onClick={() => onTabChange('archives')}
          className={`px-2.5 py-1 rounded whitespace-nowrap ${activeTab === 'archives' ? 'font-bold text-amber-900 bg-amber-50' : 'text-stone-600'}`}
        >
          Archives & Actes
        </button>
        <button
          onClick={() => onTabChange('timeline')}
          className={`px-2.5 py-1 rounded whitespace-nowrap ${activeTab === 'timeline' ? 'font-bold text-amber-900 bg-amber-50' : 'text-stone-600'}`}
        >
          Chronologie
        </button>
        <button
          onClick={() => onTabChange('map')}
          className={`px-2.5 py-1 rounded whitespace-nowrap ${activeTab === 'map' ? 'font-bold text-amber-900 bg-amber-50' : 'text-stone-600'}`}
        >
          Carte
        </button>
        <button
          onClick={() => onTabChange('stats')}
          className={`px-2.5 py-1 rounded whitespace-nowrap ${activeTab === 'stats' ? 'font-bold text-amber-900 bg-amber-50' : 'text-stone-600'}`}
        >
          Stats
        </button>
      </div>
    </header>
  );
};
