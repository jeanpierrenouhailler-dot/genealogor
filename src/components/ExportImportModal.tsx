import React, { useRef, useState } from 'react';
import { X, Download, Upload, FileText, Database, RotateCcw, Check, ShieldCheck, AlertCircle, Eye, Undo2 } from 'lucide-react';
import { GenealogyData, ArchiveDocument, BranchAccess } from '../types/genealogy';
import { serializeGedcomWithReport } from '../lib/gedcom-serializer';
import { parseGedcom } from '../lib/gedcom-parser';
import { createFullBackup, previewBackup, restoreBackup, restorePreBackupSafety, BackupPreview } from '../lib/backup-restore';

interface ExportImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: GenealogyData;
  archives: ArchiveDocument[];
  accessList: BranchAccess[];
  onLoadGedcom: (newData: GenealogyData) => void;
  onRestoreBackup: (payload: { genealogy: GenealogyData; archives: ArchiveDocument[]; accessList: BranchAccess[] }) => void;
  onResetSample: () => void;
}

export const ExportImportModal: React.FC<ExportImportModalProps> = ({
  isOpen,
  onClose,
  data,
  archives,
  accessList,
  onLoadGedcom,
  onRestoreBackup,
  onResetSample,
}) => {
  const fileInputGedRef = useRef<HTMLInputElement>(null);
  const fileInputBackupRef = useRef<HTMLInputElement>(null);

  const [hideLivingOnExport, setHideLivingOnExport] = useState(false);
  const [backupPreview, setBackupPreview] = useState<BackupPreview | null>(null);
  const [pendingBackupContent, setPendingBackupContent] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDownloadGedcom = () => {
    const { gedcom, report } = serializeGedcomWithReport(data, { hideLiving: hideLivingOnExport });
    const blob = new Blob([gedcom], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `genealogor_export_${new Date().toISOString().split('T')[0]}.ged`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setStatusMessage(`GEDCOM exporté avec succès (${report.totalIndividuals} individus, ${report.maskedLivingCount} vivants masqués).`);
  };

  const handleDownloadFullBackup = async () => {
    const backupJson = await createFullBackup(data, archives, accessList);
    const blob = new Blob([backupJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `genealogor_sauvegarde_complete_${new Date().toISOString().split('T')[0]}.genealogor.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setStatusMessage('Sauvegarde complète avec intégrité SHA-256 téléchargée.');
  };

  const handleBackupFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      if (content) {
        setPendingBackupContent(content);
        const preview = await previewBackup(content);
        setBackupPreview(preview);
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmRestore = async () => {
    if (!pendingBackupContent) return;
    const res = await restoreBackup(pendingBackupContent, data, archives, accessList);
    if (res.success && res.data) {
      onRestoreBackup(res.data);
      setBackupPreview(null);
      setPendingBackupContent(null);
      setStatusMessage('Arbre et archives restaurés avec succès.');
      onClose();
    } else {
      alert(`Erreur de restauration : ${res.error}`);
    }
  };

  const handleUndoRestore = () => {
    const safety = restorePreBackupSafety();
    if (safety) {
      onRestoreBackup(safety);
      setStatusMessage('Restauration annulée : arbre précédent restauré.');
    } else {
      alert('Aucune sauvegarde préalable disponible.');
    }
  };

  const handleGedcomUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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
            setStatusMessage(`GEDCOM importé avec succès (${Object.keys(parsed.individuals).length} individus).`);
            onClose();
          } else {
            alert('Le fichier GEDCOM ne contient aucun individu reconnu.');
          }
        } catch (err) {
          alert('Erreur lors de la lecture du fichier GEDCOM.');
        }
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-[#FBF9F5] border border-stone-300 shadow-2xl rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-200/80 pb-3">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-amber-900" />
            <h2 className="font-serif text-lg font-bold text-stone-900">
              Sauvegarde, Restauration & GEDCOM
            </h2>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {statusMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 font-medium flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Modal content */}
        {backupPreview ? (
          /* Prévisualisation de sauvegarde avant restauration */
          <div className="p-4 bg-white border border-stone-200 rounded-xl space-y-4 shadow-xs">
            <h3 className="font-serif text-sm font-bold text-stone-900 flex items-center gap-2">
              <Eye className="w-4 h-4 text-amber-800" />
              <span>Vérification & Prévisualisation de la Sauvegarde</span>
            </h3>

            {backupPreview.isValid && backupPreview.manifest ? (
              <div className="space-y-3 text-xs">
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 font-mono text-[11px] flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>Empreinte SHA-256 vérifiée et intègre.</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-stone-700">
                  <div className="p-2 bg-stone-50 rounded">
                    <span className="text-stone-400 block text-[10px]">Individus</span>
                    <span className="font-bold font-mono">{backupPreview.manifest.stats.individualsCount}</span>
                  </div>
                  <div className="p-2 bg-stone-50 rounded">
                    <span className="text-stone-400 block text-[10px]">Familles</span>
                    <span className="font-bold font-mono">{backupPreview.manifest.stats.familiesCount}</span>
                  </div>
                  <div className="p-2 bg-stone-50 rounded">
                    <span className="text-stone-400 block text-[10px]">Archives numérisées</span>
                    <span className="font-bold font-mono">{backupPreview.manifest.stats.archivesCount}</span>
                  </div>
                  <div className="p-2 bg-stone-50 rounded">
                    <span className="text-stone-400 block text-[10px]">Règles de branches</span>
                    <span className="font-bold font-mono">{backupPreview.manifest.stats.accessRulesCount}</span>
                  </div>
                </div>

                <p className="text-[11px] text-stone-500 italic">
                  Une copie de secours de votre arbre actuel sera automatiquement enregistrée pour vous permettre d'annuler si besoin.
                </p>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
                  <button
                    onClick={() => { setBackupPreview(null); setPendingBackupContent(null); }}
                    className="px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-100 rounded-lg"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleConfirmRestore}
                    className="px-4 py-1.5 text-xs font-bold text-white bg-amber-900 hover:bg-amber-950 rounded-lg shadow-sm"
                  >
                    Confirmer la restauration
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 space-y-2">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                  <span>Sauvegarde non valide</span>
                </div>
                <p>{backupPreview.error}</p>
                <button
                  onClick={() => { setBackupPreview(null); setPendingBackupContent(null); }}
                  className="px-3 py-1 text-xs bg-white text-rose-900 border border-rose-300 rounded"
                >
                  Fermer
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            
            {/* Section 1 : Sauvegarde Complète Vérifiable */}
            <div className="p-4 bg-white border border-stone-200 rounded-xl space-y-2.5 shadow-2xs">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-800" />
                <h3 className="text-xs font-bold text-stone-900">Sauvegarde Complète Sécurisée (.genealogor.json)</h3>
              </div>
              <p className="text-xs text-stone-600">
                Génère un paquet certifié intégrant l'arbre, les relations, les sources, les transcriptions d'archives et une empreinte de contrôle SHA-256.
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={handleDownloadFullBackup}
                  className="py-2 px-3 text-xs font-semibold text-white bg-amber-900 hover:bg-amber-950 rounded-lg shadow-sm transition-all"
                >
                  Télécharger la sauvegarde
                </button>
                <button
                  onClick={() => fileInputBackupRef.current?.click()}
                  className="py-2 px-3 text-xs font-semibold text-stone-800 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors border border-stone-200"
                >
                  Restaurer une sauvegarde
                </button>
                <input
                  ref={fileInputBackupRef}
                  type="file"
                  accept=".json,.genealogor.json"
                  onChange={handleBackupFileSelect}
                  className="hidden"
                />
              </div>
            </div>

            {/* Section 2 : GEDCOM Standard 5.5.1 */}
            <div className="p-4 bg-white border border-stone-200 rounded-xl space-y-2.5 shadow-2xs">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-800" />
                <h3 className="text-xs font-bold text-stone-900">Format Standard International GEDCOM (.ged)</h3>
              </div>
              
              <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-stone-600 bg-stone-50 p-2 rounded-lg border border-stone-200/60">
                <input
                  type="checkbox"
                  checked={hideLivingOnExport}
                  onChange={e => setHideLivingOnExport(e.target.checked)}
                  className="rounded text-amber-800 focus:ring-amber-700 h-3.5 w-3.5"
                />
                <span>Masquer les personnes vivantes dans le fichier exporté (RGPD / Confidentialité)</span>
              </label>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={handleDownloadGedcom}
                  className="py-2 px-3 text-xs font-semibold text-stone-800 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors border border-stone-200"
                >
                  Exporter en GEDCOM
                </button>
                <button
                  onClick={() => fileInputGedRef.current?.click()}
                  className="py-2 px-3 text-xs font-semibold text-stone-800 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors border border-stone-200"
                >
                  Importer un fichier .ged
                </button>
                <input
                  ref={fileInputGedRef}
                  type="file"
                  accept=".ged,.gedcom"
                  onChange={handleGedcomUpload}
                  className="hidden"
                />
              </div>
            </div>

            {/* Section 3 : Outils de Récupération & Démonstration */}
            <div className="pt-2 flex items-center justify-between text-xs text-stone-500">
              <button
                onClick={handleUndoRestore}
                className="text-stone-600 hover:text-amber-900 flex items-center gap-1.5"
              >
                <Undo2 className="w-3.5 h-3.5" />
                <span>Annuler dernière restauration</span>
              </button>

              <button
                onClick={() => {
                  if (confirm('Restaurer l\'arbre exemple de la famille Martin ?')) {
                    onResetSample();
                    onClose();
                  }
                }}
                className="text-stone-500 hover:text-amber-900 flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restaurer l'arbre d'exemple</span>
              </button>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};
