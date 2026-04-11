// API Configuration
// This will work on both laptop and phone when accessing via network

const getApiBaseUrl = () => {
  // If you're running on the same device (localhost)
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    return "http://localhost:8000";
  }
  
  // If accessing from another device on the network, use the host's IP
  // The frontend and backend should be on the same host
  return `http://${window.location.hostname}:8000`;
};

export const API_BASE_URL = getApiBaseUrl();

// Helper function for making authenticated requests
export const fetchWithAuth = async (endpoint: string, options: RequestInit = {}) => {
  const token = localStorage.getItem("token");
  
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  return response;
};

// Profile API helpers
export const profileApi = {
  // Get current user profile
  getProfile: async () => {
    const response = await fetchWithAuth("/api/auth/profile");
    if (!response.ok) {
      throw new Error("Failed to fetch profile");
    }
    return response.json();
  },

  // Update current user profile
  updateProfile: async (profileData: any) => {
    const response = await fetchWithAuth("/api/auth/profile", {
      method: "PUT",
      body: JSON.stringify(profileData),
    });
    if (!response.ok) {
      throw new Error("Failed to update profile");
    }
    return response.json();
  },
};

// Medical History API helpers
export const historyApi = {
  // Get current user's medical timeline
  getMyTimeline: async (limit: number = 100) => {
    const response = await fetchWithAuth(`/api/history/my-timeline?limit=${limit}`);
    if (!response.ok) {
      throw new Error("Failed to fetch medical timeline");
    }
    return response.json();
  },

  // Get timeline for a specific patient (requires permission)
  getTimeline: async (healthId: string, limit: number = 100) => {
    const response = await fetchWithAuth(`/api/history/timeline/${healthId}?limit=${limit}`);
    if (!response.ok) {
      throw new Error("Failed to fetch timeline");
    }
    return response.json();
  },

  // Get specific history entry
  getEntry: async (entryId: string) => {
    const response = await fetchWithAuth(`/api/history/entry/${entryId}`);
    if (!response.ok) {
      throw new Error("Failed to fetch history entry");
    }
    return response.json();
  },

  // Get summary statistics
  getStats: async (healthId: string) => {
    const response = await fetchWithAuth(`/api/history/stats/${healthId}`);
    if (!response.ok) {
      throw new Error("Failed to fetch history stats");
    }
    return response.json();
  },

  // Create history entry from chat session
  createFromChatSession: async (sessionId: string) => {
    const response = await fetchWithAuth(`/api/patient/chat/session/${sessionId}/create-history`, {
      method: "POST",
    });
    if (!response.ok) {
      throw new Error("Failed to create history entry from chat session");
    }
    return response.json();
  },
};

// Scan API helpers
export const scanApi = {
  // Upload scan for analysis
  uploadScan: async (scanType: string, file: File) => {
    const token = localStorage.getItem("token");
    const formData = new FormData();
    formData.append("scan_type", scanType);
    formData.append("file", file);

    const response = await fetch(`${API_BASE_URL}/api/patient/scan`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to upload scan");
    }

    return response.json();
  },
};

// Location / Hospital API helpers
export interface NearbyHospital {
  hospital_name: string;
  address: string;
  distance_km: number;
  latitude: number;
  longitude: number;
}

export const locationApi = {
  /**
   * Fetch nearby hospitals from the OSM Overpass-backed endpoint.
   * No auth required — public geo query.
   */
  getNearbyHospitals: async (
    lat: number,
    lng: number,
    radius: number = 5000
  ): Promise<NearbyHospital[]> => {
    const params = new URLSearchParams({
      lat: lat.toString(),
      lng: lng.toString(),
      radius: radius.toString(),
    });
    const response = await fetch(
      `${API_BASE_URL}/api/location/nearby-hospitals?${params}`
    );
    if (!response.ok) {
      throw new Error("Failed to fetch nearby hospitals");
    }
    return response.json();
  },
};
