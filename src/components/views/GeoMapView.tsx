import React, { useState } from 'react';
import { MapPin, Users, Calendar, Building, ChevronRight } from 'lucide-react';
import { GenealogyData, Individual } from '../../types/genealogy';

interface GeoMapViewProps {
  data: GenealogyData;
  onSelectPerson: (id: string) => void;
}

interface PlaceSummary {
  name: string;
  count: number;
  events: Array<{
    type: 'birth' | 'marriage' | 'death';
    personName: string;
    personId: string;
    year?: number;
    rawDate?: string;
  }>;
}

export const GeoMapView: React.FC<GeoMapViewProps> = ({ data, onSelectPerson }) => {
  const [selectedPlaceName, setSelectedPlaceName] = useState<string>('');

  const placesMap: Record<string, PlaceSummary> = {};

  // Extract places from individuals
  for (const ind of Object.values(data.individuals)) {
    if (ind.birth?.place) {
      const place = ind.birth.place.trim();
      if (!placesMap[place]) placesMap[place] = { name: place, count: 0, events: [] };
      placesMap[place].count++;
      placesMap[place].events.push({
        type: 'birth',
        personName: ind.name,
        personId: ind.id,
        year: ind.birth.parsedDate?.year,
        rawDate: ind.birth.date,
      });
    }

    if (ind.death?.place) {
      const place = ind.death.place.trim();
      if (!placesMap[place]) placesMap[place] = { name: place, count: 0, events: [] };
      placesMap[place].count++;
      placesMap[place].events.push({
        type: 'death',
        personName: ind.name,
        personId: ind.id,
        year: ind.death.parsedDate?.year,
        rawDate: ind.death.date,
      });
    }
  }

  // Extract places from marriages
  for (const fam of Object.values(data.families)) {
    if (fam.marriage?.place) {
      const place = fam.marriage.place.trim();
      const husb = fam.husbandId ? data.individuals[fam.husbandId] : undefined;
      const wife = fam.wifeId ? data.individuals[fam.wifeId] : undefined;
      const names = [husb?.name, wife?.name].filter(Boolean).join(' & ');

      if (!placesMap[place]) placesMap[place] = { name: place, count: 0, events: [] };
      placesMap[place].count++;
      placesMap[place].events.push({
        type: 'marriage',
        personName: names,
        personId: husb?.id || wife?.id || '',
        year: fam.marriage.parsedDate?.year,
        rawDate: fam.marriage.date,
      });
    }
  }

  const sortedPlaces = Object.values(placesMap).sort((a, b) => b.count - a.count);
  const activePlace = placesMap[selectedPlaceName] || sortedPlaces[0];

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 space-y-6">
      
      {/* Header */}
      <div className="border-b border-stone-200/80 pb-4">
        <span className="text-xs uppercase tracking-widest font-mono text-stone-500">
          GÉOGRAPHIE FAMILIALE & MIGRATIONS
        </span>
        <h1 className="font-serif text-3xl font-bold text-stone-900 mt-1">
          Territoires & Berceaux d'Origine
        </h1>
        <p className="text-xs text-stone-600 mt-0.5">
          Découvrez la répartition des foyers familiaux à travers les paroisses, communes et départements au fil des générations.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Top Places List (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider font-mono text-stone-500">
            Foyers Géographiques Répertoriés ({sortedPlaces.length})
          </h2>

          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {sortedPlaces.map(place => {
              const isSelected = place.name === (activePlace?.name);

              return (
                <div
                  key={place.name}
                  onClick={() => setSelectedPlaceName(place.name)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between text-left ${
                    isSelected
                      ? 'bg-amber-50/80 border-amber-800 shadow-xs ring-1 ring-amber-800'
                      : 'bg-white border-stone-200 hover:border-stone-400 hover:bg-stone-50/50'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <MapPin className={`w-4 h-4 mt-0.5 shrink-0 ${isSelected ? 'text-amber-800' : 'text-stone-400'}`} />
                    <div>
                      <h3 className="font-serif text-sm font-semibold text-stone-900">
                        {place.name.split(',')[0]}
                      </h3>
                      <span className="text-xs text-stone-500 block truncate max-w-[220px]">
                        {place.name.split(',').slice(1).join(',')}
                      </span>
                    </div>
                  </div>

                  <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-md bg-stone-100 text-stone-800 shrink-0">
                    {place.count} acte(s)
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Place detail & events list (7 cols) */}
        <div className="lg:col-span-7">
          {activePlace ? (
            <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm space-y-6">
              
              <div className="border-b border-stone-100 pb-4">
                <span className="text-[10px] uppercase font-mono tracking-widest text-amber-800 block">
                  FOYER SÉLECTIONNÉ
                </span>
                <h2 className="font-serif text-2xl font-bold text-stone-900 mt-1">
                  {activePlace.name}
                </h2>
                <p className="text-xs text-stone-600 mt-1">
                  Total de {activePlace.count} événements d'état civil et paroissiaux enregistrés dans cette localité.
                </p>
              </div>

              {/* Geographic Schematic representation */}
              <div className="p-6 bg-[#F7F4EE] border border-stone-200/80 rounded-xl text-center space-y-2">
                <Building className="w-8 h-8 text-amber-900 mx-auto" />
                <span className="font-serif text-sm font-bold text-stone-900 block">
                  Registre Paroissial & Mairie de {activePlace.name.split(',')[0]}
                </span>
                <span className="text-xs font-mono text-stone-500 block">
                  Consulter les archives départementales associées pour retrouver les minutes et cotes correspondantes.
                </span>
              </div>

              {/* Events list */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider font-mono text-stone-500">
                  Actes rattachés à cette commune ({activePlace.events.length})
                </h3>

                <div className="space-y-2">
                  {activePlace.events.map((ev, idx) => (
                    <div
                      key={idx}
                      onClick={() => ev.personId && onSelectPerson(ev.personId)}
                      className="p-3 rounded-xl border border-stone-200 hover:border-amber-700 hover:bg-stone-50/70 cursor-pointer transition-colors flex items-center justify-between text-left"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[9px] uppercase font-mono px-1.5 py-0.2 rounded font-bold ${
                              ev.type === 'birth'
                                ? 'bg-emerald-100 text-emerald-900'
                                : ev.type === 'marriage'
                                  ? 'bg-amber-100 text-amber-900'
                                  : 'bg-rose-100 text-rose-900'
                            }`}
                          >
                            {ev.type === 'birth' ? 'Naissance' : ev.type === 'marriage' ? 'Mariage' : 'Décès'}
                          </span>
                          <span className="font-serif text-xs font-bold text-stone-900">{ev.personName}</span>
                        </div>
                        {ev.rawDate && (
                          <span className="text-xs font-mono text-stone-500 block mt-0.5">{ev.rawDate}</span>
                        )}
                      </div>

                      <span className="text-xs text-amber-800 font-medium">Fiche →</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          ) : (
            <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-stone-200 text-xs text-stone-500">
              Sélectionnez une commune à gauche pour afficher les événements correspondants.
            </div>
          )}
        </div>

      </div>

    </div>
  );
};
