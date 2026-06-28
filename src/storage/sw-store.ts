const DB_NAME = 'vera-sw-db';
const STORE_NAME = 'notifications';
const LAST_NOTIFIED_KEY = 'lastNotifiedDay';

export async function getLastNotifiedDay(): Promise<string | null> {
  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const getRequest = store.get(LAST_NOTIFIED_KEY);
      getRequest.onsuccess = () => resolve(getRequest.result || null);
      getRequest.onerror = () => resolve(null);
    };
    request.onerror = () => resolve(null);
  });
}

export async function setLastNotifiedDay(day: string): Promise<void> {
  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(day, LAST_NOTIFIED_KEY);
      tx.oncomplete = () => resolve();
    };
    request.onerror = () => resolve();
  });
}
