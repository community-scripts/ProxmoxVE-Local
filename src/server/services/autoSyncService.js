import cron from 'node-cron';
import { scriptDownloaderService } from './scriptDownloader.js';
import { appriseService } from './appriseService.js';
import { readFile, writeFile, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import cronValidator from 'cron-validator';

// Global lock to prevent multiple autosync instances from running simultaneously
let globalAutoSyncLock = false;

export class AutoSyncService {
  constructor() {
    this.cronJob = null;
    this.isRunning = false;
  }

  /**
   * Safely convert a date to ISO string, handling invalid dates
   * @param {Date} date - The date to convert
   * @returns {string} - ISO string or fallback timestamp
   */
  safeToISOString(date) {
    try {
      // Check if the date is valid
      if (!date || isNaN(date.getTime())) {
        console.warn('Invalid date provided to safeToISOString, using current time as fallback');
        return new Date().toISOString();
      }
      return date.toISOString();
    } catch (error) {
      console.warn('Error converting date to ISO string:', error instanceof Error ? error.message : String(error));
      return new Date().toISOString();
    }
  }

  /**
   * Load auto-sync settings from .env file
   */
  loadSettings() {
    try {
      const envPath = join(process.cwd(), '.env');
      const envContent = readFileSync(envPath, 'utf8');
      
      /** @type {{
       *   autoSyncEnabled: boolean;
       *   syncIntervalType: string;
       *   syncIntervalPredefined?: string;
       *   syncIntervalCron?: string;
       *   autoDownloadNew: boolean;
       *   autoUpdateExisting: boolean;
       *   notificationEnabled: boolean;
       *   appriseUrls?: string[];
       *   lastAutoSync?: string;
       *   lastAutoSyncError?: string;
       *   lastAutoSyncErrorTime?: string;
       * }} */
      const settings = {
        autoSyncEnabled: false,
        syncIntervalType: 'predefined',
        syncIntervalPredefined: '1hour',
        syncIntervalCron: '',
        autoDownloadNew: false,
        autoUpdateExisting: false,
        notificationEnabled: false,
        appriseUrls: [],
        lastAutoSync: '',
        lastAutoSyncError: '',
        lastAutoSyncErrorTime: ''
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
            case 'LAST_AUTO_SYNC_ERROR':
              settings.lastAutoSyncError = value;
              break;
            case 'LAST_AUTO_SYNC_ERROR_TIME':
              settings.lastAutoSyncErrorTime = value;
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
        lastAutoSync: '',
        lastAutoSyncError: '',
        lastAutoSyncErrorTime: ''
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
   * @param {string} [settings.lastAutoSyncError]
   * @param {string} [settings.lastAutoSyncErrorTime]
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
        'LAST_AUTO_SYNC': settings.lastAutoSync || '',
        'LAST_AUTO_SYNC_ERROR': settings.lastAutoSyncError || '',
        'LAST_AUTO_SYNC_ERROR_TIME': settings.lastAutoSyncErrorTime || ''
      };
      
      const existingKeys = new Set();
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        
        // Skip empty lines and comments
        if (!trimmedLine || trimmedLine.startsWith('#')) {
          newLines.push(line);
          continue;
        }
        
        const equalIndex = trimmedLine.indexOf('=');
        if (equalIndex === -1) {
          // Line doesn't contain '=', keep as is
          newLines.push(line);
          continue;
        }
        
        const key = trimmedLine.substring(0, equalIndex).trim();
        if (key && key in settingsMap) {
          // Replace existing setting
          // @ts-ignore - Dynamic property access is safe here
          newLines.push(`${key}=${settingsMap[key]}`);
          existingKeys.add(key);
        } else {
          // Keep other settings as is
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
      console.log('Auto-sync is disabled, not scheduling cron job');
      this.isRunning = false; // Ensure we're completely stopped
      return;
    }
    
    // Check if there's already a global autosync running
    if (globalAutoSyncLock) {
      console.log('Auto-sync is already running globally, not scheduling new cron job');
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
    
    // Validate cron expression (5-field format for node-cron)
    if (!cronValidator.isValidCron(cronExpression, { seconds: false })) {
      console.error('Invalid cron expression:', cronExpression);
      return;
    }
    
    console.log(`Scheduling auto-sync with cron expression: ${cronExpression}`);
    
    /** @type {any} */
    const cronOptions = {
      scheduled: true,
      timezone: 'UTC'
    };
    
    this.cronJob = cron.schedule(cronExpression, async () => {
      // Check global lock first
      if (globalAutoSyncLock) {
        console.log('Auto-sync already running globally, skipping cron execution...');
        return;
      }
      
      if (this.isRunning) {
        console.log('Auto-sync already running locally, skipping...');
        return;
      }
      
      // Double-check that autosync is still enabled before executing
      const currentSettings = this.loadSettings();
      if (!currentSettings.autoSyncEnabled) {
        console.log('Auto-sync has been disabled, stopping and destroying cron job');
        this.stopAutoSync();
        return;
      }
      
      // Additional check: if cronJob is null, it means it was stopped
      if (!this.cronJob) {
        console.log('Cron job was stopped, skipping execution');
        return;
      }
      
      console.log('Starting scheduled auto-sync...');
      await this.executeAutoSync();
    }, cronOptions);
    
    console.log('Auto-sync cron job scheduled successfully');
  }

  /**
   * Stop auto-sync cron job
   */
  stopAutoSync() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob.destroy();
      this.cronJob = null;
      this.isRunning = false;
      console.log('Auto-sync cron job stopped and destroyed');
    } else {
      console.log('No active cron job to stop');
      this.isRunning = false; // Ensure isRunning is false even if no cron job
    }
  }

  /**
   * Execute auto-sync process using PocketBase as the source of truth.
   * PocketBase is always up to date, so no JSON sync is needed.
   */
  async executeAutoSync() {
    // Check global lock first
    if (globalAutoSyncLock) {
      console.log('Auto-sync already running globally, skipping...');
      return { success: false, message: 'Auto-sync already running globally' };
    }
    
    if (this.isRunning) {
      console.log('Auto-sync already running locally, skipping...');
      return { success: false, message: 'Auto-sync already running locally' };
    }
    
    // Set global lock
    globalAutoSyncLock = true;
    this.isRunning = true;
    const startTime = new Date();
    
    try {
      console.log('Starting auto-sync execution...');

      // Step 1: Fetch all scripts from PocketBase (always up to date)
      console.log('Fetching scripts from PocketBase...');
      const { getAllScripts: pbGetAllScripts } = await import('./pbScripts');
      const pbScripts = await pbGetAllScripts();
      console.log(`Retrieved ${pbScripts.length} scripts from PocketBase`);

      // Map PocketBase records to the internal Script format used by scriptDownloader
      const { scriptDownloaderService: sds } = await import('./scriptDownloader.js');
      const allScripts = pbScripts.map(pb => ({
        name: pb.name,
        slug: pb.slug,
        type: pb.type,
        updateable: pb.updateable,
        privileged: pb.privileged,
        interface_port: pb.port,
        documentation: pb.documentation,
        website: pb.website,
        logo: pb.logo,
        config_path: pb.config_path,
        description: pb.description,
        date_created: pb.script_created,
        categories: pb.categories.map(c => c.name),
        install_methods: pb.install_methods_json.map(m => ({
          type: m.type,
          resources: m.resources,
          config_path: m.config_path,
        })),
        default_credentials: { username: pb.default_user, password: pb.default_passwd },
        notes: pb.notes_json,
        is_dev: pb.is_dev,
        is_disabled: pb.is_disabled,
        is_deleted: pb.is_deleted,
        has_arm: pb.has_arm,
        version: pb.version,
      }));

      const results = {
        newScripts: /** @type {any[]} */ ([]),
        updatedScripts: /** @type {any[]} */ ([]),
        errors: /** @type {string[]} */ ([])
      };
      
      // Step 2: Auto-download/update scripts if enabled
      const settings = this.loadSettings();
      
      if (settings.autoDownloadNew || settings.autoUpdateExisting) {
        console.log('Checking scripts for auto-download/update...');

        // Separate new (not yet downloaded) from already-downloaded scripts
        const newScripts = [];
        const existingScripts = [];
        
        for (const script of allScripts) {
          try {
            if (!script || !script.slug) continue;
            const isDownloaded = await scriptDownloaderService.isScriptDownloaded(script);
            if (!isDownloaded) {
              newScripts.push(script);
            } else {
              existingScripts.push(script);
            }
          } catch (error) {
            console.warn(`Error checking script ${script?.slug || 'unknown'}:`, error);
            if (script && script.slug) newScripts.push(script);
          }
        }
        
        console.log(`Found ${newScripts.length} new scripts and ${existingScripts.length} existing scripts`);
          
          // Download new scripts
        if (settings.autoDownloadNew && newScripts.length > 0) {
          console.log(`Auto-downloading ${newScripts.length} new scripts...`);
            const downloaded = [];
            const errors = [];
            
            for (const script of newScripts) {
              try {
                const result = await scriptDownloaderService.loadScript(script);
                if (result.success) {
                  downloaded.push(script);
                  console.log(`Downloaded script: ${script.name || script.slug}`);
                } else {
                  errors.push(`${script.name || script.slug}: ${result.message}`);
                }
              } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                errors.push(`${script.name || script.slug}: ${errorMsg}`);
                console.error(`Failed to download script ${script.slug}:`, error);
              }
            }
            
            results.newScripts = downloaded;
            results.errors.push(...errors);
          }
          
          // Update existing scripts
        if (settings.autoUpdateExisting && existingScripts.length > 0) {
          console.log(`Auto-updating ${existingScripts.length} existing scripts...`);
            const updated = [];
            const errors = [];
            
            for (const script of existingScripts) {
              try {
                const result = await scriptDownloaderService.loadScript(script);
                if (result.success) {
                  updated.push(script);
                  console.log(`Updated script: ${script.name || script.slug}`);
                } else {
                  errors.push(`${script.name || script.slug}: ${result.message}`);
                }
              } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                errors.push(`${script.name || script.slug}: ${errorMsg}`);
                console.error(`Failed to update script ${script.slug}:`, error);
              }
            }
            
            results.updatedScripts = updated;
            results.errors.push(...errors);
          }
      } else {
        console.log('Auto-download/update disabled, skipping script processing');
      }
      
      // Step 3: Send notifications if enabled
      if (settings.notificationEnabled && settings.appriseUrls && settings.appriseUrls.length > 0) {
        console.log('Sending success notifications...');
        await this.sendSyncNotification(results);
        console.log('Success notifications sent');
      }
      
      // Step 4: Update last sync time and clear any previous errors
      const lastSyncTime = this.safeToISOString(new Date());
      const updatedSettings = { 
        ...settings, 
        lastAutoSync: lastSyncTime,
        lastAutoSyncError: ''
      };
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
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Send error notification if enabled
      const settings = this.loadSettings();
      if (settings.notificationEnabled && settings.appriseUrls && settings.appriseUrls.length > 0) {
        try {
          await appriseService.sendNotification(
            'Auto-Sync Failed',
            `Auto-sync failed with error: ${errorMessage}`,
            settings.appriseUrls || []
          );
        } catch (notifError) {
          console.error('Failed to send error notification:', notifError);
        }
      }
      
      // Store the error in settings for UI display
      const errorSettings = this.loadSettings();
      const updatedErrorSettings = { 
        ...errorSettings, 
        lastAutoSyncError: errorMessage,
        lastAutoSyncErrorTime: this.safeToISOString(new Date())
      };
      this.saveSettings(updatedErrorSettings);
      
      return {
        success: false,
        message: errorMessage,
        error: errorMessage,
      };
    } finally {
      this.isRunning = false;
      globalAutoSyncLock = false;
    }
  }

  /**
   * Group scripts by category name.
   * Scripts coming from PocketBase already have category names (strings).
   * @param {Array<any>} scripts - Array of script objects
   */
  groupScriptsByCategory(scripts) {
    const grouped = new Map();
    
    scripts.forEach(script => {
      if (!script || !script.name) {
        console.warn('Invalid script object in groupScriptsByCategory, skipping:', script);
        return;
      }
      
      // categories is now an array of strings (category names) from PocketBase
      const categoryNames = Array.isArray(script.categories) && script.categories.length > 0
        ? script.categories.map((/** @type {any} */ c) => typeof c === 'string' ? c : (c?.name ?? 'Miscellaneous'))
        : ['Miscellaneous'];

      categoryNames.forEach((/** @type {string} */ categoryName) => {
        if (!grouped.has(categoryName)) {
          grouped.set(categoryName, []);
        }
        grouped.get(categoryName).push(script.name);
      });
    });
    
    return grouped;
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
    
    // @ts-ignore - Dynamic property access
    if (results.newScripts?.length > 0) {
      // @ts-ignore - Dynamic property access
      body += `New scripts downloaded: ${results.newScripts.length}\n`;
      
      // @ts-ignore - Dynamic property access
      const newScriptsGrouped = this.groupScriptsByCategory(results.newScripts);
      const sortedCategories = Array.from(newScriptsGrouped.keys()).sort();
      
      sortedCategories.forEach(categoryName => {
        const scripts = newScriptsGrouped.get(categoryName);
        body += `\n**${categoryName}:**\n`;
        scripts.forEach((/** @type {string} */ scriptName) => {
          body += `• ${scriptName}\n`;
        });
      });
      body += '\n';
    }
    
    // @ts-ignore - Dynamic property access
    if (results.updatedScripts?.length > 0) {
      // @ts-ignore - Dynamic property access
      body += `Scripts updated: ${results.updatedScripts.length}\n`;
      
      // @ts-ignore - Dynamic property access
      const updatedScriptsGrouped = this.groupScriptsByCategory(results.updatedScripts);
      const sortedCategories = Array.from(updatedScriptsGrouped.keys()).sort();
      
      sortedCategories.forEach(categoryName => {
        const scripts = updatedScriptsGrouped.get(categoryName);
        body += `\n**${categoryName}:**\n`;
        scripts.forEach((/** @type {string} */ scriptName) => {
          body += `• ${scriptName}\n`;
        });
      });
      body += '\n';
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
