import cron from 'node-cron';
import { githubJsonService } from './githubJsonService.js';
import { scriptDownloaderService } from './scriptDownloader.js';
import { appriseService } from './appriseService.js';
import { readFile, writeFile, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import cronValidator from 'cron-validator';

export class AutoSyncService {
  constructor() {
    this.cronJob = null;
    this.isRunning = false;
  }

  /**
   * Load auto-sync settings from .env file
   */
  loadSettings() {
    try {
      const envPath = join(process.cwd(), '.env');
      const envContent = readFileSync(envPath, 'utf8');
      
      const settings = {
        autoSyncEnabled: false,
        syncIntervalType: 'predefined',
        syncIntervalPredefined: '1hour',
        syncIntervalCron: '',
        autoDownloadNew: false,
        autoUpdateExisting: false,
        notificationEnabled: false,
        appriseUrls: [],
        lastAutoSync: ''
      };
      const lines = envContent.split('\n');
      
      for (const line of lines) {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
          let value = valueParts.join('=').trim();
          // Remove surrounding quotes if present
          if (value.startsWith('"') && value.endsWith('"')) {
            value = value.slice(1, -1);
          }
          
          switch (key.trim()) {
            case 'AUTO_SYNC_ENABLED':
              settings.autoSyncEnabled = value === 'true';
              break;
            case 'SYNC_INTERVAL_TYPE':
              settings.syncIntervalType = value;
              break;
            case 'SYNC_INTERVAL_PREDEFINED':
              settings.syncIntervalPredefined = value;
              break;
            case 'SYNC_INTERVAL_CRON':
              settings.syncIntervalCron = value;
              break;
            case 'AUTO_DOWNLOAD_NEW':
              settings.autoDownloadNew = value === 'true';
              break;
            case 'AUTO_UPDATE_EXISTING':
              settings.autoUpdateExisting = value === 'true';
              break;
            case 'NOTIFICATION_ENABLED':
              settings.notificationEnabled = value === 'true';
              break;
            case 'APPRISE_URLS':
              try {
                settings.appriseUrls = JSON.parse(value || '[]');
              } catch {
                settings.appriseUrls = [];
              }
              break;
            case 'LAST_AUTO_SYNC':
              settings.lastAutoSync = value;
              break;
          }
        }
      }
      
      return settings;
    } catch (error) {
      console.error('Error loading auto-sync settings:', error);
      return {
        autoSyncEnabled: false,
        syncIntervalType: 'predefined',
        syncIntervalPredefined: '1hour',
        syncIntervalCron: '',
        autoDownloadNew: false,
        autoUpdateExisting: false,
        notificationEnabled: false,
        appriseUrls: [],
        lastAutoSync: ''
      };
    }
  }

  /**
   * Save auto-sync settings to .env file
   * @param {Object} settings - Settings object
   * @param {boolean} settings.autoSyncEnabled
   * @param {string} settings.syncIntervalType
   * @param {string} [settings.syncIntervalPredefined]
   * @param {string} [settings.syncIntervalCron]
   * @param {boolean} settings.autoDownloadNew
   * @param {boolean} settings.autoUpdateExisting
   * @param {boolean} settings.notificationEnabled
   * @param {Array<string>} [settings.appriseUrls]
   * @param {string} [settings.lastAutoSync]
   */
  saveSettings(settings) {
    try {
      const envPath = join(process.cwd(), '.env');
      let envContent = '';
      
      try {
        envContent = readFileSync(envPath, 'utf8');
      } catch {
        // .env file doesn't exist, create it
      }
      
      const lines = envContent.split('\n');
      const newLines = [];
      const settingsMap = {
        'AUTO_SYNC_ENABLED': settings.autoSyncEnabled.toString(),
        'SYNC_INTERVAL_TYPE': settings.syncIntervalType,
        'SYNC_INTERVAL_PREDEFINED': settings.syncIntervalPredefined || '',
        'SYNC_INTERVAL_CRON': settings.syncIntervalCron || '',
        'AUTO_DOWNLOAD_NEW': settings.autoDownloadNew.toString(),
        'AUTO_UPDATE_EXISTING': settings.autoUpdateExisting.toString(),
        'NOTIFICATION_ENABLED': settings.notificationEnabled.toString(),
        'APPRISE_URLS': JSON.stringify(settings.appriseUrls || []),
        'LAST_AUTO_SYNC': settings.lastAutoSync || ''
      };
      
      const existingKeys = new Set();
      
      for (const line of lines) {
        const [key] = line.split('=');
        const trimmedKey = key?.trim();
        if (trimmedKey && trimmedKey in settingsMap) {
          // @ts-ignore - Dynamic key access is safe here
          newLines.push(`${trimmedKey}=${settingsMap[trimmedKey]}`);
          existingKeys.add(trimmedKey);
        } else if (trimmedKey && !(trimmedKey in settingsMap)) {
          newLines.push(line);
        }
      }
      
      // Add any missing settings
      for (const [key, value] of Object.entries(settingsMap)) {
        if (!existingKeys.has(key)) {
          newLines.push(`${key}=${value}`);
        }
      }
      
      writeFileSync(envPath, newLines.join('\n'));
      console.log('Auto-sync settings saved successfully');
    } catch (error) {
      console.error('Error saving auto-sync settings:', error);
      throw error;
    }
  }

  /**
   * Schedule auto-sync cron job
   */
  scheduleAutoSync() {
    this.stopAutoSync(); // Stop any existing job
    
    const settings = this.loadSettings();
    if (!settings.autoSyncEnabled) {
      return;
    }
    
    let cronExpression;
    
    if (settings.syncIntervalType === 'custom') {
      cronExpression = settings.syncIntervalCron;
    } else {
      // Convert predefined intervals to cron expressions
      const intervalMap = {
        '15min': '*/15 * * * *',
        '30min': '*/30 * * * *',
        '1hour': '0 * * * *',
        '6hours': '0 */6 * * *',
        '12hours': '0 */12 * * *',
        '24hours': '0 0 * * *'
      };
      // @ts-ignore - Dynamic key access is safe here
      cronExpression = intervalMap[settings.syncIntervalPredefined] || '0 * * * *';
    }
    
    // Validate cron expression
    if (!cronValidator.isValidCron(cronExpression)) {
      console.error('Invalid cron expression:', cronExpression);
      return;
    }
    
    console.log(`Scheduling auto-sync with cron expression: ${cronExpression}`);
    
    this.cronJob = cron.schedule(cronExpression, async () => {
      if (this.isRunning) {
        console.log('Auto-sync already running, skipping...');
        return;
      }
      
      console.log('Starting scheduled auto-sync...');
      await this.executeAutoSync();
    }, {
      scheduled: true,
      timezone: 'UTC'
    });
    
    console.log('Auto-sync cron job scheduled successfully');
  }

  /**
   * Stop auto-sync cron job
   */
  stopAutoSync() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      console.log('Auto-sync cron job stopped');
    }
  }

  /**
   * Execute auto-sync process
   */
  async executeAutoSync() {
    if (this.isRunning) {
      console.log('Auto-sync already running, skipping...');
      return { success: false, message: 'Auto-sync already running' };
    }
    
    this.isRunning = true;
    const startTime = new Date();
    
    try {
      console.log('Starting auto-sync execution...');
      
      // Step 1: Sync JSON files
      console.log('Syncing JSON files...');
      const syncResult = await githubJsonService.syncJsonFiles();
      
      if (!syncResult.success) {
        throw new Error(`JSON sync failed: ${syncResult.message}`);
      }
      
      const results = {
        jsonSync: syncResult,
        newScripts: [],
        updatedScripts: [],
        errors: []
      };
      
      // Step 2: Auto-download/update scripts if enabled
      const settings = this.loadSettings();
      
      if (settings.autoDownloadNew || settings.autoUpdateExisting) {
        // Only process scripts for files that were actually synced
        // @ts-ignore - syncedFiles exists in the JavaScript version
        if (syncResult.syncedFiles && syncResult.syncedFiles.length > 0) {
          // @ts-ignore - syncedFiles exists in the JavaScript version
          console.log(`Processing ${syncResult.syncedFiles.length} synced JSON files for new scripts...`);
          
          // Get all scripts from synced files
          // @ts-ignore - syncedFiles exists in the JavaScript version
          const allSyncedScripts = await githubJsonService.getScriptsForFiles(syncResult.syncedFiles);
          
          // Filter to only truly NEW scripts (not previously downloaded)
          const newScripts = [];
          for (const script of allSyncedScripts) {
            const isDownloaded = await scriptDownloaderService.isScriptDownloaded(script);
            if (!isDownloaded) {
              newScripts.push(script);
            }
          }
          
          console.log(`Found ${newScripts.length} new scripts out of ${allSyncedScripts.length} total scripts`);
          
          if (settings.autoDownloadNew && newScripts.length > 0) {
            console.log(`Auto-downloading ${newScripts.length} new scripts...`);
            const downloadResult = await scriptDownloaderService.autoDownloadNewScripts(newScripts);
            // @ts-ignore - Type assertion needed for dynamic assignment
            results.newScripts = downloadResult.downloaded;
            // @ts-ignore - Type assertion needed for dynamic assignment
            results.errors.push(...downloadResult.errors);
          }
          
          if (settings.autoUpdateExisting) {
            console.log('Auto-updating existing scripts from synced files...');
            const updateResult = await scriptDownloaderService.autoUpdateExistingScripts(allSyncedScripts);
            // @ts-ignore - Type assertion needed for dynamic assignment
            results.updatedScripts = updateResult.updated;
            // @ts-ignore - Type assertion needed for dynamic assignment
            results.errors.push(...updateResult.errors);
          }
        } else {
          console.log('No JSON files were synced, skipping script download/update');
        }
      } else {
        console.log('Auto-download/update disabled, skipping script processing');
      }
      
      // Step 3: Send notifications if enabled
      if (settings.notificationEnabled && settings.appriseUrls?.length > 0) {
        console.log('Sending notifications...');
        await this.sendSyncNotification(results);
      }
      
      // Step 4: Update last sync time
      const lastSyncTime = new Date().toISOString();
      const updatedSettings = { ...settings, lastAutoSync: lastSyncTime };
      this.saveSettings(updatedSettings);
      
      const duration = new Date().getTime() - startTime.getTime();
      console.log(`Auto-sync completed successfully in ${duration}ms`);
      
      return {
        success: true,
        message: 'Auto-sync completed successfully',
        results,
        duration
      };
      
    } catch (error) {
      console.error('Auto-sync execution failed:', error);
      
      // Send error notification if enabled
      const settings = this.loadSettings();
      if (settings.notificationEnabled && settings.appriseUrls?.length > 0) {
        try {
          await appriseService.sendNotification(
            'Auto-Sync Failed',
            `Auto-sync failed with error: ${error instanceof Error ? error.message : String(error)}`,
            settings.appriseUrls
          );
        } catch (notifError) {
          console.error('Failed to send error notification:', notifError);
        }
      }
      
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error),
        error: error instanceof Error ? error.message : String(error)
      };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Send notification about sync results
   * @param {Object} results - Sync results object
   */
  async sendSyncNotification(results) {
    const settings = this.loadSettings();
    
    if (!settings.notificationEnabled || !settings.appriseUrls?.length) {
      return;
    }
    
    const title = 'ProxmoxVE-Local - Auto-Sync Completed';
    let body = `Auto-sync completed successfully.\n\n`;
    
    // Add JSON sync info
    // @ts-ignore - Dynamic property access
    if (results.jsonSync) {
      // @ts-ignore - Dynamic property access
      body += `JSON Files: ${results.jsonSync.syncedCount} synced, ${results.jsonSync.skippedCount} up-to-date\n`;
      // @ts-ignore - Dynamic property access
      if (results.jsonSync.errors?.length > 0) {
        // @ts-ignore - Dynamic property access
        body += `JSON Errors: ${results.jsonSync.errors.length}\n`;
      }
      body += '\n';
    }
    
    // @ts-ignore - Dynamic property access
    if (results.newScripts?.length > 0) {
      // @ts-ignore - Dynamic property access
      body += `New scripts downloaded: ${results.newScripts.length}\n`;
      // @ts-ignore - Dynamic property access
      body += `• ${results.newScripts.join('\n• ')}\n\n`;
    }
    
    // @ts-ignore - Dynamic property access
    if (results.updatedScripts?.length > 0) {
      // @ts-ignore - Dynamic property access
      body += `Scripts updated: ${results.updatedScripts.length}\n`;
      // @ts-ignore - Dynamic property access
      body += `• ${results.updatedScripts.join('\n• ')}\n\n`;
    }
    
    // @ts-ignore - Dynamic property access
    if (results.errors?.length > 0) {
      // @ts-ignore - Dynamic property access
      body += `Script errors encountered: ${results.errors.length}\n`;
      // @ts-ignore - Dynamic property access
      body += `• ${results.errors.slice(0, 5).join('\n• ')}\n`;
      // @ts-ignore - Dynamic property access
      if (results.errors.length > 5) {
        // @ts-ignore - Dynamic property access
        body += `• ... and ${results.errors.length - 5} more errors\n`;
      }
    }
    
    // @ts-ignore - Dynamic property access
    if (results.newScripts?.length === 0 && results.updatedScripts?.length === 0 && results.errors?.length === 0) {
      body += 'No script changes detected.';
    }
    
    try {
      await appriseService.sendNotification(title, body, settings.appriseUrls);
      console.log('Sync notification sent successfully');
    } catch (error) {
      console.error('Failed to send sync notification:', error);
    }
  }

  /**
   * Test notification
   */
  async testNotification() {
    const settings = this.loadSettings();
    
    if (!settings.notificationEnabled || !settings.appriseUrls?.length) {
      return {
        success: false,
        message: 'Notifications not enabled or no Apprise URLs configured'
      };
    }
    
    try {
      await appriseService.sendNotification(
        'ProxmoxVE-Local - Test Notification',
        'This is a test notification from PVE Scripts Local auto-sync feature.',
        settings.appriseUrls
      );
      
      return {
        success: true,
        message: 'Test notification sent successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to send test notification: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Get auto-sync status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      hasCronJob: !!this.cronJob,
      lastSync: this.loadSettings().lastAutoSync
    };
  }
}
