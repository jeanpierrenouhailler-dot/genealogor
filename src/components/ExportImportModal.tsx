import React, { useRef } from 'react';
import { X, Download, Upload, FileText, Database, RotateCcw, Check } from 'lucide-react';
import { GenealogyData, ArchiveDocument } from '../types/genealogy';
import { serializeGedcom } from '../lib/gedcom-serializer';
import { parseGedcom } from '../lib/gedcom-parser';

interface ExportImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: GenealogyData;
  archives: ArchiveDocument[];
  onLoadGedcom: (newData: GenealogyData) => void;
  onResetSample: () => void;
}

export const ExportImportModal: React.FC<ExportImportModalProps> = ({
  isOpen,
  onClose,
  data,
  archives,
  onLoadGedcom,
  onResetSample,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDownloadGedcom = () => {
    const gedcomContent = serializeGedcom(data);
    const blob = new Blob([gedcomContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `genealogor_export_${new Date().toISOString().split('T')[0]}.ged`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadArchivesJson = () => {
    const payload = JSON.stringify({ archives, exportDate: new Date().toISOString() }, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `genealogor_fonds_archives_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        try {
          const parsed = parseGedcom(content);
          if (Object.keys(parsed.individuals).length > 0) {
            onLoadGedcom(parsed);
            onClose();
          } else {
            alert('Le fichier GEDCOM ne contient aucun individu reconnu.');
          }
        } catch (err) {
          alert('Erreur lors de la lecture du fichier GEDCOM.');
          console.error(err);
        }
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-[#FBF9F5] border border-stone-300 shadow-2xl rounded-2xl w-full max-w-lg p-6 space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-200/80 pb-3">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-amber-900" />
            <h2 className="font-serif text-lg font-bold text-stone-900">
              Import & Export de Données
            </h2>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Options */}
        <div className="space-y-4">
          
          {/* Importer GEDCOM */}
          <div className="p-4 bg-white border border-stone-200 rounded-xl space-y-2">
            <div className="flex items-center gap-2">
              <Upload className="w-4 h-4 text-amber-800" />
              <h3 className="text-xs font-bold text-stone-900">Importer un fichier GEDCOM (.ged)</h3>
            </div>
            <p className="text-xs text-stone-600">
              Chargez un fichier généalogique existant issu de Geneanet, Filae, Hérédis ou Ancestry.
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="mt-1 w-full py-2 px-3 text-xs font-semibold text-stone-800 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors"
            >
              Sélectionner un fichier .ged
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".ged,.gedcom"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          {/* Exporter GEDCOM */}
          <div className="p-4 bg-white border border-stone-200 rounded-xl space-y-2">
            <div className="flex items-center gap-2">
              <Download className="w-4 h-4 text-amber-800" />
              <h3 className="text-xs font-bold text-stone-900">Exporter en format standard GEDCOM</h3>
            </div>
            <p className="text-xs text-stone-600">
              Téléchargez votre arbre complet conforme à la norme internationale GEDCOM 5.5.1.
            </p>
            <button
              onClick={handleDownloadGedcom}
              className="mt-1 w-full py-2 px-3 text-xs font-semibold text-white bg-amber-900 hover:bg-amber-950 rounded-lg shadow-sm transition-all"
            >
              Télécharger l'arbre (.ged)
            </button>
          </div>

          {/* Sauvegarder les archives */}
          <div className="p-4 bg-white border border-stone-200 rounded-xl space-y-2">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-800" />
              <h3 className="text-xs font-bold text-stone-900">Sauvegarder le fonds d'archives numérisées</h3>
            </div>
            <p className="text-xs text-stone-600">
              Exporte les {archives.length} transcriptions, cotes et métadonnées en fichier JSON.
            </p>
            <button
              onClick={handleDownloadArchivesJson}
              className="mt-1 w-full py-2 px-3 text-xs font-semibold text-stone-800 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors"
            >
              Télécharger le registre d'archives (.json)
            </button>
          </div>

          {/* Réinitialiser */}
          <div className="pt-2 flex items-center justify-between text-xs text-stone-500">
            <button
              onClick={() => {
                if (confirm('Réinitialiser l\'arbre avec les données de démonstration de la famille Martin ?')) {
                  onResetSample();
                  onClose();
                }
              }}
              className="text-stone-500 hover:text-amber-900 flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restaurer l'arbre d'exemple</span>
            </button>
            <button onClick={onClose} className="font-medium text-stone-700 hover:underline">
              Fermer
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
