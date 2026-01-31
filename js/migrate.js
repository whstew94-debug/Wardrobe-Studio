/**
 * Migration Script
 * Imports data from the old single-file wardrobe app
 *
 * USAGE:
 * 1. Open the NEW wardrobe-studio/index.html in a browser
 * 2. Open browser console (F12 -> Console)
 * 3. Paste this entire script and press Enter
 * 4. Follow the prompts
 */

const Migration = {
    // Run the migration
    async run() {
        console.log('🚀 Starting Wardrobe Studio Migration...');

        // Check if already migrated
        if (localStorage.getItem('wardrobe_migrated')) {
            const confirm = window.confirm(
                'You have already migrated data. Running again will ADD to existing data (not replace). Continue?'
            );
            if (!confirm) {
                console.log('Migration cancelled.');
                return;
            }
        }

        // Prompt for old HTML file
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.html';

        fileInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            console.log(`📂 Reading ${file.name}...`);

            try {
                const text = await file.text();
                await this.parseAndMigrate(text);
            } catch (err) {
                console.error('❌ Migration failed:', err);
                alert('Migration failed. See console for details.');
            }
        };

        alert('Select your old wardrobe HTML file (e.g., wardrobe-studio-FINAL.html)');
        fileInput.click();
    },

    async parseAndMigrate(htmlContent) {
        console.log('🔍 Parsing old wardrobe data...');

        // Extract wardrobeData
        const wardrobeMatch = htmlContent.match(/const wardrobeData\s*=\s*(\{[\s\S]*?\n\s*\});/);
        if (!wardrobeMatch) {
            throw new Error('Could not find wardrobeData in the file');
        }

        // Extract weeklyDefaults
        const weeklyMatch = htmlContent.match(/const weeklyDefaults\s*=\s*(\[[\s\S]*?\]);/);

        // Extract shoppingList
        const shoppingMatch = htmlContent.match(/let shoppingList\s*=\s*(\[[\s\S]*?\]);/);

        // Parse the extracted data
        let wardrobeData, weeklyDefaults, shoppingList;

        try {
            // Use Function constructor to safely evaluate the object literals
            wardrobeData = new Function(`return ${wardrobeMatch[1]}`)();
            console.log('✅ Found wardrobe data');
        } catch (e) {
            console.error('Failed to parse wardrobeData:', e);
            throw new Error('Invalid wardrobeData format');
        }

        try {
            if (weeklyMatch) {
                weeklyDefaults = new Function(`return ${weeklyMatch[1]}`)();
                console.log('✅ Found weekly plan data');
            }
        } catch (e) {
            console.warn('Could not parse weekly data:', e);
        }

        try {
            if (shoppingMatch) {
                shoppingList = new Function(`return ${shoppingMatch[1]}`)();
                console.log('✅ Found shopping list data');
            }
        } catch (e) {
            console.warn('Could not parse shopping list:', e);
        }

        // Now migrate the data
        await this.migrateWardrobe(wardrobeData);

        if (weeklyDefaults) {
            await this.migrateWeekly(weeklyDefaults);
        }

        if (shoppingList) {
            await this.migrateShoppingList(shoppingList);
        }

        // Mark as migrated
        localStorage.setItem('wardrobe_migrated', 'true');
        localStorage.setItem('wardrobe_migratedDate', new Date().toISOString());

        console.log('🎉 Migration complete!');
        alert('Migration complete! Refreshing page...');
        window.location.reload();
    },

    async migrateWardrobe(wardrobeData) {
        console.log('📦 Migrating wardrobe items...');

        const categories = ['tops', 'bottoms', 'outerwear', 'other'];
        let itemCount = 0;
        const idMap = new Map(); // Map old IDs to new IDs

        for (const category of categories) {
            const items = wardrobeData[category] || [];
            console.log(`  - ${category}: ${items.length} items`);

            for (const item of items) {
                // Generate new ID
                const newId = Date.now() + Math.random();
                const imageId = newId + 0.1;

                // Save the image
                if (item.img) {
                    await Storage.saveImage(imageId, item.img);
                }

                // Save the item
                const newItem = {
                    id: newId,
                    imageId: imageId,
                    category: category,
                    favorite: item.favorite || false,
                    laundry: item.laundry || false,
                    dateAdded: new Date().toISOString()
                };

                await Storage.saveItem(newItem);

                // Track ID mapping for weekly planner
                idMap.set(item.id, newId);
                itemCount++;

                // Small delay to avoid overwhelming IndexedDB
                await new Promise(r => setTimeout(r, 10));
            }
        }

        console.log(`✅ Migrated ${itemCount} wardrobe items`);

        // Store ID map for weekly migration
        this.idMap = idMap;
    },

    async migrateWeekly(weeklyDefaults) {
        console.log('📅 Migrating weekly planner...');

        for (const day of weeklyDefaults) {
            // Map old item IDs to new IDs
            const newItems = day.items
                .map(oldId => this.idMap?.get(oldId))
                .filter(id => id != null);

            const dayData = {
                day: day.day,
                type: day.type || 'Regular Day',
                items: newItems,
                notes: day.notes || ''
            };

            await Storage.saveWeeklyDay(dayData);
        }

        console.log(`✅ Migrated ${weeklyDefaults.length} days`);
    },

    async migrateShoppingList(shoppingList) {
        console.log('🛍️ Migrating shopping list...');

        for (const item of shoppingList) {
            let imageId = null;

            if (item.img) {
                imageId = Date.now() + Math.random();
                await Storage.saveImage(imageId, item.img);
            }

            const shoppingItem = {
                name: item.name,
                desc: item.desc || '',
                price: item.price || '',
                imageId: imageId
            };

            await Storage.saveShoppingItem(shoppingItem);

            await new Promise(r => setTimeout(r, 10));
        }

        console.log(`✅ Migrated ${shoppingList.length} shopping items`);
    }
};

// Auto-run if loaded directly
if (typeof window !== 'undefined' && window.Storage) {
    console.log('📋 Migration script loaded. Run Migration.run() to start.');
}
