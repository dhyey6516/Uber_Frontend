// Get API URL from environment or use default
// For production builds, set VITE_BASE_URL in GitHub Secrets
const API_BASE_URL = import.meta.env.VITE_BASE_URL || 'https://your-backend-url.com';

// Validate API URL
if (!import.meta.env.VITE_BASE_URL) {
  console.warn('VITE_BASE_URL is not set! Using default:', API_BASE_URL);
  console.warn('Please set VITE_BASE_URL in GitHub Secrets or workflow variables for production builds.');
}

export const api = {
  async register(userData) {
    const response = await fetch(`${API_BASE_URL}/users/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(userData),
    });
    
    if (!response.ok) {
      const error = await response.json();
      // Handle validation errors array
      if (error.errors && Array.isArray(error.errors)) {
        const errorMessages = error.errors.map(err => err.msg || err.message).join(', ');
        const apiError = new Error(errorMessages);
        apiError.errors = error.errors;
        throw apiError;
      }
      throw new Error(error.message || 'Registration failed');
    }
    
    return await response.json();
  },

  async login(email, password) {
    const response = await fetch(`${API_BASE_URL}/users/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Login failed');
    }
    
    return await response.json();
  },

  async getProfile() {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/users/profile`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      credentials: 'include',
      cache: 'no-store',
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch profile');
    }
    
    return await response.json();
  },

  // Captain APIs
  async registerCaptain(captainData) {
    const response = await fetch(`${API_BASE_URL}/captains/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(captainData),
    });
    
    if (!response.ok) {
      const error = await response.json();
      // Handle validation errors array
      if (error.errors && Array.isArray(error.errors)) {
        const errorMessages = error.errors.map(err => err.msg || err.message).join(', ');
        const apiError = new Error(errorMessages);
        apiError.errors = error.errors;
        throw apiError;
      }
      throw new Error(error.message || 'Registration failed');
    }
    
    return await response.json();
  },

  async loginCaptain(email, password) {
    const response = await fetch(`${API_BASE_URL}/captains/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Login failed');
    }
    
    return await response.json();
  },

  async getCaptainProfile() {
    const token = localStorage.getItem('captain_token');
    const response = await fetch(`${API_BASE_URL}/captains/profile`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      credentials: 'include',
      cache: 'no-store',
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch profile');
    }
    
    return await response.json();
  },

  // Maps APIs
  async getAutoComplete(input, location = null) {
    const params = new URLSearchParams({ input });
    if (location) {
      params.append('location', location);
    }
    const response = await fetch(`${API_BASE_URL}/maps/getAutoComplete?${params}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch autocomplete suggestions');
    }
    
    return await response.json();
  },

  async getReverseGeocode(lat, lng) {
    const response = await fetch(`${API_BASE_URL}/maps/getReverseGeocode?lat=${lat}&long=${lng}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch reverse geocode');
    }
    
    return await response.json();
  },

  // Ride APIs
  async getFare(pickup, destination) {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/rides/get-fare`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      credentials: 'include',
      body: JSON.stringify({ pickup, destination }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to calculate fare');
    }
    
    return await response.json();
  },

  async createRide(pickup, destination, vehicleType) {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/rides/create-ride`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      credentials: 'include',
      body: JSON.stringify({ pickup, destination, vehicleType }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create ride');
    }
    
    return await response.json();
  },

  async confirmRide(ride, captainId) {
    const token = localStorage.getItem('captain_token');
    const response = await fetch(`${API_BASE_URL}/rides/confirm-ride`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      credentials: 'include',
      body: JSON.stringify({ ride, captainId }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to confirm ride');
    }
    
    return await response.json();
  },

  async getRoute(slat, slong, elat, elong) {
    const token = localStorage.getItem('token') || localStorage.getItem('captain_token');
    const response = await fetch(`${API_BASE_URL}/maps/getDistance?slat=${slat}&slong=${slong}&elat=${elat}&elong=${elong}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      credentials: 'include',
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to get route');
    }
    
    const data = await response.json();
    return data;
  },

  async getCoordinates(address) {
    const token = localStorage.getItem('token') || localStorage.getItem('captain_token');
    const response = await fetch(`${API_BASE_URL}/maps/getAddressCoordinates?address=${encodeURIComponent(address)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      credentials: 'include',
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to get coordinates');
    }
    
    return await response.json();
  },
};

