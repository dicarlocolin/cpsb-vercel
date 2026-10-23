// Store recordings separately from the small localStorage configuration.
export function createSoundStore(factory = globalThis.indexedDB) {
  async function open() {
    if (!factory) throw Error('Sound storage is unavailable in this browser.');
    return new Promise((resolve, reject) => {
      const request = factory.open('cypat-sounds', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('recordings');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(Error('Sound storage is blocked. Close other scoreboard tabs and try again.'));
    });
  }
  async function run(mode, operation) {
    const db = await open();
    try {
      return await new Promise((resolve, reject) => {
        const transaction = db.transaction('recordings', mode);
        const request = operation(transaction.objectStore('recordings'));
        transaction.oncomplete = () => resolve(request.result);
        transaction.onabort = () => reject(transaction.error || Error('Sound could not be saved.'));
        transaction.onerror = () => {}; // Report the final transaction abort instead.
      });
    } finally { db.close(); }
  }
  return {
    get(id) { return run('readonly', store => store.get(id)); },
    async save(sound) {
      const id = globalThis.crypto.randomUUID();
      await run('readwrite', store => store.put({name: sound.name, bytes: sound.bytes}, id));
      return id;
    },
    remove(id) { return run('readwrite', store => store.delete(id)); }
  };
}
