/**
 * Weather Module - Open-Meteo API Integration
 * Free API, no key required
 */

const Weather = {
    CACHE_DURATION: 30 * 60 * 1000, // 30 minutes
    DEFAULT_LOCATION: { lat: 33.2148, lon: -97.1331, name: 'Denton, Texas' },

    // WMO Weather interpretation codes to icons and descriptions
    weatherCodes: {
        0: { icon: '☀️', desc: 'Clear sky' },
        1: { icon: '🌤️', desc: 'Mainly clear' },
        2: { icon: '⛅', desc: 'Partly cloudy' },
        3: { icon: '☁️', desc: 'Overcast' },
        45: { icon: '🌫️', desc: 'Foggy' },
        48: { icon: '🌫️', desc: 'Fog' },
        51: { icon: '🌧️', desc: 'Light drizzle' },
        53: { icon: '🌧️', desc: 'Drizzle' },
        55: { icon: '🌧️', desc: 'Dense drizzle' },
        56: { icon: '🌧️', desc: 'Freezing drizzle' },
        57: { icon: '🌧️', desc: 'Freezing drizzle' },
        61: { icon: '🌧️', desc: 'Light rain' },
        63: { icon: '🌧️', desc: 'Rain' },
        65: { icon: '🌧️', desc: 'Heavy rain' },
        66: { icon: '🌧️', desc: 'Freezing rain' },
        67: { icon: '🌧️', desc: 'Freezing rain' },
        71: { icon: '🌨️', desc: 'Light snow' },
        73: { icon: '🌨️', desc: 'Snow' },
        75: { icon: '❄️', desc: 'Heavy snow' },
        77: { icon: '🌨️', desc: 'Snow grains' },
        80: { icon: '🌦️', desc: 'Rain showers' },
        81: { icon: '🌦️', desc: 'Rain showers' },
        82: { icon: '⛈️', desc: 'Heavy showers' },
        85: { icon: '🌨️', desc: 'Snow showers' },
        86: { icon: '🌨️', desc: 'Heavy snow showers' },
        95: { icon: '⛈️', desc: 'Thunderstorm' },
        96: { icon: '⛈️', desc: 'Thunderstorm with hail' },
        99: { icon: '⛈️', desc: 'Severe thunderstorm' }
    },

    // Get current location via geolocation API
    async getCurrentLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation not supported'));
                return;
            }

            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const { latitude, longitude } = position.coords;
                    try {
                        const name = await this.reverseGeocode(latitude, longitude);
                        const location = { lat: latitude, lon: longitude, name };
                        Storage.setSetting('location', location);
                        resolve(location);
                    } catch (err) {
                        const location = { lat: latitude, lon: longitude, name: `${latitude.toFixed(2)}, ${longitude.toFixed(2)}` };
                        Storage.setSetting('location', location);
                        resolve(location);
                    }
                },
                (error) => {
                    console.warn('Geolocation error:', error.message);
                    reject(error);
                },
                { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
            );
        });
    },

    // Reverse geocode coordinates to city name
    async reverseGeocode(lat, lon) {
        try {
            // Using Open-Meteo's geocoding service for reverse lookup
            const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;
            const response = await fetch(url, {
                headers: { 'User-Agent': 'WardrobeStudio/1.0' }
            });

            if (!response.ok) throw new Error('Geocoding failed');

            const data = await response.json();
            const city = data.address?.city || data.address?.town || data.address?.village || data.address?.county;
            const state = data.address?.state;

            if (city && state) {
                return `${city}, ${state}`;
            } else if (city) {
                return city;
            }

            return `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
        } catch (err) {
            console.warn('Reverse geocoding failed:', err);
            return `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
        }
    },

    // Search for a location by name
    async searchLocation(query) {
        try {
            const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`;
            const response = await fetch(url);

            if (!response.ok) throw new Error('Location search failed');

            const data = await response.json();
            return (data.results || []).map(r => ({
                lat: r.latitude,
                lon: r.longitude,
                name: `${r.name}${r.admin1 ? ', ' + r.admin1 : ''}${r.country ? ', ' + r.country : ''}`
            }));
        } catch (err) {
            console.error('Location search error:', err);
            return [];
        }
    },

    // Get saved or default location
    getLocation() {
        const saved = Storage.getSetting('location');
        return saved || this.DEFAULT_LOCATION;
    },

    // Fetch weather data from Open-Meteo
    async fetchWeather(lat, lon) {
        // Check cache first
        const cached = Storage.getSetting('weatherCache');
        if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
            console.log('Using cached weather data');
            return cached.data;
        }

        const tempUnit = Storage.getSetting('tempUnit', 'fahrenheit');
        const url = `https://api.open-meteo.com/v1/forecast?` +
            `latitude=${lat}&longitude=${lon}` +
            `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m` +
            `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code` +
            `&temperature_unit=${tempUnit}` +
            `&wind_speed_unit=mph` +
            `&precipitation_unit=inch` +
            `&timezone=auto` +
            `&forecast_days=7`;

        try {
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`Weather API error: ${response.status}`);
            }

            const data = await response.json();

            // Cache the result
            Storage.setSetting('weatherCache', {
                data,
                timestamp: Date.now()
            });

            return data;
        } catch (err) {
            console.error('Weather fetch error:', err);
            // Return cached data if available, even if stale
            if (cached) {
                console.log('Using stale cached weather data');
                return cached.data;
            }
            throw err;
        }
    },

    // Get weather info for display
    getWeatherInfo(code) {
        return this.weatherCodes[code] || { icon: '🌡️', desc: 'Unknown' };
    },

    // Get outfit suggestions based on weather
    getOutfitSuggestions(weatherData) {
        if (!weatherData?.current) return [];

        const temp = weatherData.current.apparent_temperature;
        const code = weatherData.current.weather_code;
        const precip = weatherData.current.precipitation;
        const humidity = weatherData.current.relative_humidity_2m;
        const tempUnit = Storage.getSetting('tempUnit', 'fahrenheit');

        const suggestions = [];

        // Temperature-based suggestions (Fahrenheit)
        const tempF = tempUnit === 'celsius' ? (temp * 9/5) + 32 : temp;

        if (tempF < 32) {
            suggestions.push({
                icon: '🧥',
                text: 'Bundle up! Heavy coat, layers, and warm accessories recommended',
                category: 'outerwear'
            });
        } else if (tempF < 45) {
            suggestions.push({
                icon: '🧥',
                text: 'Cold day - wear a warm coat and consider layers',
                category: 'outerwear'
            });
        } else if (tempF < 55) {
            suggestions.push({
                icon: '🧥',
                text: 'Chilly - a medium jacket or cardigan will keep you comfortable',
                category: 'outerwear'
            });
        } else if (tempF < 65) {
            suggestions.push({
                icon: '👚',
                text: 'Nice layering weather - light jacket optional',
                category: 'tops'
            });
        } else if (tempF < 75) {
            suggestions.push({
                icon: '👗',
                text: 'Perfect weather! Light, comfortable clothing works great',
                category: 'tops'
            });
        } else if (tempF < 85) {
            suggestions.push({
                icon: '👕',
                text: 'Warm day - choose breathable, light fabrics',
                category: 'tops'
            });
        } else {
            suggestions.push({
                icon: '🥵',
                text: 'Hot! Stay cool with loose, light-colored clothing',
                category: 'tops'
            });
        }

        // Precipitation suggestions
        if (precip > 0 || code >= 51 && code < 70) {
            suggestions.push({
                icon: '☔',
                text: 'Rain expected - bring an umbrella or wear water-resistant layers',
                category: 'outerwear'
            });
        }

        if (code >= 71 && code < 78 || code >= 85 && code < 87) {
            suggestions.push({
                icon: '❄️',
                text: 'Snow expected - waterproof boots and warm layers recommended',
                category: 'outerwear'
            });
        }

        // Humidity suggestions
        if (humidity > 80 && tempF > 70) {
            suggestions.push({
                icon: '💧',
                text: 'High humidity - moisture-wicking fabrics will help',
                category: 'tops'
            });
        }

        // Wind suggestions
        if (weatherData.current.wind_speed_10m > 20) {
            suggestions.push({
                icon: '💨',
                text: 'Windy conditions - secure loose items and consider wind-resistant outerwear',
                category: 'outerwear'
            });
        }

        return suggestions;
    },

    // Format temperature for display
    formatTemp(temp) {
        const unit = Storage.getSetting('tempUnit', 'fahrenheit');
        const symbol = unit === 'celsius' ? '°C' : '°F';
        return `${Math.round(temp)}${symbol}`;
    },

    // Get the primary suggestion for the header
    getPrimarySuggestion(weatherData) {
        const suggestions = this.getOutfitSuggestions(weatherData);
        return suggestions.length > 0 ? suggestions[0] : null;
    }
};

// Export for use in other modules
window.Weather = Weather;
