const DB_NAME = "vera-images";
const DB_VERSION = 1;
const STORE = "images";

let dbPromise: Promise<IDBDatabase> | null = null;

const openImageDb = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
};

const txComplete = (tx: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

export const putImage = async (id: string, dataUrl: string): Promise<void> => {
  const db = await openImageDb();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).put(dataUrl, id);
  await txComplete(tx);
};

export const deleteImage = async (id: string): Promise<void> => {
  const db = await openImageDb();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).delete(id);
  await txComplete(tx);
};

export const getAllImages = async (): Promise<Map<string, string>> => {
  const db = await openImageDb();
  const tx = db.transaction(STORE, "readonly");
  const store = tx.objectStore(STORE);

  const result = new Map<string, string>();
  return new Promise((resolve, reject) => {
    const cursorRequest = store.openCursor();
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (cursor) {
        if (typeof cursor.key === "string" && typeof cursor.value === "string") {
          result.set(cursor.key, cursor.value);
        }
        cursor.continue();
      } else {
        resolve(result);
      }
    };
    cursorRequest.onerror = () => reject(cursorRequest.error);
  });
};
