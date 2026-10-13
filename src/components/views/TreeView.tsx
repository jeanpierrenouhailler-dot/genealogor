import React, { useState } from 'react';
import { 
  Users, User, ChevronRight, ChevronDown, Award, 
  MapPin, Calendar, FileText, Search, ZoomIn, ZoomOut, RotateCcw,
  Sparkles, ShieldCheck
} from 'lucide-react';
import { GenealogyData, Individual } from '../../types/genealogy';
import { computeSosaNumbers } from '../../lib/sosa-aboville';

interface TreeViewProps {
  data: GenealogyData;
  selectedPersonId: string;
  onSelectPerson: (id: string) => void;
  onViewProfile: (id: string) => void;
  onViewArchives?: (personId: string) => void;
  archiveCountByPerson?: Record<string, number>;
}

export const TreeView: React.FC<TreeViewProps> = ({
  data,
  selectedPersonId,
  onSelectPerson,
  onViewProfile,
  onViewArchives,
  archiveCountByPerson = {},
}) => {
  const [treeMode, setTreeMode] = useState<'ancestors' | 'descendants'>('ancestors');
  const [generationsCount, setGenerationsCount] = useState<number>(4);
  const [searchFilter, setSearchFilter] = useState('');

  const currentPerson = data.individuals[selectedPersonId] || Object.values(data.individuals)[0];
  const sosaMap = computeSosaNumbers(data, selectedPersonId);

  // Search individuals
  const filteredIndividuals = searchFilter.trim()
    ? Object.values(data.individuals).filter(ind =>
        ind.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
        (ind.birth?.place && ind.birth.place.toLowerCase().includes(searchFilter.toLowerCase()))
      )
    : [];

  // Helper to get parents
  const getParents = (personId: string): { father?: Individual; mother?: Individual } => {
    const person = data.individuals[personId];
    if (!person) return {};
    for (const famId of person.familiesAsChild) {
      const fam = data.families[famId];
      if (fam) {
        return {
          father: fam.husbandId ? data.individuals[fam.husbandId] : undefined,
          mother: fam.wifeId ? data.individuals[fam.wifeId] : undefined,
        };
      }
    }
    return {};
  };

  // Helper to get children
  const getChildren = (personId: string): Individual[] => {
    const person = data.individuals[personId];
    if (!person) return [];
    const children: Individual[] = [];
    for (const famId of person.familiesAsSpouse) {
      const fam = data.families[famId];
      if (fam) {
        for (const childId of fam.childrenIds) {
          if (data.individuals[childId]) {
            children.push(data.individuals[childId]);
          }
        }
      }
    }
    return children;
  };

  // Recursive Ancestor Node
  const renderAncestorNode = (person: Individual | undefined, gen: number, sosa: number) => {
    if (gen > generationsCount) return null;

    if (!person) {
      return (
        <div className="flex flex-col items-center">
          <div className="w-52 p-3 rounded-xl border border-dashed border-stone-300 bg-stone-50/50 text-center text-xs text-stone-400 italic">
            Ancêtre non renseigné
          </div>
        </div>
      );
    }

    const { father, mother } = getParents(person.id);
    const isSelected = person.id === selectedPersonId;
    const hasArchives = archiveCountByPerson[person.id] > 0;

    return (
      <div className="flex flex-col items-center">
        {/* Person Card */}
        <div
          onClick={() => onSelectPerson(person.id)}
          className={`w-56 p-3.5 rounded-xl border transition-all cursor-pointer relative shadow-xs text-left group ${
            isSelected
              ? 'bg-amber-50 border-amber-800 ring-2 ring-amber-800/40 shadow-sm'
              : 'bg-white border-stone-200/90 hover:border-stone-400 hover:bg-stone-50/70'
          }`}
        >
          {/* Top meta tags */}
          <div className="flex items-center justify-between gap-1 text-[10px] font-mono text-stone-500 mb-1">
            <span className="flex items-center gap-1 font-semibold text-stone-700">
              <span className={`w-2 h-2 rounded-full ${person.sex === 'M' ? 'bg-blue-600' : 'bg-rose-500'}`} />
              {sosaMap[person.id] ? `Sosa ${sosaMap[person.id]}` : `Gén. ${gen}`}
            </span>
            {hasArchives && (
              <span className="bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded font-medium flex items-center gap-0.5">
                <FileText className="w-2.5 h-2.5" />
                <span>{archiveCountByPerson[person.id]} acte(s)</span>
              </span>
            )}
          </div>

          {/* Name */}
          <h4 className="font-serif text-sm font-bold text-stone-900 group-hover:text-amber-900 transition-colors line-clamp-1">
            {person.name}
          </h4>

          {/* Dates & places */}
          <div className="mt-1.5 space-y-0.5 text-[11px] text-stone-600">
            {person.birth?.date && (
              <div className="flex items-center gap-1.5 truncate">
                <span className="text-stone-400 font-mono">°</span>
                <span className="font-mono">{person.birth.date}</span>
                {person.birth.place && <span className="text-stone-400 truncate">· {person.birth.place.split(',')[0]}</span>}
              </div>
            )}
            {person.death?.date && (
              <div className="flex items-center gap-1.5 truncate">
                <span className="text-stone-400 font-mono">+</span>
                <span className="font-mono">{person.death.date}</span>
                {person.death.place && <span className="text-stone-400 truncate">· {person.death.place.split(',')[0]}</span>}
              </div>
            )}
          </div>

          {/* View Profile Action */}
          <div className="mt-2.5 pt-2 border-t border-stone-100 flex items-center justify-between text-[10px] text-stone-500">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onViewProfile(person.id);
              }}
              className="font-medium text-amber-800 hover:underline"
            >
              Fiche biographique →
            </button>
          </div>
        </div>

        {/* Tree branch connections */}
        {gen < generationsCount && (father || mother) && (
          <div className="flex flex-col items-center w-full">
            <div className="w-px h-6 bg-stone-300" />
            <div className="relative flex justify-center gap-6 pt-6 border-t border-stone-300 w-full">
              {renderAncestorNode(father, gen + 1, sosa * 2)}
              {renderAncestorNode(mother, gen + 1, sosa * 2 + 1)}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-6">
      
      {/* Control bar */}
      <div className="bg-white border border-stone-200/90 rounded-2xl p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Selected focal individual */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-900 font-serif font-bold text-lg flex items-center justify-center shrink-0">
            {currentPerson.givenName?.[0] || currentPerson.name[0]}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-serif text-lg font-bold text-stone-900">
                {currentPerson.name}
              </h2>
              {sosaMap[currentPerson.id] && (
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200/60">
                  Sosa {sosaMap[currentPerson.id]}
                </span>
              )}
            </div>
            <p className="text-xs text-stone-500">
              Racine actuelle de l'arbre · {currentPerson.birth?.date || 'Date inconnue'} {currentPerson.birth?.place ? `à ${currentPerson.birth.place.split(',')[0]}` : ''}
            </p>
          </div>
        </div>

        {/* Quick search & Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative w-56">
            <input
              type="text"
              value={searchFilter}
              onChange={e => setSearchFilter(e.target.value)}
              placeholder="Changer d'individu..."
              className="w-full text-xs bg-stone-50 border border-stone-200 rounded-lg pl-8 pr-3 py-1.5 text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-amber-800"
            />
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-2" />

            {/* Autocomplete dropdown */}
            {filteredIndividuals.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-stone-200 rounded-xl shadow-lg max-h-48 overflow-y-auto z-30 p-1">
                {filteredIndividuals.slice(0, 8).map(ind => (
                  <button
                    key={ind.id}
                    onClick={() => {
                      onSelectPerson(ind.id);
                      setSearchFilter('');
                    }}
                    className="w-full text-left p-1.5 hover:bg-amber-50 rounded text-xs text-stone-800 flex items-center justify-between"
                  >
                    <span className="font-medium truncate">{ind.name}</span>
                    <span className="text-[10px] text-stone-400 font-mono">{ind.birth?.date || ''}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Mode ascendance vs descendance */}
          <div className="flex items-center p-1 bg-stone-100 rounded-lg text-xs font-medium text-stone-600">
            <button
              onClick={() => setTreeMode('ancestors')}
              className={`px-3 py-1 rounded-md transition-colors ${
                treeMode === 'ancestors' ? 'bg-white text-stone-900 shadow-2xs font-semibold' : 'hover:text-stone-900'
              }`}
            >
              Ascendance
            </button>
            <button
              onClick={() => setTreeMode('descendants')}
              className={`px-3 py-1 rounded-md transition-colors ${
                treeMode === 'descendants' ? 'bg-white text-stone-900 shadow-2xs font-semibold' : 'hover:text-stone-900'
              }`}
            >
              Descendance
            </button>
          </div>

          {/* Nombre de générations */}
          <div className="flex items-center gap-1.5 text-xs text-stone-600 font-mono">
            <span>Générations:</span>
            {[3, 4, 5].map(n => (
              <button
                key={n}
                onClick={() => setGenerationsCount(n)}
                className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${
                  generationsCount === n ? 'bg-amber-900 text-white font-bold' : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Interactive Tree Rendering Canvas */}
      <div className="bg-[#F7F4EE]/60 border border-stone-200/90 rounded-2xl p-8 min-h-[500px] overflow-x-auto overflow-y-auto flex items-center justify-center shadow-inner">
        {treeMode === 'ancestors' ? (
          <div className="inline-block py-6">
            {renderAncestorNode(currentPerson, 1, 1)}
          </div>
        ) : (
          /* Descendance View */
          <div className="space-y-6 w-full max-w-2xl py-6">
            <div className="p-4 bg-white border border-stone-200 rounded-xl shadow-xs">
              <span className="text-xs font-mono text-stone-500 uppercase tracking-widest block mb-1">Racine</span>
              <h3 className="font-serif text-lg font-bold text-stone-900">{currentPerson.name}</h3>
              <p className="text-xs text-stone-600 mt-1">{currentPerson.birth?.date} — {currentPerson.death?.date || 'Vivant'}</p>
            </div>

            <div className="space-y-3 pl-6 border-l-2 border-amber-700/40">
              <span className="text-xs font-semibold text-stone-700 uppercase tracking-wider block">
                Enfants directs ({getChildren(currentPerson.id).length})
              </span>

              {getChildren(currentPerson.id).length === 0 ? (
                <p className="text-xs text-stone-500 italic">Aucun enfant répertorié pour cette personne.</p>
              ) : (
                getChildren(currentPerson.id).map(child => (
                  <div
                    key={child.id}
                    onClick={() => onSelectPerson(child.id)}
                    className="p-3 bg-white border border-stone-200 hover:border-amber-700 rounded-xl cursor-pointer transition-all flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${child.sex === 'M' ? 'bg-blue-600' : 'bg-rose-500'}`} />
                        <h4 className="font-serif text-sm font-bold text-stone-900">{child.name}</h4>
                      </div>
                      <span className="text-xs text-stone-500 block mt-0.5">
                        {child.birth?.date || 'Date inconnue'} {child.birth?.place ? `à ${child.birth.place.split(',')[0]}` : ''}
                      </span>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewProfile(child.id);
                      }}
                      className="text-xs text-amber-800 hover:underline font-medium"
                    >
                      Fiche →
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

    </div>
  );
};
