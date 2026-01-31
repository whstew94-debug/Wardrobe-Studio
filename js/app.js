/**
 * Main Application Module
 * Handles initialization, state management, and core actions
 */

const App = {
    // Current builder state
    builderItems: [],
    currentWeeklyDay: null,
    currentMoveItemId: null,
    currentEditingDay: null,

    // Initialize the application
    async init() {
        console.log('Initializing Wardrobe Studio...');

        try {
            // Initialize storage first
            await Storage.init();

            // Check if first run - show welcome modal
            if (Storage.isFirstRun()) {
                this.showWelcomeModal();
            } else {
                // Load theme
                this.loadTheme();
            }

            // Update greeting
            UI.updateGreeting();

            // Initialize drag and drop
            DragDrop.init();

            // Setup file uploads
            this.setupUploads();

            // Render all UI
            await this.refreshAll();

            // Load weather (don't wait for it)
            UI.renderWeather().catch(err => console.warn('Weather load failed:', err));

            // Request location permission if not set
            if (!Storage.getSetting('location')) {
                this.requestLocation();
            }

            console.log('Wardrobe Studio initialized successfully!');

        } catch (err) {
            console.error('Initialization error:', err);
            UI.showToast('Failed to initialize app');
        }
    },

    // Refresh all UI components
    async refreshAll() {
        await UI.renderWardrobe();
        await UI.renderWeeklyOutfits();
        await UI.renderBuilderPalette();
        await UI.renderSavedOutfits();
        await UI.renderShoppingList();
    },

    // ============ THEME ============

    loadTheme() {
        const theme = Storage.getSetting('theme', 'light');
        const btn = document.getElementById('theme-btn');

        if (theme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            if (btn) btn.textContent = '☀️';
        } else {
            document.documentElement.removeAttribute('data-theme');
            if (btn) btn.textContent = '🌙';
        }
    },

    toggleTheme() {
        const html = document.documentElement;
        const btn = document.getElementById('theme-btn');
        const isDark = html.hasAttribute('data-theme');

        if (isDark) {
            html.removeAttribute('data-theme');
            if (btn) btn.textContent = '🌙';
            Storage.setSetting('theme', 'light');
        } else {
            html.setAttribute('data-theme', 'dark');
            if (btn) btn.textContent = '☀️';
            Storage.setSetting('theme', 'dark');
        }
    },

    // ============ LOCATION & WEATHER ============

    async requestLocation() {
        try {
            await Weather.getCurrentLocation();
            UI.renderWeather();
            UI.showToast('Location detected!');
        } catch (err) {
            console.warn('Location request failed:', err);
            // Use default location
            Storage.setSetting('location', Weather.DEFAULT_LOCATION);
        }
    },

    async refreshWeather() {
        // Clear cache to force refresh
        Storage.setSetting('weatherCache', null);
        await UI.renderWeather();
        UI.showToast('Weather updated!');
    },

    // ============ WARDROBE ITEMS ============

    async toggleLaundry(itemId) {
        const item = await Storage.getItem(itemId);
        if (!item) return;

        item.laundry = !item.laundry;
        await Storage.saveItem(item);

        UI.showToast(item.laundry ? 'Added to laundry' : 'Removed from laundry');
        await UI.renderWardrobe();
        await UI.renderBuilderPalette();
    },

    async toggleFavorite(itemId) {
        const item = await Storage.getItem(itemId);
        if (!item) return;

        item.favorite = !item.favorite;
        await Storage.saveItem(item);

        UI.showToast(item.favorite ? 'Added to favorites ⭐' : 'Removed from favorites');
        await UI.renderWardrobe();
    },

    async deleteItem(itemId) {
        const item = await Storage.getItem(itemId);
        if (!item) return;

        // Move to trash instead of permanent delete
        item.deleted = true;
        item.deletedDate = new Date().toISOString();
        item.originalCategory = item.category;

        await Storage.saveToTrash(item);
        await Storage.deleteItem(itemId);

        UI.showToast('Moved to trash');
        await UI.renderWardrobe();
    },

    async restoreItem(itemId) {
        const item = await Storage.restoreFromTrash(itemId);
        if (!item) return;

        item.deleted = false;
        item.category = item.originalCategory || 'other';
        delete item.deletedDate;
        delete item.originalCategory;

        await Storage.saveItem(item);

        UI.showToast('Item restored!');
        await UI.renderWardrobe();
    },

    async emptyTrash() {
        if (!confirm('Permanently delete all items in trash? This cannot be undone.')) {
            return;
        }

        await Storage.emptyTrash();
        UI.showToast('Trash emptied');
        await UI.renderWardrobe();
    },

    // ============ MOVE ITEM MODAL ============

    openMoveModal(itemId) {
        this.currentMoveItemId = itemId;
        UI.openModal('move-modal');
    },

    closeMoveModal() {
        this.currentMoveItemId = null;
        UI.closeModal('move-modal');
    },

    async moveItemToCategory() {
        if (!this.currentMoveItemId) return;

        const select = document.getElementById('move-category');
        const targetCategory = select.value;

        const item = await Storage.getItem(this.currentMoveItemId);
        if (!item) return;

        item.category = targetCategory;
        await Storage.saveItem(item);

        this.closeMoveModal();
        UI.showToast('Item moved!');
        await UI.renderWardrobe();
    },

    // ============ WEEKLY PLANNER ============

    openWeeklyModal(day) {
        this.currentWeeklyDay = day;
        UI.renderWeeklyAddModal();
        UI.openModal('weekly-add-modal');
    },

    closeWeeklyModal() {
        this.currentWeeklyDay = null;
        UI.closeModal('weekly-add-modal');
    },

    async addToWeeklyFromModal(itemId) {
        if (!this.currentWeeklyDay) return;

        const weeklyPlan = await Storage.getWeeklyPlan();
        const dayPlan = weeklyPlan.find(d => d.day === this.currentWeeklyDay);

        if (!dayPlan) return;

        if (dayPlan.items.includes(itemId)) {
            UI.showToast('Item already in this outfit');
            return;
        }

        dayPlan.items.push(itemId);
        await Storage.saveWeeklyDay(dayPlan);

        this.closeWeeklyModal();
        UI.showToast(`Added to ${this.currentWeeklyDay}'s outfit`);
        await UI.renderWeeklyOutfits();
    },

    async removeFromWeekly(day, itemId) {
        const weeklyPlan = await Storage.getWeeklyPlan();
        const dayPlan = weeklyPlan.find(d => d.day === day);

        if (!dayPlan) return;

        dayPlan.items = dayPlan.items.filter(id => id !== itemId);
        await Storage.saveWeeklyDay(dayPlan);

        await UI.renderWeeklyOutfits();
    },

    async saveWeeklyNotes(day, notes) {
        const weeklyPlan = await Storage.getWeeklyPlan();
        const dayPlan = weeklyPlan.find(d => d.day === day);

        if (!dayPlan) return;

        dayPlan.notes = notes;
        await Storage.saveWeeklyDay(dayPlan);
    },

    // ============ DAY TYPE EDITING ============

    editDayType(day) {
        this.currentEditingDay = day;
        const weeklyPlan = Storage.getSetting('weeklyPlanCache') || [];
        // We need to get the current type - for now use a prompt
        const currentType = prompt('Enter day type (e.g., Client Day, Casual Friday):');
        if (currentType !== null) {
            this.saveDayType(day, currentType);
        }
    },

    async saveDayType(day, type) {
        const weeklyPlan = await Storage.getWeeklyPlan();
        const dayPlan = weeklyPlan.find(d => d.day === day);

        if (!dayPlan) return;

        dayPlan.type = type || 'Regular Day';
        await Storage.saveWeeklyDay(dayPlan);

        await UI.renderWeeklyOutfits();
    },

    // ============ OUTFIT BUILDER ============

    async addToBuilder(itemId) {
        if (this.builderItems.includes(itemId)) {
            UI.showToast('Item already in outfit');
            return;
        }

        this.builderItems.push(itemId);
        await UI.renderBuilderCanvas(this.builderItems);
        UI.showToast('Added to outfit');
    },

    async removeFromBuilder(itemId) {
        this.builderItems = this.builderItems.filter(id => id !== itemId);
        await UI.renderBuilderCanvas(this.builderItems);
    },

    clearBuilder() {
        this.builderItems = [];
        UI.renderBuilderCanvas([]);
        document.getElementById('builder-notes').value = '';
    },

    async saveBuilderOutfit() {
        if (this.builderItems.length === 0) {
            UI.showToast('Add some items first!');
            return;
        }

        const notes = document.getElementById('builder-notes')?.value || '';

        const outfit = {
            items: [...this.builderItems],
            notes: notes,
            date: new Date().toLocaleString()
        };

        await Storage.saveOutfit(outfit);

        UI.showToast('Outfit saved! 💾');
        this.clearBuilder();
        await UI.renderSavedOutfits();
    },

    async loadSavedOutfit(outfitId) {
        const outfits = await Storage.getAllSavedOutfits();
        const outfit = outfits.find(o => o.id === outfitId);

        if (!outfit) return;

        this.builderItems = [...outfit.items];
        document.getElementById('builder-notes').value = outfit.notes || '';
        await UI.renderBuilderCanvas(this.builderItems);

        UI.showToast('Outfit loaded!');
    },

    async deleteSavedOutfit(outfitId) {
        await Storage.deleteSavedOutfit(outfitId);
        UI.showToast('Outfit deleted');
        await UI.renderSavedOutfits();
    },

    // ============ SHOPPING LIST ============

    openShoppingModal() {
        // Clear form
        document.getElementById('shop-name').value = '';
        document.getElementById('shop-desc').value = '';
        document.getElementById('shop-price').value = '';
        document.getElementById('shop-preview').style.display = 'none';

        UI.openModal('shopping-modal');
    },

    closeShoppingModal() {
        UI.closeModal('shopping-modal');
    },

    async addShoppingItem() {
        const name = document.getElementById('shop-name').value.trim();
        if (!name) {
            UI.showToast('Please enter an item name');
            return;
        }

        const desc = document.getElementById('shop-desc').value.trim();
        const price = document.getElementById('shop-price').value.trim();
        const preview = document.getElementById('shop-preview');

        let imageId = null;
        if (preview.style.display !== 'none' && preview.src) {
            // Save image and get ID
            imageId = Date.now();
            await Storage.saveImage(imageId, preview.src);
        }

        const item = {
            name,
            desc,
            price,
            imageId
        };

        await Storage.saveShoppingItem(item);

        this.closeShoppingModal();
        UI.showToast('Added to shopping list! 🛍️');
        await UI.renderShoppingList();
    },

    async deleteShoppingItem(itemId) {
        await Storage.deleteShoppingItem(itemId);
        UI.showToast('Removed from list');
        await UI.renderShoppingList();
    },

    // ============ CUSTOM SECTIONS ============

    openAddSectionModal() {
        document.getElementById('new-section-name').value = '';
        UI.openModal('add-section-modal');
    },

    closeAddSectionModal() {
        UI.closeModal('add-section-modal');
    },

    async createNewSection() {
        const name = document.getElementById('new-section-name').value.trim();
        if (!name) {
            UI.showToast('Please enter a section name');
            return;
        }

        const section = { name, items: [] };
        await Storage.saveCustomSection(section);

        this.closeAddSectionModal();
        UI.showToast(`Section "${name}" created!`);
        await UI.renderWardrobe();
    },

    async editSectionTitle(sectionId) {
        const sections = await Storage.getAllCustomSections();
        const section = sections.find(s => s.id === sectionId);

        if (!section) return;

        const newName = prompt('Enter new section name:', section.name);
        if (newName && newName.trim()) {
            section.name = newName.trim();
            await Storage.saveCustomSection(section);
            await UI.renderWardrobe();
        }
    },

    async deleteSection(sectionId) {
        if (!confirm('Delete this section? Items will be moved to trash.')) {
            return;
        }

        // Move items to trash
        const items = await Storage.getAllItems();
        const sectionItems = items.filter(i => i.category === `custom-${sectionId}`);

        for (const item of sectionItems) {
            item.deleted = true;
            item.originalCategory = item.category;
            await Storage.saveToTrash(item);
            await Storage.deleteItem(item.id);
        }

        await Storage.deleteCustomSection(sectionId);

        UI.showToast('Section deleted');
        await UI.renderWardrobe();
    },

    // ============ FILE UPLOADS ============

    setupUploads() {
        // Wardrobe upload
        const wardrobeUpload = document.getElementById('wardrobe-upload');
        if (wardrobeUpload) {
            wardrobeUpload.addEventListener('change', (e) => this.handleWardrobeUpload(e));
        }

        // Shopping photo upload
        const shopPhoto = document.getElementById('shop-photo');
        if (shopPhoto) {
            shopPhoto.addEventListener('change', (e) => this.handleShopPhotoUpload(e));
        }

        // Builder upload
        const builderUpload = document.getElementById('builder-upload');
        if (builderUpload) {
            builderUpload.addEventListener('change', (e) => this.handleBuilderUpload(e));
        }
    },

    handleWardrobeUpload(e) {
        const files = e.target.files;
        const container = document.getElementById('upload-preview-container');

        if (!container) return;

        container.innerHTML = '';

        for (const file of files) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = document.createElement('img');
                img.src = event.target.result;
                img.className = 'preview-image';
                img.dataset.base64 = event.target.result;
                container.appendChild(img);
            };
            reader.readAsDataURL(file);
        }
    },

    handleShopPhotoUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const preview = document.getElementById('shop-preview');
            if (preview) {
                preview.src = event.target.result;
                preview.style.display = 'block';
            }
        };
        reader.readAsDataURL(file);
    },

    async handleBuilderUpload(e) {
        const files = e.target.files;
        const category = 'other'; // Default category for builder uploads

        for (const file of files) {
            const base64 = await this.readFileAsBase64(file);
            const imageId = Date.now() + Math.random();

            await Storage.saveImage(imageId, base64);

            const item = {
                imageId,
                category,
                favorite: false,
                laundry: false,
                dateAdded: new Date().toISOString()
            };

            await Storage.saveItem(item);
        }

        UI.showToast('Items added!');
        await UI.renderBuilderPalette();
        await UI.renderWardrobe();
    },

    readFileAsBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },

    // ============ UPLOAD MODAL ============

    openUploadModal() {
        document.getElementById('upload-preview-container').innerHTML = '';
        document.getElementById('wardrobe-upload').value = '';
        UI.openModal('upload-modal');
    },

    closeUploadModal() {
        UI.closeModal('upload-modal');
    },

    async processUpload() {
        const container = document.getElementById('upload-preview-container');
        const category = document.getElementById('upload-category').value;

        const images = container.querySelectorAll('img');

        if (images.length === 0) {
            UI.showToast('Please select photos first');
            return;
        }

        for (const img of images) {
            const base64 = img.dataset.base64;
            const imageId = Date.now() + Math.random();

            await Storage.saveImage(imageId, base64);

            const item = {
                imageId,
                category,
                favorite: false,
                laundry: false,
                dateAdded: new Date().toISOString()
            };

            await Storage.saveItem(item);
        }

        this.closeUploadModal();
        UI.showToast(`${images.length} item(s) added to wardrobe! 📸`);
        await UI.renderWardrobe();
        await UI.renderBuilderPalette();
    },

    // ============ SETTINGS ============

    openSettings() {
        // Populate current values
        document.getElementById('settings-name').value = Storage.getSetting('userName', 'Emily');

        const location = Storage.getSetting('location');
        document.getElementById('settings-location').value = location?.name || 'Not set';

        document.getElementById('settings-temp-unit').value = Storage.getSetting('tempUnit', 'fahrenheit');

        UI.openModal('settings-modal');
    },

    closeSettings() {
        UI.closeModal('settings-modal');
    },

    async saveSettings() {
        const name = document.getElementById('settings-name').value.trim() || 'Emily';
        const tempUnit = document.getElementById('settings-temp-unit').value;

        Storage.setSetting('userName', name);
        Storage.setSetting('tempUnit', tempUnit);

        // Clear weather cache to refresh with new unit
        Storage.setSetting('weatherCache', null);

        this.closeSettings();
        UI.updateGreeting();
        await UI.renderWeather();
        UI.showToast('Settings saved!');
    },

    async detectLocation() {
        const btn = document.querySelector('#settings-modal .btn-secondary');
        const locationInput = document.getElementById('settings-location');

        if (btn) btn.disabled = true;
        if (locationInput) locationInput.value = 'Detecting...';

        try {
            const location = await Weather.getCurrentLocation();
            if (locationInput) locationInput.value = location.name;
            UI.showToast('Location updated!');
        } catch (err) {
            if (locationInput) locationInput.value = 'Detection failed';
            UI.showToast('Could not detect location');
        }

        if (btn) btn.disabled = false;
    },

    // ============ WELCOME MODAL ============

    showWelcomeModal() {
        UI.openModal('welcome-modal');
    },

    async completeWelcome() {
        const name = document.getElementById('welcome-name').value.trim() || 'Emily';
        Storage.setSetting('userName', name);
        Storage.setMigrated();

        UI.closeModal('welcome-modal');
        this.loadTheme();
        UI.updateGreeting();

        // Try to get location
        this.requestLocation();

        UI.showToast(`Welcome, ${name}! Let's build your wardrobe.`);
    },

    // ============ DATA EXPORT/IMPORT ============

    async exportData() {
        try {
            const data = await Storage.exportAllData();
            const json = JSON.stringify(data, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `wardrobe-backup-${new Date().toISOString().split('T')[0]}.json`;
            a.click();

            URL.revokeObjectURL(url);
            UI.showToast('Backup downloaded!');
        } catch (err) {
            console.error('Export error:', err);
            UI.showToast('Export failed');
        }
    },

    async importData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';

        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const text = await file.text();
                const data = JSON.parse(text);

                if (!confirm('This will replace all your current data. Continue?')) {
                    return;
                }

                await Storage.importAllData(data);

                UI.showToast('Data imported successfully!');
                window.location.reload();
            } catch (err) {
                console.error('Import error:', err);
                UI.showToast('Import failed - invalid file');
            }
        };

        input.click();
    }
};

// Tab switching function (global for onclick handlers)
function showTab(name) {
    UI.showTab(name);
}

// Theme toggle (global for onclick handler)
function toggleTheme() {
    App.toggleTheme();
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

// Export for use in other modules
window.App = App;
