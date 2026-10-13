import React, { useState } from 'react';
import { X, Save, User, Calendar, MapPin, Briefcase } from 'lucide-react';
import { Individual, Sex } from '../../types/genealogy';
import { parseGedcomDate } from '../../lib/gedcom-parser';

interface EditPersonModalProps {
  person: Individual | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updated: Individual) => void;
}

export const EditPersonModal: React.FC<EditPersonModalProps> = ({
  person,
  isOpen,
  onClose,
  onSave,
}) => {
  if (!isOpen || !person) return null;

  const [givenName, setGivenName] = useState(person.givenName || '');
  const [surname, setSurname] = useState(person.surname || '');
  const [sex, setSex] = useState<Sex>(person.sex || 'X');
  const [birthDate, setBirthDate] = useState(person.birth?.date || '');
  const [birthPlace, setBirthPlace] = useState(person.birth?.place || '');
  const [deathDate, setDeathDate] = useState(person.death?.date || '');
  const [deathPlace, setDeathPlace] = useState(person.death?.place || '');
  const [occupations, setOccupations] = useState(person.occupations?.join(', ') || '');
  const [notes, setNotes] = useState(person.notes?.join('\n') || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: Individual = {
      ...person,
      givenName: givenName.trim(),
      surname: surname.trim(),
      name: `${givenName.trim()} ${surname.trim()}`.trim() || 'Inconnu',
      sex,
      birth: birthDate || birthPlace ? {
        date: birthDate.trim() || undefined,
        place: birthPlace.trim() || undefined,
        parsedDate: parseGedcomDate(birthDate.trim()),
      } : undefined,
      death: deathDate || deathPlace ? {
        date: deathDate.trim() || undefined,
        place: deathPlace.trim() || undefined,
        parsedDate: parseGedcomDate(deathDate.trim()),
      } : undefined,
      occupations: occupations.trim() ? occupations.split(',').map(s => s.trim()).filter(Boolean) : [],
      notes: notes.trim() ? notes.split('\n').map(s => s.trim()).filter(Boolean) : [],
    };

    onSave(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white border border-stone-300 shadow-2xl rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200/80 bg-stone-50">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-amber-800" />
            <h2 className="font-serif text-lg font-bold text-stone-900">
              Modifier la Fiche Généalogique
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Prénom, Nom, Sexe */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Prénom(s)</label>
              <input
                type="text"
                required
                value={givenName}
                onChange={e => setGivenName(e.target.value)}
                className="w-full text-xs bg-stone-50 border border-stone-200 rounded-lg p-2 text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-800"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Nom (Patronyme)</label>
              <input
                type="text"
                required
                value={surname}
                onChange={e => setSurname(e.target.value)}
                className="w-full text-xs bg-stone-50 border border-stone-200 rounded-lg p-2 text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-800"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Sexe</label>
              <select
                value={sex}
                onChange={e => setSex(e.target.value as Sex)}
                className="w-full text-xs bg-stone-50 border border-stone-200 rounded-lg p-2 text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-800"
              >
                <option value="M">Masculin</option>
                <option value="F">Féminin</option>
                <option value="X">Indéterminé</option>
              </select>
            </div>
          </div>

          {/* Naissance */}
          <div className="p-3 bg-stone-50/70 border border-stone-200 rounded-xl space-y-2">
            <span className="text-xs font-semibold text-stone-800 block">Naissance</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-stone-500 mb-0.5">Date (ex: 14 MAY 1742)</label>
                <input
                  type="text"
                  value={birthDate}
                  onChange={e => setBirthDate(e.target.value)}
                  className="w-full text-xs bg-white border border-stone-200 rounded-lg p-2 text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-800"
                />
              </div>
              <div>
                <label className="block text-[11px] text-stone-500 mb-0.5">Lieu / Paroisse</label>
                <input
                  type="text"
                  value={birthPlace}
                  onChange={e => setBirthPlace(e.target.value)}
                  className="w-full text-xs bg-white border border-stone-200 rounded-lg p-2 text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-800"
                />
              </div>
            </div>
          </div>

          {/* Décès */}
          <div className="p-3 bg-stone-50/70 border border-stone-200 rounded-xl space-y-2">
            <span className="text-xs font-semibold text-stone-800 block">Décès</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-stone-500 mb-0.5">Date (laisser vide si vivant)</label>
                <input
                  type="text"
                  value={deathDate}
                  onChange={e => setDeathDate(e.target.value)}
                  className="w-full text-xs bg-white border border-stone-200 rounded-lg p-2 text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-800"
                />
              </div>
              <div>
                <label className="block text-[11px] text-stone-500 mb-0.5">Lieu</label>
                <input
                  type="text"
                  value={deathPlace}
                  onChange={e => setDeathPlace(e.target.value)}
                  className="w-full text-xs bg-white border border-stone-200 rounded-lg p-2 text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-800"
                />
              </div>
            </div>
          </div>

          {/* Métier */}
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">
              Profession(s) (séparées par une virgule)
            </label>
            <input
              type="text"
              value={occupations}
              onChange={e => setOccupations(e.target.value)}
              placeholder="Ex: Maître charpentier de marine, Négociant"
              className="w-full text-xs bg-stone-50 border border-stone-200 rounded-lg p-2 text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-800"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">Notes biographiques</label>
            <textarea
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Éléments d'histoire, signatures, citations..."
              className="w-full text-xs bg-stone-50 border border-stone-200 rounded-lg p-2 text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-800"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-100 rounded-lg"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-amber-900 hover:bg-amber-950 rounded-lg shadow-sm"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Enregistrer</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
