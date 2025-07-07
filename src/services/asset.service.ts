import { db } from '@/lib/firebase';
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
  orderBy,
} from 'firebase/firestore';

const fromFirestore = (docSnap: any): Asset => {
  const data = docSnap.data();
  const asset: Asset = {
    id: docSnap.id,
    name: data.name,
    type: data.type,
    initialValue: data.initialValue,
    currentValue: data.currentValue,
    ticker: data.ticker,
    quantity: data.quantity,
    purchasePrice: data.purchasePrice,
    purchaseDate: data.purchaseDate instanceof Timestamp ? data.purchaseDate.toDate().toISOString() : undefined,
  };
  return asset;
};

export const getAssets = async (): Promise<Asset[]> => {
  const assetsCollection = collection(db, 'assets');
  const q = query(assetsCollection, orderBy("purchaseDate", "desc"));
  const assetSnapshot = await getDocs(q);
  const assetList = assetSnapshot.docs.map(fromFirestore);
  return assetList;
};

export type AddableAsset = Omit<Asset, 'id'>;

export const addAsset = async (assetData: AddableAsset): Promise<Asset> => {
    const assetCollection = collection(db, 'assets');
    const docRef = await addDoc(assetCollection, {
        ...assetData,
        purchaseDate: assetData.purchaseDate ? new Date(assetData.purchaseDate) : new Date(),
    });
    return { id: docRef.id, ...assetData };
};

export const updateAsset = async (id: string, updatedData: Partial<AddableAsset>): Promise<void> => {
  const assetDoc = doc(db, 'assets', id);
  
  const dataToUpdate: { [key: string]: any } = { ...updatedData };
  if (updatedData.purchaseDate) {
    dataToUpdate.purchaseDate = new Date(updatedData.purchaseDate);
  }

  await updateDoc(assetDoc, dataToUpdate);
};

export const deleteAsset = async (id: string): Promise<void> => {
  const assetDoc = doc(db, 'assets', id);
  await deleteDoc(assetDoc);
};
