export type Sex = 'M' | 'F' | 'X';

export interface ParsedDate {
  raw: string;
  year?: number;
  month?: number;
  day?: number;
  isApproximate?: boolean;
  isBefore?: boolean;
  isAfter?: boolean;
  isBetween?: boolean;
  year2?: number;
}

export interface LifeEvent {
  date?: string;
  place?: string;
  notes?: string[];
  parsedDate?: ParsedDate;
  latitude?: number;
  longitude?: number;
}

export interface Individual {
  id: string;
  name: string;
  givenName?: string;
  surname?: string;
  sex: Sex;
  birth?: LifeEvent;
  death?: LifeEvent;
  baptism?: LifeEvent;
  burial?: LifeEvent;
  occupations?: string[];
  residences?: LifeEvent[];
  notes?: string[];
  familiesAsSpouse: string[];
  familiesAsChild: string[];
  sosaNumber?: number;
  dAbovilleNumber?: string;
  generation?: number;
}

export interface Family {
  id: string;
  husbandId?: string;
  wifeId?: string;
  childrenIds: string[];
  marriage?: LifeEvent;
  divorce?: LifeEvent;
  notes?: string[];
}

export interface GenealogyData {
  individuals: Record<string, Individual>;
  families: Record<string, Family>;
  rootPersonId?: string;
  sourceHeader?: string;
}

export type ArchiveDocumentType = 
  | 'birth'
  | 'baptism'
  | 'marriage'
  | 'death'
  | 'burial'
  | 'census'
  | 'notarial'
  | 'military'
  | 'livret'
  | 'other';

export interface ArchiveDocument {
  id: string;
  title: string;
  type: ArchiveDocumentType;
  archiveLocation?: string; // Dépôt d'archives (ex: AD Finistère, Mairie)
  callNumber?: string;      // Cote d'archives (ex: 3 E 142/12, vue 45/210)
  date?: string;            // Date de l'acte
  republicanDate?: string;  // Équivalent calendrier républicain
  place?: string;           // Commune, Paroisse
  transcription?: string;   // Texte fidèlement retranscrit
  notes?: string;           // Remarques ou mentions marginales
  fileData?: string;        // Base64 ou URL locale
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  linkedPersonIds: string[]; // Personnes associées (sujet, époux, parents, témoins)
  linkedFamilyIds: string[];
  linkedEventId?: string;
  createdAt: number;
  updatedAt: number;
}

export type BranchRole = 'viewer' | 'editor' | 'admin';
export type BranchScope = 'all' | 'paternal' | 'maternal' | 'custom';

export interface BranchAccess {
  id: string;
  name: string;
  branch: BranchScope;
  rootPersonId: string;
  role: BranchRole;
  password?: string;
  passwordHash?: string;
  hideLiving: boolean;
  shareToken: string;
  createdAt: number;
}

export interface PeerPresence {
  clientId: string;
  userName: string;
  branch?: string;
  role?: BranchRole;
  activeView?: string;
  activePersonId?: string;
  lastSeen: number;
}

export interface SyncMessage {
  type: string;
  clientId?: string;
  action?: 'tree:update' | 'person:edit' | 'archive:add' | 'archive:delete' | 'access:update';
  payload?: any;
  timestamp?: number;
}
