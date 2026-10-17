import { 
  doc, 
  setDoc, 
  collection, 
  onSnapshot, 
  deleteDoc 
} from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from './firebase';
import { GenealogyData, ArchiveDocument, BranchAccess } from '../types/genealogy';
import { User } from 'firebase/auth';

export async function saveTreeToFirestore(
  treeId: string, 
  data: GenealogyData, 
  currentUser: User | null
): Promise<void> {
  if (!currentUser) return;
  const path = `trees/${treeId}`;
  try {
    const treeRef = doc(db, 'trees', treeId);
    await setDoc(treeRef, {
      treeId,
      ownerId: currentUser.uid,
      ownerEmail: currentUser.email || '',
      title: data.sourceHeader || 'Arbre Familial',
      rootPersonId: data.rootPersonId || '',
      individuals: data.individuals,
      families: data.families,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeToTree(
  treeId: string, 
  onUpdate: (data: GenealogyData) => void,
  onMissingDoc?: () => void
): () => void {
  const path = `trees/${treeId}`;
  const treeRef = doc(db, 'trees', treeId);

  return onSnapshot(treeRef, (snapshot) => {
    if (snapshot.exists()) {
      const val = snapshot.data();
      if (val && val.individuals && val.families) {
        onUpdate({
          individuals: val.individuals,
          families: val.families,
          rootPersonId: val.rootPersonId,
          sourceHeader: val.title,
        });
      }
    } else if (onMissingDoc) {
      onMissingDoc();
    }
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, path);
  });
}

export async function saveArchiveToFirestore(
  treeId: string, 
  archive: ArchiveDocument, 
  currentUser: User | null
): Promise<void> {
  if (!currentUser) return;
  const path = `trees/${treeId}/archives/${archive.id}`;
  try {
    const archiveRef = doc(db, 'trees', treeId, 'archives', archive.id);
    await setDoc(archiveRef, {
      ...archive,
      createdBy: currentUser.uid,
      updatedAt: Date.now(),
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteArchiveFromFirestore(
  treeId: string, 
  archiveId: string,
  currentUser: User | null
): Promise<void> {
  if (!currentUser) return;
  const path = `trees/${treeId}/archives/${archiveId}`;
  try {
    const archiveRef = doc(db, 'trees', treeId, 'archives', archiveId);
    await deleteDoc(archiveRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function clearTreeFromFirestore(
  treeId: string, 
  currentUser: User | null
): Promise<void> {
  if (!currentUser) return;
  const path = `trees/${treeId}`;
  try {
    const treeRef = doc(db, 'trees', treeId);
    await setDoc(treeRef, {
      treeId,
      ownerId: currentUser.uid,
      ownerEmail: currentUser.email || '',
      title: 'Mon Arbre Généalogique',
      rootPersonId: '',
      individuals: {},
      families: {},
      updatedAt: new Date().toISOString(),
    });

    // Supprimer les actes de démonstration de la sous-collection archives
    const sampleDocIds = ['doc-001', 'doc-002', 'doc-003', 'doc-004'];
    for (const id of sampleDocIds) {
      try {
        await deleteDoc(doc(db, 'trees', treeId, 'archives', id));
      } catch (e) {}
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeToArchives(
  treeId: string, 
  onUpdate: (archives: ArchiveDocument[]) => void
): () => void {
  const path = `trees/${treeId}/archives`;
  const archivesCol = collection(db, 'trees', treeId, 'archives');

  return onSnapshot(archivesCol, (snapshot) => {
    const list: ArchiveDocument[] = [];
    snapshot.forEach(docSnap => {
      list.push(docSnap.data() as ArchiveDocument);
    });
    onUpdate(list);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, path);
  });
}

export async function saveAccessToFirestore(
  treeId: string, 
  access: BranchAccess,
  currentUser: User | null
): Promise<void> {
  if (!currentUser) return;
  const path = `trees/${treeId}/access/${access.id}`;
  try {
    const ref = doc(db, 'trees', treeId, 'access', access.id);
    await setDoc(ref, access, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeToAccessList(
  treeId: string, 
  onUpdate: (list: BranchAccess[]) => void
): () => void {
  const path = `trees/${treeId}/access`;
  const col = collection(db, 'trees', treeId, 'access');

  return onSnapshot(col, (snapshot) => {
    const list: BranchAccess[] = [];
    snapshot.forEach(docSnap => {
      list.push(docSnap.data() as BranchAccess);
    });
    if (list.length > 0) {
      onUpdate(list);
    }
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, path);
  });
}
