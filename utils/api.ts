import { auth } from './firebase';

class ApiClient {
  private baseUrl = 'http://localhost:3033';

  private async getAuthToken(): Promise<string | null> {
    const user = auth.currentUser;
    if (!user) return null;
    
    try {
      const token = await user.getIdToken();
      return token;
    } catch (error) {
      console.error('Error getting Firebase token:', error);
      return null;
    }
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const token = await this.getAuthToken();
    
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers,
    };

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'API request failed');
    }

    return response.json();
  }

  // Habit endpoints
  async createHabit(data: { name: string; goal: string; frequency: string }) {
    return this.request('/habits', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getHabits() {
    return this.request('/habits');
  }

  async updateHabit(id: string, data: any) {
    return this.request(`/habits/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteHabit(id: string) {
    return this.request(`/habits/${id}`, {
      method: 'DELETE',
    });
  }

  // Habit log endpoints
  async logHabit(data: { habitId: string; date: string }) {
    return this.request('/habit-logs', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getTodayLogs() {
    return this.request('/habit-logs/today');
  }

  async getHabitLogs(habitId: string) {
    return this.request(`/habit-logs/habit/${habitId}`);
  }

  async deleteLog(id: string) {
    return this.request(`/habit-logs/${id}`, {
      method: 'DELETE',
    });
  }

  // Analytics endpoints
  async getAnalytics() {
    return this.request('/analytics/summary');
  }

  async updateAnalytics() {
    return this.request('/analytics/update', {
      method: 'POST',
    });
  }

  // Achievement endpoints
  async getAchievements() {
    return this.request('/achievements');
  }

  // Notification endpoints
  async getNotifications() {
    return this.request('/notifications');
  }

  async markNotificationAsRead(id: string) {
    return this.request(`/notifications/${id}/read`, {
      method: 'PUT',
    });
  }

  async markAllNotificationsAsRead() {
    return this.request('/notifications/read-all', {
      method: 'PUT',
    });
  }

  async deleteNotification(id: string) {
    return this.request(`/notifications/${id}`, {
      method: 'DELETE',
    });
  }

  // Streak endpoints
  async getStreaks(habitId: string) {
    return this.request(`/streaks/${habitId}`);
  }

  async getCurrentStreak(habitId: string) {
    return this.request(`/streaks/current/${habitId}`);
  }

  // Social endpoints
  async getSocialShares() {
    return this.request('/social/history?limit=5');
  }

  async shareProgress(data: any) {
    return this.request('/social/progress', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // User endpoints
  async getUserProfile() {
    return this.request('/user/profile');
  }
}

export const apiClient = new ApiClient();