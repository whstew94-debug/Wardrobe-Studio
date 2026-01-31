/**
 * Storage Module - Handles all data persistence
 * Uses IndexedDB for images and large data, localStorage for settings
 */

const Storage = {
    DB_NAME: 'WardrobeStudioDB',
    DB_VERSION: 1,
    db: null,

    // Initialize IndexedDB
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

            request.onerror = () => {
                console.error('Failed to open IndexedDB:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('IndexedDB initialized successfully');
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                console.log('Creating IndexedDB stores...');

                // Store for wardrobe items (metadata only, images stored separately)
                if (!db.objectStoreNames.contains('items')) {
                    const itemStore = db.createObjectStore('items', { keyPath: 'id', autoIncrement: true });
                    itemStore.createIndex('category', 'category', { unique: false });
                }

                // Store for base64 images
                if (!db.objectStoreNames.contains('images')) {
                    db.createObjectStore('images', { keyPath: 'id' });
                }

                // Store for weekly outfit plans
                if (!db.objectStoreNames.contains('weeklyPlan')) {
                    db.createObjectStore('weeklyPlan', { keyPath: 'day' });
                }

                // Store for saved outfit combinations
                if (!db.objectStoreNames.contains('savedOutfits')) {
                    db.createObjectStore('savedOutfits', { keyPath: 'id', autoIncrement: true });
                }

                // Store for custom sections
                if (!db.objectStoreNames.contains('customSections')) {
                    db.createObjectStore('customSections', { keyPath: 'id', autoIncrement: true });
                }

                // Store for shopping list
                if (!db.objectStoreNames.contains('shoppingList')) {
                    db.createObjectStore('shoppingList', { keyPath: 'id', autoIncrement: true });
                }

                // Store for trash
                if (!db.objectStoreNames.contains('trash')) {
                    db.createObjectStore('trash', { keyPath: 'id' });
                }
            };
        });
    },

    // Generic transaction helper
    async transaction(storeName, mode, callback) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, mode);
            const store = tx.objectStore(storeName);
            const result = callback(store);

            tx.oncomplete = () => resolve(result);
            tx.onerror = () => reject(tx.error);
        });
    },

    // ============ ITEMS ============

    async saveItem(item) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('items', 'readwrite');
            const store = tx.objectStore('items');
            const request = store.put(item);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async getItem(id) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('items', 'readonly');
            const store = tx.objectStore('items');
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async getAllItems() {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('items', 'readonly');
            const store = tx.objectStore('items');
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    },

    async deleteItem(id) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('items', 'readwrite');
            const store = tx.objectStore('items');
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },

    // ============ IMAGES ============

    async saveImage(id, base64Data) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('images', 'readwrite');
            const store = tx.objectStore('images');
            const request = store.put({ id, data: base64Data });
            request.onsuccess = () => resolve(id);
            request.onerror = () => reject(request.error);
        });
    },

    async getImage(id) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('images', 'readonly');
            const store = tx.objectStore('images');
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result?.data || null);
            request.onerror = () => reject(request.error);
        });
    },

    async deleteImage(id) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('images', 'readwrite');
            const store = tx.objectStore('images');
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },

    // ============ WEEKLY PLAN ============

    async saveWeeklyDay(dayData) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('weeklyPlan', 'readwrite');
            const store = tx.objectStore('weeklyPlan');
            const request = store.put(dayData);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },

    async getWeeklyPlan() {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('weeklyPlan', 'readonly');
            const store = tx.objectStore('weeklyPlan');
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    },

    // ============ SAVED OUTFITS ============

    async saveOutfit(outfit) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('savedOutfits', 'readwrite');
            const store = tx.objectStore('savedOutfits');
            const request = store.put(outfit);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async getAllSavedOutfits() {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('savedOutfits', 'readonly');
            const store = tx.objectStore('savedOutfits');
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    },

    async deleteSavedOutfit(id) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('savedOutfits', 'readwrite');
            const store = tx.objectStore('savedOutfits');
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },

    // ============ CUSTOM SECTIONS ============

    async saveCustomSection(section) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('customSections', 'readwrite');
            const store = tx.objectStore('customSections');
            const request = store.put(section);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async getAllCustomSections() {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('customSections', 'readonly');
            const store = tx.objectStore('customSections');
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    },

    async deleteCustomSection(id) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('customSections', 'readwrite');
            const store = tx.objectStore('customSections');
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },

    // ============ SHOPPING LIST ============

    async saveShoppingItem(item) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('shoppingList', 'readwrite');
            const store = tx.objectStore('shoppingList');
            const request = store.put(item);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async getAllShoppingItems() {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('shoppingList', 'readonly');
            const store = tx.objectStore('shoppingList');
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    },

    async deleteShoppingItem(id) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('shoppingList', 'readwrite');
            const store = tx.objectStore('shoppingList');
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },

    // ============ TRASH ============

    async saveToTrash(item) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('trash', 'readwrite');
            const store = tx.objectStore('trash');
            const request = store.put(item);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },

    async getAllTrash() {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('trash', 'readonly');
            const store = tx.objectStore('trash');
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    },

    async restoreFromTrash(id) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('trash', 'readwrite');
            const store = tx.objectStore('trash');
            const getRequest = store.get(id);
            getRequest.onsuccess = () => {
                const item = getRequest.result;
                store.delete(id);
                resolve(item);
            };
            getRequest.onerror = () => reject(getRequest.error);
        });
    },

    async emptyTrash() {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['trash', 'images'], 'readwrite');
            const trashStore = tx.objectStore('trash');
            const imageStore = tx.objectStore('images');

            const getAll = trashStore.getAll();
            getAll.onsuccess = () => {
                const items = getAll.result || [];
                items.forEach(item => {
                    if (item.imageId) {
                        imageStore.delete(item.imageId);
                    }
                });
                trashStore.clear();
            };

            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    },

    // ============ SETTINGS (localStorage) ============

    getSetting(key, defaultValue = null) {
        const value = localStorage.getItem(`wardrobe_${key}`);
        if (value === null) return defaultValue;
        try {
            return JSON.parse(value);
        } catch {
            return value;
        }
    },

    setSetting(key, value) {
        if (typeof value === 'object') {
            localStorage.setItem(`wardrobe_${key}`, JSON.stringify(value));
        } else {
            localStorage.setItem(`wardrobe_${key}`, value);
        }
    },

    // ============ EXPORT/IMPORT ============

    async exportAllData() {
        const data = {
            version: 1,
            exportDate: new Date().toISOString(),
            items: await this.getAllItems(),
            images: [],
            weeklyPlan: await this.getWeeklyPlan(),
            savedOutfits: await this.getAllSavedOutfits(),
            customSections: await this.getAllCustomSections(),
            shoppingList: await this.getAllShoppingItems(),
            settings: {
                userName: this.getSetting('userName'),
                theme: this.getSetting('theme'),
                location: this.getSetting('location'),
                tempUnit: this.getSetting('tempUnit')
            }
        };

        // Get all images
        const items = data.items;
        for (const item of items) {
            if (item.imageId) {
                const imageData = await this.getImage(item.imageId);
                if (imageData) {
                    data.images.push({ id: item.imageId, data: imageData });
                }
            }
        }

        return data;
    },

    async importAllData(data) {
        if (!data || data.version !== 1) {
            throw new Error('Invalid data format');
        }

        // Clear existing data
        await this.clearAllData();

        // Import images first
        for (const img of data.images || []) {
            await this.saveImage(img.id, img.data);
        }

        // Import items
        for (const item of data.items || []) {
            await this.saveItem(item);
        }

        // Import weekly plan
        for (const day of data.weeklyPlan || []) {
            await this.saveWeeklyDay(day);
        }

        // Import saved outfits
        for (const outfit of data.savedOutfits || []) {
            await this.saveOutfit(outfit);
        }

        // Import custom sections
        for (const section of data.customSections || []) {
            await this.saveCustomSection(section);
        }

        // Import shopping list
        for (const item of data.shoppingList || []) {
            await this.saveShoppingItem(item);
        }

        // Import settings
        if (data.settings) {
            if (data.settings.userName) this.setSetting('userName', data.settings.userName);
            if (data.settings.theme) this.setSetting('theme', data.settings.theme);
            if (data.settings.location) this.setSetting('location', data.settings.location);
            if (data.settings.tempUnit) this.setSetting('tempUnit', data.settings.tempUnit);
        }

        return true;
    },

    async clearAllData() {
        const stores = ['items', 'images', 'weeklyPlan', 'savedOutfits', 'customSections', 'shoppingList', 'trash'];
        for (const storeName of stores) {
            await new Promise((resolve, reject) => {
                const tx = this.db.transaction(storeName, 'readwrite');
                const store = tx.objectStore(storeName);
                const request = store.clear();
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        }
    },

    // Check if this is first run (no data migrated yet)
    isFirstRun() {
        return !localStorage.getItem('wardrobe_migrated');
    },

    setMigrated() {
        localStorage.setItem('wardrobe_migrated', 'true');
        localStorage.setItem('wardrobe_migratedDate', new Date().toISOString());
    }
};

// Export for use in other modules
window.Storage = Storage;
