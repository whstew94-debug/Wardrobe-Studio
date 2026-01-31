# Wardrobe Studio

A personal wardrobe management and outfit planning app for Emily.

## Features

- **My Wardrobe**: Organize clothes by category (Tops, Bottoms, Outerwear, etc.)
- **Weekly Planner**: Plan outfits for each day of the week
- **Mix & Match**: Build and save outfit combinations
- **Shopping List**: Track items you want to buy
- **Weather Integration**: Get outfit suggestions based on local weather
- **Dark/Light Theme**: Easy on the eyes
- **Drag & Drop**: Easily move items between sections
- **Mobile Friendly**: Works great on phone browsers
- **Offline Support**: Works even without internet (PWA)

## Quick Start

### Option 1: Open Directly (Easiest)
1. Double-click `index.html` to open in your browser
2. On first visit, enter your name
3. Start uploading your wardrobe photos!

### Option 2: Import Existing Data
If you have the old `wardrobe-studio-FINAL.html` file with Emily's clothes:

1. Open `index.html` in Chrome
2. Press F12 to open Developer Tools
3. Go to Console tab
4. Copy and paste the contents of `js/migrate.js`
5. Press Enter, then type `Migration.run()` and press Enter
6. Select your old HTML file when prompted
7. Wait for migration to complete

## Generating PWA Icons

1. Open `icons/generate-icons.html` in your browser
2. Click "Download All Icons"
3. Save each downloaded icon to the `icons/` folder
4. Icons will be named `icon-32.png`, `icon-72.png`, etc.

## Deploying to GitHub Pages (Free Hosting)

### First Time Setup
1. Create a GitHub account at https://github.com
2. Create a new repository called `wardrobe-studio`
3. Upload all files from this folder to the repository
4. Go to Settings > Pages
5. Under "Source", select "main" branch
6. Click Save

### Your App URL
After deployment, your app will be available at:
`https://YOUR-USERNAME.github.io/wardrobe-studio/`

## File Structure

```
wardrobe-studio/
├── index.html          # Main app
├── manifest.json       # PWA configuration
├── sw.js              # Service worker (offline support)
├── css/
│   ├── main.css       # Core styles
│   ├── components.css # Component styles
│   ├── modal.css      # Modal styles
│   └── responsive.css # Mobile styles
├── js/
│   ├── app.js         # Main application logic
│   ├── storage.js     # Data persistence (IndexedDB)
│   ├── weather.js     # Weather API integration
│   ├── ui.js          # UI rendering
│   ├── dragdrop.js    # Drag and drop
│   └── migrate.js     # Data migration helper
└── icons/
    └── generate-icons.html # Icon generator
```

## Data Storage

All your wardrobe data is stored locally in your browser using IndexedDB.
- **Data persists** even after closing the browser
- **Backup your data** using Settings > Export Backup
- **Restore data** using Settings > Import Backup

## Weather

Weather is provided by [Open-Meteo](https://open-meteo.com/) (free, no API key needed).
- Automatically detects your location (with permission)
- Or set location manually in Settings
- Weather updates every 30 minutes

## Browser Support

- Chrome (recommended)
- Firefox
- Safari
- Edge

Works on both desktop and mobile browsers.

## Tips

1. **Add to Home Screen** (Mobile): In your browser menu, select "Add to Home Screen" to use like a native app
2. **Backup Regularly**: Use the Export function to save your wardrobe data
3. **Mark Favorites**: Star your go-to pieces for quick access
4. **Use Laundry**: Mark items as "in laundry" to exclude from outfit suggestions

---

Made with love for Emily's wardrobe organization needs.
