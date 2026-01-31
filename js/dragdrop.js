/**
 * Drag and Drop Module
 * Handles all drag-and-drop interactions
 */

const DragDrop = {
    draggedItem: null,
    draggedFromTrash: false,

    init() {
        document.addEventListener('dragstart', this.handleDragStart.bind(this));
        document.addEventListener('dragover', this.handleDragOver.bind(this));
        document.addEventListener('dragleave', this.handleDragLeave.bind(this));
        document.addEventListener('drop', this.handleDrop.bind(this));
        document.addEventListener('dragend', this.handleDragEnd.bind(this));

        // Touch support for mobile
        this.initTouchDrag();
    },

    handleDragStart(e) {
        const item = e.target.closest('.wardrobe-item');
        if (!item) return;

        this.draggedItem = {
            id: parseInt(item.dataset.id),
            category: item.dataset.category,
            element: item
        };
        this.draggedFromTrash = item.dataset.fromTrash === 'true';

        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', item.dataset.id);

        // Create a transparent drag image
        const dragImage = item.cloneNode(true);
        dragImage.style.opacity = '0.8';
        dragImage.style.position = 'absolute';
        dragImage.style.top = '-1000px';
        document.body.appendChild(dragImage);
        e.dataTransfer.setDragImage(dragImage, 50, 50);
        setTimeout(() => dragImage.remove(), 0);
    },

    handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        // Find drop target
        const canvas = e.target.closest('.outfit-canvas');
        const sectionHeader = e.target.closest('.section-header[data-category]');
        const wardrobeGrid = e.target.closest('.wardrobe-grid');

        // Clear previous indicators
        document.querySelectorAll('.drag-over, .drop-zone').forEach(el => {
            if (el !== canvas && el !== sectionHeader) {
                el.classList.remove('drag-over', 'drop-zone');
            }
        });

        if (canvas) {
            canvas.classList.add('drag-over');
        } else if (sectionHeader) {
            const category = sectionHeader.dataset.category;
            // Don't allow dropping on favorites or laundry sections
            if (category !== 'favorites' && category !== 'laundry') {
                sectionHeader.classList.add('drop-zone');
            }
        }
    },

    handleDragLeave(e) {
        const canvas = e.target.closest('.outfit-canvas');
        const sectionHeader = e.target.closest('.section-header');

        if (canvas && !canvas.contains(e.relatedTarget)) {
            canvas.classList.remove('drag-over');
        }
        if (sectionHeader && !sectionHeader.contains(e.relatedTarget)) {
            sectionHeader.classList.remove('drop-zone');
        }
    },

    async handleDrop(e) {
        e.preventDefault();

        if (!this.draggedItem) return;

        const canvas = e.target.closest('.outfit-canvas');
        const sectionHeader = e.target.closest('.section-header[data-category]');

        // Clean up visual indicators
        document.querySelectorAll('.drop-zone, .drag-over').forEach(el => {
            el.classList.remove('drop-zone', 'drag-over');
        });

        try {
            if (canvas) {
                // Dropped on outfit canvas (weekly planner or builder)
                const day = canvas.dataset.day;
                if (day) {
                    // Weekly planner
                    await this.addToWeeklyOutfit(day, this.draggedItem.id);
                } else {
                    // Builder canvas
                    App.addToBuilder(this.draggedItem.id);
                }
            } else if (sectionHeader) {
                // Dropped on a section header
                const targetCategory = sectionHeader.dataset.category;

                // Don't allow dropping on favorites or laundry
                if (targetCategory === 'favorites' || targetCategory === 'laundry') {
                    UI.showToast('Use the buttons to add items to favorites or laundry');
                    return;
                }

                if (this.draggedFromTrash) {
                    // Restore from trash to the target category
                    await this.restoreToCategory(this.draggedItem.id, targetCategory);
                } else {
                    // Move item to new category
                    await this.moveToCategory(this.draggedItem.id, targetCategory);
                }
            }
        } catch (err) {
            console.error('Drop error:', err);
            UI.showToast('Failed to move item');
        }

        this.cleanup();
    },

    handleDragEnd(e) {
        this.cleanup();
    },

    cleanup() {
        // Remove dragging class from all items
        document.querySelectorAll('.dragging').forEach(el => {
            el.classList.remove('dragging');
        });

        // Remove all drop indicators
        document.querySelectorAll('.drop-zone, .drag-over').forEach(el => {
            el.classList.remove('drop-zone', 'drag-over');
        });

        this.draggedItem = null;
        this.draggedFromTrash = false;
    },

    // Move item to a new category
    async moveToCategory(itemId, targetCategory) {
        const item = await Storage.getItem(itemId);
        if (!item) return;

        const oldCategory = item.category;
        if (oldCategory === targetCategory) return;

        item.category = targetCategory;
        await Storage.saveItem(item);

        UI.showToast(`Moved to ${this.getCategoryName(targetCategory)}`);
        await UI.renderWardrobe();
    },

    // Restore item from trash to a category
    async restoreToCategory(itemId, targetCategory) {
        const trashItem = await Storage.restoreFromTrash(itemId);
        if (!trashItem) return;

        trashItem.category = targetCategory;
        trashItem.deleted = false;
        await Storage.saveItem(trashItem);

        UI.showToast(`Restored to ${this.getCategoryName(targetCategory)}`);
        await UI.renderWardrobe();
    },

    // Add item to weekly outfit
    async addToWeeklyOutfit(day, itemId) {
        const weeklyPlan = await Storage.getWeeklyPlan();
        const dayPlan = weeklyPlan.find(d => d.day === day);

        if (!dayPlan) return;

        if (dayPlan.items.includes(itemId)) {
            UI.showToast('Item already in this outfit');
            return;
        }

        dayPlan.items.push(itemId);
        await Storage.saveWeeklyDay(dayPlan);

        UI.showToast(`Added to ${day}'s outfit`);
        await UI.renderWeeklyOutfits();
    },

    // Get human-readable category name
    getCategoryName(category) {
        const names = {
            'tops': 'Tops & Blouses',
            'bottoms': 'Bottoms',
            'outerwear': 'Outerwear',
            'other': 'Dresses & Shoes'
        };

        if (category.startsWith('custom-')) {
            return 'Custom Section';
        }

        return names[category] || category;
    },

    // Touch drag support for mobile
    initTouchDrag() {
        let touchStartItem = null;
        let touchClone = null;
        let touchStartX, touchStartY;

        document.addEventListener('touchstart', (e) => {
            const item = e.target.closest('.wardrobe-item');
            if (!item) return;

            touchStartItem = item;
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        }, { passive: true });

        document.addEventListener('touchmove', (e) => {
            if (!touchStartItem) return;

            const touch = e.touches[0];
            const deltaX = Math.abs(touch.clientX - touchStartX);
            const deltaY = Math.abs(touch.clientY - touchStartY);

            // Only start drag if moved significantly
            if (deltaX < 10 && deltaY < 10) return;

            e.preventDefault();

            // Create clone for visual feedback
            if (!touchClone) {
                touchClone = touchStartItem.cloneNode(true);
                touchClone.style.position = 'fixed';
                touchClone.style.width = '80px';
                touchClone.style.height = '80px';
                touchClone.style.opacity = '0.8';
                touchClone.style.pointerEvents = 'none';
                touchClone.style.zIndex = '9999';
                touchClone.style.borderRadius = '10px';
                touchClone.style.boxShadow = '0 10px 30px rgba(0,0,0,0.3)';
                document.body.appendChild(touchClone);

                this.draggedItem = {
                    id: parseInt(touchStartItem.dataset.id),
                    category: touchStartItem.dataset.category,
                    element: touchStartItem
                };
                this.draggedFromTrash = touchStartItem.dataset.fromTrash === 'true';
            }

            touchClone.style.left = (touch.clientX - 40) + 'px';
            touchClone.style.top = (touch.clientY - 40) + 'px';

            // Find element under touch
            touchClone.style.display = 'none';
            const elementUnder = document.elementFromPoint(touch.clientX, touch.clientY);
            touchClone.style.display = 'block';

            // Highlight drop targets
            document.querySelectorAll('.drop-zone, .drag-over').forEach(el => {
                el.classList.remove('drop-zone', 'drag-over');
            });

            const canvas = elementUnder?.closest('.outfit-canvas');
            const sectionHeader = elementUnder?.closest('.section-header[data-category]');

            if (canvas) {
                canvas.classList.add('drag-over');
            } else if (sectionHeader) {
                const category = sectionHeader.dataset.category;
                if (category !== 'favorites' && category !== 'laundry') {
                    sectionHeader.classList.add('drop-zone');
                }
            }
        }, { passive: false });

        document.addEventListener('touchend', async (e) => {
            if (!touchClone || !this.draggedItem) {
                touchStartItem = null;
                return;
            }

            const touch = e.changedTouches[0];

            // Find element under final touch position
            touchClone.style.display = 'none';
            const elementUnder = document.elementFromPoint(touch.clientX, touch.clientY);
            touchClone.style.display = 'block';

            const canvas = elementUnder?.closest('.outfit-canvas');
            const sectionHeader = elementUnder?.closest('.section-header[data-category]');

            try {
                if (canvas) {
                    const day = canvas.dataset.day;
                    if (day) {
                        await this.addToWeeklyOutfit(day, this.draggedItem.id);
                    } else {
                        App.addToBuilder(this.draggedItem.id);
                    }
                } else if (sectionHeader) {
                    const targetCategory = sectionHeader.dataset.category;
                    if (targetCategory !== 'favorites' && targetCategory !== 'laundry') {
                        if (this.draggedFromTrash) {
                            await this.restoreToCategory(this.draggedItem.id, targetCategory);
                        } else {
                            await this.moveToCategory(this.draggedItem.id, targetCategory);
                        }
                    }
                }
            } catch (err) {
                console.error('Touch drop error:', err);
            }

            // Cleanup
            if (touchClone) {
                touchClone.remove();
                touchClone = null;
            }
            touchStartItem = null;
            this.cleanup();
        });
    }
};

// Export for use in other modules
window.DragDrop = DragDrop;
