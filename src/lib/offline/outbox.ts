"use client";

import type { OfflineKomut } from "./protocol";

const DB_ADI = "filbert-offline";
const MAGAZA = "outbox";

function dbAc(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_ADI, 2);
    request.onupgradeneeded = (event) => {
      // v1 kayıtları bir kullanıcıya güvenilir biçimde bağlanamıyordu. Bu nedenle
      // eski kuyruk silinir; başka bir hesabın notu asla yeni hesaba gönderilmez.
      if (event.oldVersion < 2 && request.result.objectStoreNames.contains(MAGAZA)) request.result.deleteObjectStore(MAGAZA);
      if (!request.result.objectStoreNames.contains(MAGAZA)) request.result.createObjectStore(MAGAZA, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Offline depo açılamadı"));
  });
}

async function islem<T>(mod: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await dbAc();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MAGAZA, mod); const request = fn(tx.objectStore(MAGAZA));
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error ?? new Error("Offline işlem başarısız"));
    tx.oncomplete = () => db.close(); tx.onerror = () => { db.close(); reject(tx.error ?? new Error("Offline işlem başarısız")); };
  });
}

export async function offlineKomutEkle(sahipKullaniciId: string, tip: OfflineKomut["tip"], payload: OfflineKomut["payload"]): Promise<OfflineKomut> {
  const komut: OfflineKomut = { id: crypto.randomUUID().replaceAll("-", ""), sahipKullaniciId, tip, payload, createdAt: new Date().toISOString() };
  await islem("readwrite", (store) => store.put(komut));
  return komut;
}
export async function offlineKomutlariGetir(sahipKullaniciId: string): Promise<OfflineKomut[]> {
  const tumu = await islem("readonly", (store) => store.getAll());
  return tumu.filter((komut) => komut.sahipKullaniciId === sahipKullaniciId);
}
export async function offlineKomutuSil(id: string): Promise<void> { await islem("readwrite", (store) => store.delete(id)); }
