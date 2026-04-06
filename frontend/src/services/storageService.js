/**
 * Storage Service - Handles all localStorage operations for cases
 * Provides a wrapper around browser localStorage with structured case management
 */

const CASE_PREFIX = 'suderm_case_';
const INDEX_KEY = 'suderm_cases_index';

export class StorageService {
  /**
   * Save a complete case to localStorage
   */
  static saveCase(caseData) {
    try {
      if (!caseData.id) {
        caseData.id = `case_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }

      const enrichedCase = {
        ...caseData,
        savedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Save case
      localStorage.setItem(
        `${CASE_PREFIX}${enrichedCase.id}`,
        JSON.stringify(enrichedCase)
      );

      // Update index
      this._updateIndex(enrichedCase.id);

      return enrichedCase;
    } catch (error) {
      console.error('Error saving case:', error);
      throw new Error('Failed to save case. Storage may be full.');
    }
  }

  /**
   * Get a specific case by ID
   */
  static getCase(caseId) {
    try {
      const data = localStorage.getItem(`${CASE_PREFIX}${caseId}`);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error retrieving case:', error);
      return null;
    }
  }

  /**
   * Search cases by patient ID
   */
  static getCasesByPatientId(patientId) {
    try {
      const cases = this.getAllCases();
      return cases
        .filter(c => c.patientId === patientId)
        .sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
    } catch (error) {
      console.error('Error searching cases:', error);
      return [];
    }
  }

  /**
   * Get all cases (newest first)
   */
  static getAllCases() {
    try {
      const index = this._getIndex();
      return index
        .map(caseId => this.getCase(caseId))
        .filter(c => c !== null)
        .sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
    } catch (error) {
      console.error('Error retrieving all cases:', error);
      return [];
    }
  }

  /**
   * Get recent cases (last N cases)
   */
  static getRecentCases(limit = 10) {
    return this.getAllCases().slice(0, limit);
  }

  /**
   * Delete a case
   */
  static deleteCase(caseId) {
    try {
      localStorage.removeItem(`${CASE_PREFIX}${caseId}`);
      this._removeFromIndex(caseId);
      return true;
    } catch (error) {
      console.error('Error deleting case:', error);
      return false;
    }
  }

  /**
   * Clear all cases (for testing/reset)
   */
  static clearAllCases() {
    try {
      const index = this._getIndex();
      index.forEach(caseId => {
        localStorage.removeItem(`${CASE_PREFIX}${caseId}`);
      });
      localStorage.removeItem(INDEX_KEY);
      return true;
    } catch (error) {
      console.error('Error clearing cases:', error);
      return false;
    }
  }

  /**
   * Get storage stats
   */
  static getStorageStats() {
    const cases = this.getAllCases();
    return {
      totalCases: cases.length,
      storageUsed: new Blob(Object.values(localStorage)).size,
      recentCases: cases.slice(0, 5),
    };
  }

  /**
   * Update case index
   */
  static _updateIndex(caseId) {
    const index = this._getIndex();
    if (!index.includes(caseId)) {
      index.unshift(caseId);
      localStorage.setItem(INDEX_KEY, JSON.stringify(index));
    }
  }

  /**
   * Remove from index
   */
  static _removeFromIndex(caseId) {
    const index = this._getIndex();
    const filtered = index.filter(id => id !== caseId);
    localStorage.setItem(INDEX_KEY, JSON.stringify(filtered));
  }

  /**
   * Get all case IDs from index
   */
  static _getIndex() {
    try {
      const data = localStorage.getItem(INDEX_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error reading index:', error);
      return [];
    }
  }

  /**
   * Export all cases as JSON (for backup)
   */
  static exportAllCases() {
    const cases = this.getAllCases();
    return JSON.stringify(cases, null, 2);
  }

  /**
   * Import cases from JSON
   */
  static importCases(jsonString) {
    try {
      const cases = JSON.parse(jsonString);
      if (!Array.isArray(cases)) {
        throw new Error('Invalid format');
      }
      cases.forEach(c => this.saveCase(c));
      return true;
    } catch (error) {
      console.error('Error importing cases:', error);
      return false;
    }
  }
}

export default StorageService;
