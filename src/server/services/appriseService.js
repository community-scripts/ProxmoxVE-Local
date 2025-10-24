import axios from 'axios';

export class AppriseService {
  constructor() {
    this.baseUrl = 'http://localhost:8080'; // Default Apprise API URL
  }

  /**
   * Send notification via Apprise
   * @param {string} title - Notification title
   * @param {string} body - Notification body
   * @param {string[]} urls - Array of Apprise URLs
   */
  async sendNotification(title, body, urls) {
    if (!urls || urls.length === 0) {
      throw new Error('No Apprise URLs provided');
    }

    try {
      // Format the notification as form data (Apprise API expects form data)
      const formData = new URLSearchParams();
      formData.append('body', body || '');
      formData.append('title', title || 'PVE Scripts Local');
      formData.append('tags', 'all');

      // Send to each URL
      const results = [];
      for (const url of urls) {
        try {
          const response = await axios.post(url, formData, {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            timeout: 10000 // 10 second timeout
          });
          
          results.push({
            url,
            success: true,
            status: response.status
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`Failed to send notification to ${url}:`, errorMessage);
          results.push({
            url,
            success: false,
            error: errorMessage
          });
        }
      }

      // Check if any notifications succeeded
      const successCount = results.filter(r => r.success).length;
      if (successCount === 0) {
        throw new Error('All notification attempts failed');
      }

      return {
        success: true,
        message: `Notification sent to ${successCount}/${urls.length} services`,
        results
      };

    } catch (error) {
      console.error('Apprise notification failed:', error);
      throw error;
    }
  }

  /**
   * Test notification to a single URL
   * @param {string} url - Apprise URL to test
   */
  async testUrl(url) {
    try {
      await this.sendNotification('Test', 'This is a test notification', [url]);
      return { success: true, message: 'Test notification sent successfully' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, message: errorMessage };
    }
  }

  /**
   * Validate Apprise URL format
   * @param {string} url - URL to validate
   */
  validateUrl(url) {
    if (!url || typeof url !== 'string') {
      return { valid: false, error: 'URL is required' };
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      return { valid: false, error: 'Invalid URL format' };
    }

    // Check for common Apprise URL patterns
    const apprisePatterns = [
      /^discord:\/\//,
      /^tgram:\/\//,
      /^mailto:\/\//,
      /^slack:\/\//,
      /^https?:\/\//
    ];

    const isValidAppriseUrl = apprisePatterns.some(pattern => pattern.test(url));
    
    if (!isValidAppriseUrl) {
      return { 
        valid: false, 
        error: 'URL does not match known Apprise service patterns' 
      };
    }

    return { valid: true };
  }
}

export const appriseService = new AppriseService();
