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
          let response;

          // Detect Gotify URLs and use native Gotify API
          // Gotify format: gotify://hostname/token, gotifys://hostname/token (HTTPS), or https://hostname/gotify?token=xxx
          const gotifyMatch = url.match(/^gotifys?:\/\/([^/]+)\/(.+)$/);
          const gotifyHttpMatch = url.match(/^(https?:\/\/[^?]+)\?token=(.+)$/);
          // gotifys:// uses HTTPS, gotify:// uses HTTP
          const gotifyIsSecure = url.startsWith('gotifys://');

          if (gotifyMatch) {
            // gotify://host/token or gotifys://host/token format
            const host = /** @type {string} */ (gotifyMatch[1]);
            const token = /** @type {string} */ (gotifyMatch[2]);
            const protocol = gotifyIsSecure ? 'https' : 'http';
            response = await axios.post(
              `${protocol}://${host}/message?token=${encodeURIComponent(token)}`,
              { title: title || 'PVE Scripts Local', message: body || '', priority: 5 },
              { headers: { 'Content-Type': 'application/json' }, timeout: 10000 },
            );
          } else if (gotifyHttpMatch) {
            // https://host/gotify?token=xxx or https://host?token=xxx
            const baseUrl = /** @type {string} */ (gotifyHttpMatch[1]);
            const token = /** @type {string} */ (gotifyHttpMatch[2]);
            const messageUrl = baseUrl.endsWith('/message') ? baseUrl : `${baseUrl}/message`;
            response = await axios.post(
              `${messageUrl}?token=${encodeURIComponent(token)}`,
              { title: title || 'PVE Scripts Local', message: body || '', priority: 5 },
              { headers: { 'Content-Type': 'application/json' }, timeout: 10000 },
            );
          } else {
            // Default: Apprise-style form-data POST
            response = await axios.post(url, formData, {
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
              },
              timeout: 10000
            });
          }
          
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

    // Basic URL validation (allow custom schemes like gotify://)
    if (!url.match(/^[a-z]+:\/\//i)) {
      return { valid: false, error: 'Invalid URL format' };
    }

    // Check for common Apprise URL patterns
    const apprisePatterns = [
      /^discord:\/\//,
      /^tgram:\/\//,
      /^mailto:\/\//,
      /^slack:\/\//,
      /^gotifys?:\/\//,
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
