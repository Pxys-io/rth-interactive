const ECDB = (() => {
    const DB_NAME = 'econtour_offline';
    const DB_VERSION = 2;
    let db = null;

    function open() {
        return new Promise((resolve, reject) => {
            if (db) return resolve(db);
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = e => {
                const d = e.target.result;
                if (!d.objectStoreNames.contains('cases')) {
                    d.createObjectStore('cases', { keyPath: 'id' });
                }
                if (!d.objectStoreNames.contains('images')) {
                    d.createObjectStore('images', { keyPath: ['caseId', 'path'] });
                }
                if (!d.objectStoreNames.contains('meta')) {
                    d.createObjectStore('meta', { keyPath: 'key' });
                }
            };
            req.onsuccess = e => { db = e.target.result; resolve(db); };
            req.onerror = e => reject(e.target.error);
        });
    }

    function tx(storeName, mode) {
        return db.transaction(storeName, mode).objectStore(storeName);
    }

    function promisify(req) {
        return new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
    }

    async function saveCaseMeta(caseObj) {
        await open();
        return promisify(tx('cases', 'readwrite').put(caseObj));
    }

    async function getCaseMeta(caseId) {
        await open();
        return promisify(tx('cases', 'readonly').get(caseId));
    }

    async function getAllCases() {
        await open();
        return promisify(tx('cases', 'readonly').getAll());
    }

    async function deleteCase(caseId) {
        await open();
        const caseTx = db.transaction(['cases', 'images'], 'readwrite');
        caseTx.objectStore('cases').delete(caseId);
        const imgStore = caseTx.objectStore('images');
        const allImgs = await promisify(imgStore.getAll());
        allImgs.filter(i => i.caseId === caseId).forEach(i => imgStore.delete([caseId, i.path]));
        return new Promise((res, rej) => { caseTx.oncomplete = res; caseTx.onerror = rej; });
    }

    async function saveImage(caseId, path, blob) {
        await open();
        return promisify(tx('images', 'readwrite').put({ caseId, path, blob, size: blob.size }));
    }

    async function getImage(caseId, path) {
        await open();
        const rec = await promisify(tx('images', 'readonly').get([caseId, path]));
        return rec ? rec.blob : null;
    }

    async function getCaseImageCount(caseId) {
        await open();
        const all = await promisify(tx('images', 'readonly').getAll());
        return all.filter(i => i.caseId === caseId).length;
    }

    async function getCaseSize(caseId) {
        await open();
        const all = await promisify(tx('images', 'readonly').getAll());
        return all.filter(i => i.caseId === caseId).reduce((s, i) => s + (i.size || 0), 0);
    }

    async function setMeta(key, value) {
        await open();
        return promisify(tx('meta', 'readwrite').put({ key, value }));
    }

    async function getMeta(key) {
        await open();
        const rec = await promisify(tx('meta', 'readonly').get(key));
        return rec ? rec.value : null;
    }

    async function resetDB() {
        if (db) db.close();
        db = null;
        return new Promise((res, rej) => {
            const req = indexedDB.deleteDatabase(DB_NAME);
            req.onsuccess = res;
            req.onerror = rej;
        });
    }

    async function getStorageUsage() {
        if (navigator.storage && navigator.storage.estimate) {
            const est = await navigator.storage.estimate();
            return { used: est.usage || 0, quota: est.quota || 0 };
        }
        return { used: 0, quota: 0 };
    }

    function formatBytes(bytes) {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
    }

    return {
        open, saveCaseMeta, getCaseMeta, getAllCases, deleteCase,
        saveImage, getImage, getCaseImageCount, getCaseSize,
        setMeta, getMeta, resetDB, getStorageUsage, formatBytes
    };
})();
