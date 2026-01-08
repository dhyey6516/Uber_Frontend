import { io } from 'socket.io-client';

// Get API URL from environment or use default
const API_BASE_URL = import.meta.env.VITE_BASE_URL || 'https://your-backend-url.com';

class SocketManager {
  constructor() {
    this.socket = null;
    this.locationInterval = null;
    this.userId = null;
    this.userType = null; // 'user' or 'captain'
  }

  connect(userId, userType) {
    if (this.socket?.connected) {
      console.log('Socket already connected');
      return;
    }

    this.userId = userId;
    this.userType = userType;

    // Connect to socket server
    this.socket = io(API_BASE_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket.id);
      
      // Add socket ID to user/captain in database
      this.socket.emit('addSocketIdToUserDb', {
        userId: userId,
        type: userType,
      });

      // Dispatch a custom event when socket connects so components can set up listeners
      window.dispatchEvent(new CustomEvent('socketConnected', { 
        detail: { socketId: this.socket.id, userType } 
      }));
    });

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    // Start location updates for captains
    if (userType === 'captain') {
      this.startLocationUpdates(userId);
    }
  }

  startLocationUpdates(captainId) {
    // Clear any existing interval
    if (this.locationInterval) {
      clearInterval(this.locationInterval);
    }

    // Update location every 10 seconds
    this.locationInterval = setInterval(() => {
      if (navigator.geolocation && this.socket?.connected) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const location = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            };

            // Emit location update to server
            this.socket.emit('update-location-captain', {
              captainId: captainId,
              location: location,
              captainSocketId: this.socket.id,
            });

            console.log('Captain location updated:', location);
          },
          (error) => {
            console.error('Error getting location:', error);
          },
          {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0,
          }
        );
      }
    }, 10000); // 10 seconds
  }

  stopLocationUpdates() {
    if (this.locationInterval) {
      clearInterval(this.locationInterval);
      this.locationInterval = null;
    }
  }

  disconnect() {
    // Remove socket ID from database
    if (this.socket?.connected && this.userId && this.userType) {
      this.socket.emit('removeSocketIdFromUserDb', {
        userId: this.userId,
        type: this.userType,
      });
    }

    // Stop location updates
    this.stopLocationUpdates();

    // Disconnect socket
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.userId = null;
    this.userType = null;
  }

  // Get socket instance for event listeners
  getSocket() {
    return this.socket;
  }

  // Check if socket is connected
  isConnected() {
    return this.socket?.connected || false;
  }
}

// Export singleton instance
export const socketManager = new SocketManager();

