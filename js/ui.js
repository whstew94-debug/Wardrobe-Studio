/**
 * UI Module - All DOM rendering functions
 */

const UI = {
    // Show a toast notification
    showToast(message, duration = 3000) {
        const toast = document.getElementById('toast');
        if (!toast) return;

        toast.textContent = message;
        toast.classList.add('show');

        setTimeout(() => {
            toast.classList.remove('show');
        }, duration);
    },

    // Update greeting based on time of day
    updateGreeting() {
        const hour = new Date().getHours();
        let greeting;

        if (hour < 12) greeting = 'Good morning';
        else if (hour < 17) greeting = 'Good afternoon';
        else greeting = 'Good evening';

        const userName = Storage.getSetting('userName', 'Emily');
        const greetingEl = document.getElementById('greeting');

        if (greetingEl) {
            greetingEl.innerHTML = `${greeting}, <span id="userName">${userName}</span>! ✨`;
        }
    },

    // Render weather widget
    async renderWeather() {
        const widget = document.getElementById('weatherWidget');
        if (!widget) return;

        // Show loading state
        widget.innerHTML = `
            <div class="weather-loading">
                <span>🌡️</span>
                <span>Loading weather...</span>
            </div>
        `;

        try {
            const location = Weather.getLocation();
            const weatherData = await Weather.fetchWeather(location.lat, location.lon);

            if (!weatherData?.current) {
                throw new Error('Invalid weather data');
            }

            const { temperature_2m, apparent_temperature, weather_code } = weatherData.current;
            const weatherInfo = Weather.getWeatherInfo(weather_code);
            const suggestion = Weather.getPrimarySuggestion(weatherData);

            widget.innerHTML = `
                <div class="weather-icon">${weatherInfo.icon}</div>
                <div class="weather-info">
                    <div class="weather-temp">${Weather.formatTemp(temperature_2m)}</div>
                    <div class="weather-desc">${weatherInfo.desc}</div>
                    <div class="weather-location">
                        <span>📍</span>
                        <span>${location.name}</span>
                    </div>
                </div>
            `;

            // Add suggestion banner if there is one
            if (suggestion) {
                const suggestionEl = document.getElementById('weatherSuggestion');
                if (suggestionEl) {
                    suggestionEl.innerHTML = `
                        <span class="weather-suggestion-icon">${suggestion.icon}</span>
                        <span>${suggestion.text}</span>
                    `;
                    suggestionEl.style.display = 'flex';
                }
            }

            // Store weather data for use by outfit suggestions
            window.currentWeather = weatherData;

        } catch (err) {
            console.error('Weather render error:', err);
            widget.innerHTML = `
                <div class="weather-error">
                    <span>🌡️</span>
                    <span>Weather unavailable</span>
                </div>
            `;
        }
    },

    // Render the entire wardrobe
    async renderWardrobe() {
        const items = await Storage.getAllItems();
        const trash = await Storage.getAllTrash();
        const customSections = await Storage.getAllCustomSections();

        // Group items by category
        const categories = {
            tops: items.filter(i => i.category === 'tops' && !i.deleted),
            bottoms: items.filter(i => i.category === 'bottoms' && !i.deleted),
            outerwear: items.filter(i => i.category === 'outerwear' && !i.deleted),
            other: items.filter(i => i.category === 'other' && !i.deleted)
        };

        // Render main category grids
        for (const [category, categoryItems] of Object.entries(categories)) {
            await this.renderGrid(`${category}-grid`, categoryItems);
        }

        // Render custom sections
        await this.renderCustomSections(customSections);

        // Render favorites
        const favorites = items.filter(i => i.favorite && !i.deleted);
        await this.renderGrid('favorites-grid', favorites);

        // Render laundry
        const laundry = items.filter(i => i.laundry && !i.deleted);
        await this.renderGrid('laundry-grid', laundry, true);

        // Render trash
        await this.renderTrash(trash);

        // Update move modal categories
        this.updateMoveModalCategories(customSections);
    },

    // Render a single wardrobe grid
    async renderGrid(gridId, items, isLaundry = false) {
        const grid = document.getElementById(gridId);
        if (!grid) return;

        if (items.length === 0) {
            grid.innerHTML = `<div class="empty-state">No items here yet</div>`;
            return;
        }

        let html = '';
        for (const item of items) {
            const imgSrc = await Storage.getImage(item.imageId);
            if (!imgSrc) continue;

            const laundryClass = item.laundry ? 'in-laundry' : '';
            const favClass = item.favorite ? 'active' : '';

            html += `
                <div class="wardrobe-item ${laundryClass}" draggable="true" data-id="${item.id}" data-category="${item.category}">
                    <img src="${imgSrc}" alt="Wardrobe item" loading="lazy">
                    <div class="item-actions">
                        <button class="action-icon laundry" onclick="App.toggleLaundry(${item.id})" title="${item.laundry ? 'Remove from laundry' : 'Add to laundry'}">
                            ${item.laundry ? '✓' : '🧺'}
                        </button>
                        <button class="action-icon favorite ${favClass}" onclick="App.toggleFavorite(${item.id})" title="${item.favorite ? 'Remove from favorites' : 'Add to favorites'}">
                            ${item.favorite ? '★' : '☆'}
                        </button>
                        <button class="action-icon move" onclick="App.openMoveModal(${item.id})" title="Move to section">
                            📁
                        </button>
                        <button class="action-icon delete" onclick="App.deleteItem(${item.id})" title="Delete">
                            🗑️
                        </button>
                    </div>
                    <button class="add-to-builder-btn" onclick="App.addToBuilder(${item.id})" title="Add to outfit builder">
                        +
                    </button>
                </div>
            `;
        }

        grid.innerHTML = html;
    },

    // Render custom sections
    async renderCustomSections(sections) {
        const container = document.getElementById('custom-sections');
        if (!container) return;

        let html = '';
        for (const section of sections) {
            html += `
                <div class="wardrobe-section" data-section-id="${section.id}">
                    <div class="section-header" data-category="custom-${section.id}">
                        <h3 class="section-title" onclick="App.editSectionTitle(${section.id})">${section.name}</h3>
                        <button class="btn btn-danger btn-sm" onclick="App.deleteSection(${section.id})">Delete Section</button>
                    </div>
                    <div class="wardrobe-grid" id="custom-${section.id}-grid"></div>
                </div>
            `;
        }

        container.innerHTML = html;

        // Render items for each custom section
        for (const section of sections) {
            const items = await Storage.getAllItems();
            const sectionItems = items.filter(i => i.category === `custom-${section.id}` && !i.deleted);
            await this.renderGrid(`custom-${section.id}-grid`, sectionItems);
        }
    },

    // Render trash
    async renderTrash(trashItems) {
        const grid = document.getElementById('trash-grid');
        const emptyBtn = document.getElementById('empty-trash-btn');

        if (!grid) return;

        if (emptyBtn) {
            emptyBtn.style.display = trashItems.length > 0 ? 'inline-flex' : 'none';
        }

        if (trashItems.length === 0) {
            grid.innerHTML = `<div class="empty-state">Trash is empty</div>`;
            return;
        }

        let html = '';
        for (const item of trashItems) {
            const imgSrc = await Storage.getImage(item.imageId);
            if (!imgSrc) continue;

            html += `
                <div class="wardrobe-item" draggable="true" data-id="${item.id}" data-from-trash="true">
                    <img src="${imgSrc}" alt="Deleted item" loading="lazy">
                    <div class="item-actions">
                        <button class="action-icon" onclick="App.restoreItem(${item.id})" title="Restore" style="color: var(--success);">
                            ↩️
                        </button>
                    </div>
                </div>
            `;
        }

        grid.innerHTML = html;
    },

    // Render weekly outfit planner
    async renderWeeklyOutfits() {
        const container = document.getElementById('weekly-outfits');
        if (!container) return;

        let weeklyPlan = await Storage.getWeeklyPlan();

        // Initialize default days if empty
        if (weeklyPlan.length === 0) {
            const defaults = [
                { day: 'Monday', type: 'Business Casual', items: [], notes: '' },
                { day: 'Tuesday', type: 'Client Day', items: [], notes: '' },
                { day: 'Wednesday', type: 'Client Day', items: [], notes: '' },
                { day: 'Thursday', type: 'Client Day', items: [], notes: '' },
                { day: 'Friday', type: 'Casual Friday', items: [], notes: '' }
            ];
            for (const day of defaults) {
                await Storage.saveWeeklyDay(day);
            }
            weeklyPlan = defaults;
        }

        let html = '';
        for (let i = 0; i < weeklyPlan.length; i++) {
            const outfit = weeklyPlan[i];
            const badgeClass = outfit.type.toLowerCase().includes('client') ? 'client' :
                             outfit.type.toLowerCase().includes('casual') ? 'casual' : 'business';

            html += `
                <div class="outfit-card">
                    <div class="outfit-header">
                        <span class="day-label">📅 ${outfit.day}</span>
                        <div class="outfit-meta">
                            <span class="meta-badge ${badgeClass}" onclick="App.editDayType('${outfit.day}')">${outfit.type}</span>
                        </div>
                    </div>
                    <div class="outfit-canvas" data-day="${outfit.day}">
                        ${outfit.items.length === 0 ? '<p class="outfit-canvas-empty">Drag items here or click + to add</p>' : ''}
                        <div id="weekly-items-${outfit.day}" style="display: contents;"></div>
                        <button class="add-item-btn" onclick="App.openWeeklyModal('${outfit.day}')">+ Add</button>
                    </div>
                    <div class="outfit-notes">
                        <textarea class="notes-input" placeholder="Add notes for ${outfit.day}..."
                            onchange="App.saveWeeklyNotes('${outfit.day}', this.value)">${outfit.notes || ''}</textarea>
                    </div>
                </div>
            `;
        }

        container.innerHTML = html;

        // Render items for each day
        for (const outfit of weeklyPlan) {
            await this.renderWeeklyDayItems(outfit.day, outfit.items);
        }
    },

    // Render items for a specific day
    async renderWeeklyDayItems(day, itemIds) {
        const container = document.getElementById(`weekly-items-${day}`);
        if (!container) return;

        if (itemIds.length === 0) {
            container.innerHTML = '';
            return;
        }

        let html = '';
        for (const itemId of itemIds) {
            const item = await Storage.getItem(itemId);
            if (!item) continue;

            const imgSrc = await Storage.getImage(item.imageId);
            if (!imgSrc) continue;

            html += `
                <div class="outfit-item-thumb">
                    <img src="${imgSrc}" alt="Outfit item" loading="lazy">
                    <button class="remove-btn" onclick="App.removeFromWeekly('${day}', ${itemId})">×</button>
                </div>
            `;
        }

        container.innerHTML = html;
    },

    // Render builder palette (all available items)
    async renderBuilderPalette() {
        const grid = document.getElementById('builder-palette');
        if (!grid) return;

        const items = await Storage.getAllItems();
        const availableItems = items.filter(i => !i.laundry && !i.deleted);

        if (availableItems.length === 0) {
            grid.innerHTML = `<div class="empty-state">No items available</div>`;
            return;
        }

        let html = '';
        for (const item of availableItems) {
            const imgSrc = await Storage.getImage(item.imageId);
            if (!imgSrc) continue;

            html += `
                <div class="wardrobe-item" data-id="${item.id}">
                    <img src="${imgSrc}" alt="Wardrobe item" loading="lazy">
                    <button class="add-to-builder-btn" onclick="App.addToBuilder(${item.id})" title="Add to outfit">
                        +
                    </button>
                </div>
            `;
        }

        grid.innerHTML = html;
    },

    // Render builder canvas
    async renderBuilderCanvas(itemIds) {
        const canvas = document.getElementById('builder-canvas');
        if (!canvas) return;

        if (itemIds.length === 0) {
            canvas.innerHTML = `<p class="outfit-canvas-empty">Click + on items to add them to your outfit</p>`;
            return;
        }

        let html = '';
        for (const itemId of itemIds) {
            const item = await Storage.getItem(itemId);
            if (!item) continue;

            const imgSrc = await Storage.getImage(item.imageId);
            if (!imgSrc) continue;

            html += `
                <div class="outfit-item-thumb">
                    <img src="${imgSrc}" alt="Outfit item" loading="lazy">
                    <button class="remove-btn" onclick="App.removeFromBuilder(${itemId})">×</button>
                </div>
            `;
        }

        canvas.innerHTML = html;
    },

    // Render saved outfits
    async renderSavedOutfits() {
        const section = document.getElementById('saved-outfits-section');
        const list = document.getElementById('saved-outfits-list');

        if (!section || !list) return;

        const savedOutfits = await Storage.getAllSavedOutfits();

        if (savedOutfits.length === 0) {
            section.style.display = 'none';
            return;
        }

        section.style.display = 'block';

        let html = '';
        for (const outfit of savedOutfits) {
            html += `
                <div class="saved-outfit">
                    <div class="saved-info">
                        <div class="saved-name">Outfit #${outfit.id} (${outfit.items?.length || 0} items)</div>
                        <div class="saved-date">${outfit.date || 'No date'}</div>
                        ${outfit.notes ? `<div class="saved-notes" style="font-size: 0.85em; color: var(--text-secondary); margin-top: 4px;">${outfit.notes}</div>` : ''}
                    </div>
                    <div class="saved-actions">
                        <button class="btn btn-secondary btn-sm" onclick="App.loadSavedOutfit(${outfit.id})">Load</button>
                        <button class="btn btn-danger btn-sm" onclick="App.deleteSavedOutfit(${outfit.id})">Delete</button>
                    </div>
                </div>
            `;
        }

        list.innerHTML = html;
    },

    // Render shopping list
    async renderShoppingList() {
        const grid = document.getElementById('shopping-list');
        if (!grid) return;

        const items = await Storage.getAllShoppingItems();

        if (items.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🛍️</div>
                    <p>Your shopping list is empty</p>
                </div>
            `;
            return;
        }

        let html = '';
        for (const item of items) {
            const imgSrc = item.imageId ? await Storage.getImage(item.imageId) : null;

            html += `
                <div class="shopping-item">
                    ${imgSrc ? `<img src="${imgSrc}" alt="${item.name}" class="shopping-thumb">` : '<div class="shopping-thumb" style="display: flex; align-items: center; justify-content: center; font-size: 2em;">👗</div>'}
                    <div class="shopping-info">
                        <div class="shopping-title">${item.name}</div>
                        <div class="shopping-desc">${item.desc || ''}</div>
                    </div>
                    ${item.price ? `<div class="shopping-price">${item.price}</div>` : ''}
                    <div class="shopping-actions">
                        <button class="btn btn-danger btn-sm" onclick="App.deleteShoppingItem(${item.id})">Remove</button>
                    </div>
                </div>
            `;
        }

        grid.innerHTML = html;
    },

    // Update move modal with custom sections
    updateMoveModalCategories(customSections) {
        const select = document.getElementById('move-category');
        if (!select) return;

        // Keep default options, add custom sections
        let html = `
            <option value="tops">Tops & Blouses</option>
            <option value="bottoms">Bottoms</option>
            <option value="outerwear">Outerwear</option>
            <option value="other">Dresses & Shoes</option>
        `;

        for (const section of customSections) {
            html += `<option value="custom-${section.id}">${section.name}</option>`;
        }

        select.innerHTML = html;

        // Also update upload modal
        const uploadSelect = document.getElementById('upload-category');
        if (uploadSelect) {
            uploadSelect.innerHTML = html;
        }
    },

    // Tab switching
    showTab(name) {
        document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));

        const tabContent = document.getElementById(name);
        if (tabContent) tabContent.classList.add('active');

        const tabBtn = document.querySelector(`.tab-btn[onclick*="${name}"]`);
        if (tabBtn) tabBtn.classList.add('active');

        // Refresh content when switching tabs
        if (name === 'weekly') {
            this.renderWeeklyOutfits();
        } else if (name === 'builder') {
            this.renderBuilderPalette();
            this.renderSavedOutfits();
        } else if (name === 'shopping') {
            this.renderShoppingList();
        }
    },

    // Modal helpers
    openModal(id) {
        const modal = document.getElementById(id);
        if (modal) modal.classList.add('active');
    },

    closeModal(id) {
        const modal = document.getElementById(id);
        if (modal) modal.classList.remove('active');
    },

    // Render weekly add modal with all items
    async renderWeeklyAddModal() {
        const grid = document.getElementById('weekly-add-grid');
        if (!grid) return;

        const items = await Storage.getAllItems();
        const availableItems = items.filter(i => !i.deleted);

        let html = '';
        for (const item of availableItems) {
            const imgSrc = await Storage.getImage(item.imageId);
            if (!imgSrc) continue;

            html += `
                <div class="wardrobe-item" data-id="${item.id}" onclick="App.addToWeeklyFromModal(${item.id})">
                    <img src="${imgSrc}" alt="Wardrobe item" loading="lazy">
                </div>
            `;
        }

        grid.innerHTML = html || '<div class="empty-state">No items available</div>';
    }
};

// Export for use in other modules
window.UI = UI;
