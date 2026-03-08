import apiClient from "./utils/apiClient";
import analyticsService from "./analyticsService";

class StudentService {
  constructor() {
    this.currentStudent = null;
    this.performanceCache = new Map();
  }

  /**
   * Get student by ID
   */
  async getStudent(studentId) {
    try {
      const response = await apiClient.nodeGet(`/students/${studentId}`);
      return response.data;
    } catch (error) {
      console.error("Get student error:", error);
      throw error;
    }
  }

  /**
   * Get student dashboard data
   */
  async getDashboardData(studentId) {
    try {
      const [performance, insights, recommendations, learningPath] =
        await Promise.all([
          this.getStudentPerformance(studentId),
          this.getStudentInsights(studentId),
          this.getRecommendations(studentId),
          this.getLearningPath(studentId),
        ]);

      return {
        success: true,
        performance: performance.performance,
        insights: insights.insights,
        recommendations: recommendations.recommendations,
        learningPath: learningPath.learningPath,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error("Get dashboard data error:", error);
      throw error;
    }
  }

  /**
   * Get student performance
   */
  async getStudentPerformance(studentId) {
    try {
      const response = await apiClient.nodeGet(
        `/students/${studentId}/performance`,
      );

      // Cache the response
      this.performanceCache.set(studentId, {
        data: response.performance,
        timestamp: Date.now(),
      });

      return response;
    } catch (error) {
      console.error("Get student performance error:", error);
      throw error;
    }
  }

  /**
   * Get student insights
   */
  async getStudentInsights(studentId) {
    try {
      const response = await apiClient.nodeGet(
        `/students/${studentId}/insights`,
      );
      return response;
    } catch (error) {
      console.error("Get student insights error:", error);
      throw error;
    }
  }

  /**
   * Get performance trends
   */
  async getPerformanceTrends(studentId, period = "weekly") {
    try {
      const response = await apiClient.nodeGet(
        `/students/${studentId}/trends`,
        { period },
      );
      return response;
    } catch (error) {
      console.error("Get performance trends error:", error);
      throw error;
    }
  }

  /**
   * Get topic performance
   */
  async getTopicPerformance(studentId, params = {}) {
    try {
      const response = await apiClient.nodeGet(
        `/students/${studentId}/topics`,
        params,
      );
      return response;
    } catch (error) {
      console.error("Get topic performance error:", error);
      throw error;
    }
  }

  /**
   * Get weak topics
   */
  async getWeakTopics(studentId, params = {}) {
    try {
      const response = await apiClient.nodeGet(
        `/students/${studentId}/weak-topics`,
        params,
      );
      return response;
    } catch (error) {
      console.error("Get weak topics error:", error);
      throw error;
    }
  }

  /**
   * Get strong topics
   */
  async getStrongTopics(studentId, params = {}) {
    try {
      const response = await apiClient.nodeGet(
        `/students/${studentId}/strong-topics`,
        params,
      );
      return response;
    } catch (error) {
      console.error("Get strong topics error:", error);
      throw error;
    }
  }

  /**
   * Get recommendations
   */
  async getRecommendations(studentId) {
    try {
      const response = await apiClient.nodeGet(
        `/students/${studentId}/recommendations`,
      );
      return response;
    } catch (error) {
      console.error("Get recommendations error:", error);
      throw error;
    }
  }

  /**
   * Get learning path
   */
  async getLearningPath(studentId) {
    try {
      const response = await apiClient.nodeGet(
        `/students/${studentId}/learning-path`,
      );
      return response;
    } catch (error) {
      console.error("Get learning path error:", error);
      throw error;
    }
  }

  /**
   * Get test history
   */
  async getTestHistory(studentId, params = {}) {
    try {
      const response = await apiClient.nodeGet(
        `/students/${studentId}/history`,
        params,
      );
      return response;
    } catch (error) {
      console.error("Get test history error:", error);
      throw error;
    }
  }

  /**
   * Get peer comparison
   */
  async getPeerComparison(studentId) {
    try {
      const response = await apiClient.nodeGet(
        `/students/${studentId}/compare`,
      );
      return response;
    } catch (error) {
      console.error("Get peer comparison error:", error);
      throw error;
    }
  }

  /**
   * Update student settings
   */
  async updateSettings(studentId, settings) {
    try {
      const response = await apiClient.nodePut(
        `/students/${studentId}/settings`,
        settings,
      );
      return response;
    } catch (error) {
      console.error("Update settings error:", error);
      throw error;
    }
  }

  /**
   * Get cached performance
   */
  getCachedPerformance(studentId) {
    const cached = this.performanceCache.get(studentId);
    if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
      // 5 minutes cache
      return cached.data;
    }
    return null;
  }

  /**
   * Clear cache for student
   */
  clearCache(studentId) {
    this.performanceCache.delete(studentId);
  }

  /**
   * Clear all cache
   */
  clearAllCache() {
    this.performanceCache.clear();
  }
}

export default new StudentService();
