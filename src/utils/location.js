import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

/**
 * Get current user location - works for both web and native platforms
 * @param {Object} options - Geolocation options
 * @returns {Promise<{latitude: number, longitude: number}>}
 */
export const getCurrentLocation = async (options = {}) => {
    const defaultOptions = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
    };
    const opts = { ...defaultOptions, ...options };

    try {
        // Check if running in Capacitor (native app)
        if (Capacitor.isNativePlatform()) {
            // Request permissions first
            const permissionStatus = await Geolocation.checkPermissions();
            
            if (permissionStatus.location !== 'granted') {
                const requestResult = await Geolocation.requestPermissions();
                if (requestResult.location !== 'granted') {
                    throw new Error('Location permission denied');
                }
            }

            // Get position using Capacitor Geolocation
            const position = await Geolocation.getCurrentPosition({
                enableHighAccuracy: opts.enableHighAccuracy,
                timeout: opts.timeout,
            });
            
            return {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
            };
        } else {
            // Fallback to browser geolocation for web
            return new Promise((resolve, reject) => {
                if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                        (position) => {
                            resolve({
                                latitude: position.coords.latitude,
                                longitude: position.coords.longitude,
                            });
                        },
                        (error) => {
                            reject(error);
                        },
                        opts
                    );
                } else {
                    reject(new Error('Geolocation not supported'));
                }
            });
        }
    } catch (error) {
        console.error('Error getting location:', error);
        throw error;
    }
};

