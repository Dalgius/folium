
import { db, auth } from '@/lib/firebase';
import { Asset } from '@/types';
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  Timestamp,
  query,
  where,
  orderBy,
  DocumentSnapshot,
  QueryDocumentSnapshot,
} from 'firebase/firestore';

const fromFirestore = (docSnap: DocumentSnapshot | QueryDocumentSnapshot): Asset => {
  const data = docSnap.data();
  if (!data) {
    throw new Error(`Documento con id ${docSnap.id} non contiene dati.`);
  }
  const asset: Asset = {
    id: docSnap.id,
    name: data.name,
    type: data.type,
    currency: data.currency || 'EUR',
    initialValue: data.initialValue,
    currentValue: data.currentValue,
    ticker: data.ticker,
    quantity: data.quantity,
    purchasePrice: data.purchasePrice,
    purchaseDate: data.purchaseDate instanceof Timestamp ? data.purchaseDate.toDate().toISOString() : undefined,
    dailyChange: data.dailyChange,
    dailyChangePercent: data.dailyChangePercent,
  };
  return asset;
};

export const getAssets = async (): Promise<Asset[]> => {
  const user = auth.currentUser;
  if (!user) {
    console.log("Nessun utente loggato per getAssets, ritorno array vuoto.");
    return [];
  }
  const assetsCollection = collection(db, 'assets');
  const q = query(assetsCollection, where("userId", "==", user.uid), orderBy("purchaseDate", "desc"));
  const assetSnapshot = await getDocs(q);
  const assetList = assetSnapshot.docs.map(fromFirestore);
  return assetList;
};

export type AddableAsset = Omit<Asset, 'id'>;

export const addAsset = async (assetData: AddableAsset): Promise<Asset> => {
    const user = auth.currentUser;
    if (!user) {
        throw new Error("Devi essere loggato per aggiungere un asset.");
    }
    
    const dataToAdd: { [key: string]: any } = { 
        ...assetData,
        userId: user.uid
    };

    dataToAdd.purchaseDate = assetData.purchaseDate ? new Date(assetData.purchaseDate) : new Date();
    Object.keys(dataToAdd).forEach(key => dataToAdd[key] === undefined && delete dataToAdd[key]);

    const assetCollection = collection(db, 'assets');
    const docRef = await addDoc(assetCollection, dataToAdd);
    
    return { id: docRef.id, ...assetData };
};

export const updateAsset = async (id: string, updatedData: Partial<AddableAsset>): Promise<void> => {
  const assetDoc = doc(db, 'assets', id);
  
  const dataToUpdate: { [key: string]: any } = { ...updatedData };
  if (updatedData.purchaseDate) {
    dataToUpdate.purchaseDate = new Date(updatedData.purchaseDate);
  }
  delete dataToUpdate.userId;

  await updateDoc(assetDoc, dataToUpdate);
};

export const deleteAsset = async (id: string): Promise<void> => {
  const assetDoc = doc(db, 'assets', id);
  await deleteDoc(assetDoc);
};
