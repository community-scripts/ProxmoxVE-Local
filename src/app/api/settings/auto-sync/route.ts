import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { isValidCron } from 'cron-validator';

export async function POST(request: NextRequest) {
  try {
    const settings = await request.json();

    if (!settings || typeof settings !== 'object') {
      return NextResponse.json(
        { error: 'Settings object is required' },
        { status: 400 }
      );
    }

    // Handle test notification request
    if (settings.testNotification) {
      return await handleTestNotification();
    }
    
    // Handle manual sync trigger
    if (settings.triggerManualSync) {
      return await handleManualSync();
    }

    // Validate required fields for settings save
    const requiredFields = [
      'autoSyncEnabled',
      'syncIntervalType',
      'autoDownloadNew',
      'autoUpdateExisting',
      'notificationEnabled'
    ];
    
    for (const field of requiredFields) {
      if (!(field in settings)) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Validate sync interval type
    if (!['predefined', 'custom'].includes(settings.syncIntervalType)) {
      return NextResponse.json(
        { error: 'syncIntervalType must be "predefined" or "custom"' },
        { status: 400 }
      );
    }

    // Validate predefined interval
    if (settings.syncIntervalType === 'predefined') {
      const validIntervals = ['15min', '30min', '1hour', '6hours', '12hours', '24hours'];
      if (!validIntervals.includes(settings.syncIntervalPredefined)) {
        return NextResponse.json(
          { error: 'Invalid predefined interval' },
          { status: 400 }
        );
      }
    }

    // Validate custom cron expression
    if (settings.syncIntervalType === 'custom') {
      if (!settings.syncIntervalCron || typeof settings.syncIntervalCron !== 'string') {
        return NextResponse.json(
          { error: 'Custom cron expression is required when syncIntervalType is "custom"' },
          { status: 400 }
        );
      }

      if (!isValidCron(settings.syncIntervalCron)) {
        return NextResponse.json(
          { error: 'Invalid cron expression' },
          { status: 400 }
        );
      }
    }

    // Validate Apprise URLs if notifications are enabled
    if (settings.notificationEnabled && settings.appriseUrls) {
      try {
        // Handle both array and JSON string formats
        let urls;
        if (Array.isArray(settings.appriseUrls)) {
          urls = settings.appriseUrls;
        } else if (typeof settings.appriseUrls === 'string') {
          urls = JSON.parse(settings.appriseUrls);
        } else {
          return NextResponse.json(
            { error: 'Apprise URLs must be an array or JSON string' },
            { status: 400 }
          );
        }
        
        if (!Array.isArray(urls)) {
          return NextResponse.json(
            { error: 'Apprise URLs must be an array' },
            { status: 400 }
          );
        }
        
        // Basic URL validation
        for (const url of urls) {
          if (typeof url !== 'string' || url.trim() === '') {
            return NextResponse.json(
              { error: 'All Apprise URLs must be non-empty strings' },
              { status: 400 }
            );
          }
        }
      } catch (parseError) {
        return NextResponse.json(
          { error: 'Invalid JSON format for Apprise URLs' },
          { status: 400 }
        );
      }
    }

    // Path to the .env file
    const envPath = path.join(process.cwd(), '.env');
    
    // Read existing .env file
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }

    // Auto-sync settings to add/update
    const autoSyncSettings = {
      'AUTO_SYNC_ENABLED': settings.autoSyncEnabled ? 'true' : 'false',
      'SYNC_INTERVAL_TYPE': settings.syncIntervalType,
      'SYNC_INTERVAL_PREDEFINED': settings.syncIntervalPredefined || '',
      'SYNC_INTERVAL_CRON': settings.syncIntervalCron || '',
      'AUTO_DOWNLOAD_NEW': settings.autoDownloadNew ? 'true' : 'false',
      'AUTO_UPDATE_EXISTING': settings.autoUpdateExisting ? 'true' : 'false',
      'NOTIFICATION_ENABLED': settings.notificationEnabled ? 'true' : 'false',
      'APPRISE_URLS': Array.isArray(settings.appriseUrls) ? JSON.stringify(settings.appriseUrls) : (settings.appriseUrls || '[]'),
      'LAST_AUTO_SYNC': settings.lastAutoSync || ''
    };

    // Update or add each setting
    for (const [key, value] of Object.entries(autoSyncSettings)) {
      const regex = new RegExp(`^${key}=.*$`, 'm');
      const settingLine = `${key}="${value}"`;
      
      if (regex.test(envContent)) {
        // Replace existing setting
        envContent = envContent.replace(regex, settingLine);
      } else {
        // Add new setting
        envContent += (envContent.endsWith('\n') ? '' : '\n') + `${settingLine}\n`;
      }
    }

    // Write back to .env file
    fs.writeFileSync(envPath, envContent);

    return NextResponse.json({ 
      success: true, 
      message: 'Auto-sync settings saved successfully' 
    });
  } catch (error) {
    console.error('Error saving auto-sync settings:', error);
    return NextResponse.json(
      { error: 'Failed to save auto-sync settings' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // Path to the .env file
    const envPath = path.join(process.cwd(), '.env');
    
    if (!fs.existsSync(envPath)) {
      return NextResponse.json({ 
        settings: {
          autoSyncEnabled: false,
          syncIntervalType: 'predefined',
          syncIntervalPredefined: '1hour',
          syncIntervalCron: '',
          autoDownloadNew: false,
          autoUpdateExisting: false,
          notificationEnabled: false,
          appriseUrls: [],
          lastAutoSync: ''
        }
      });
    }

    // Read .env file and extract auto-sync settings
    const envContent = fs.readFileSync(envPath, 'utf8');
    
    const settings = {
      autoSyncEnabled: getEnvValue(envContent, 'AUTO_SYNC_ENABLED') === 'true',
      syncIntervalType: getEnvValue(envContent, 'SYNC_INTERVAL_TYPE') || 'predefined',
      syncIntervalPredefined: getEnvValue(envContent, 'SYNC_INTERVAL_PREDEFINED') || '1hour',
      syncIntervalCron: getEnvValue(envContent, 'SYNC_INTERVAL_CRON') || '',
      autoDownloadNew: getEnvValue(envContent, 'AUTO_DOWNLOAD_NEW') === 'true',
      autoUpdateExisting: getEnvValue(envContent, 'AUTO_UPDATE_EXISTING') === 'true',
      notificationEnabled: getEnvValue(envContent, 'NOTIFICATION_ENABLED') === 'true',
      appriseUrls: (() => {
        try {
          const urlsValue = getEnvValue(envContent, 'APPRISE_URLS') || '[]';
          return JSON.parse(urlsValue);
        } catch {
          return [];
        }
      })(),
      lastAutoSync: getEnvValue(envContent, 'LAST_AUTO_SYNC') || ''
    };
    
    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Error reading auto-sync settings:', error);
    return NextResponse.json(
      { error: 'Failed to read auto-sync settings' },
      { status: 500 }
    );
  }
}

// Helper function to handle test notification
async function handleTestNotification() {
  try {
    // Load current settings
    const envPath = path.join(process.cwd(), '.env');
    
    if (!fs.existsSync(envPath)) {
      return NextResponse.json(
        { error: 'No auto-sync settings found' },
        { status: 404 }
      );
    }

    const envContent = fs.readFileSync(envPath, 'utf8');
    const notificationEnabled = getEnvValue(envContent, 'NOTIFICATION_ENABLED') === 'true';
    const appriseUrls = (() => {
      try {
        const urlsValue = getEnvValue(envContent, 'APPRISE_URLS') || '[]';
        return JSON.parse(urlsValue);
      } catch {
        return [];
      }
    })();

    if (!notificationEnabled) {
      return NextResponse.json(
        { error: 'Notifications are not enabled' },
        { status: 400 }
      );
    }

    if (!appriseUrls || appriseUrls.length === 0) {
      return NextResponse.json(
        { error: 'No Apprise URLs configured' },
        { status: 400 }
      );
    }

    // Send test notification using the auto-sync service
    const { AutoSyncService } = await import('../../../../server/services/autoSyncService.js');
    const autoSyncService = new AutoSyncService();
    const result = await autoSyncService.testNotification();

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Test notification sent successfully'
      });
    } else {
      return NextResponse.json(
        { error: result.message },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error sending test notification:', error);
    return NextResponse.json(
      { error: 'Failed to send test notification' },
      { status: 500 }
    );
  }
}

// Helper function to handle manual sync trigger
async function handleManualSync() {
  try {
    // Load current settings
    const envPath = path.join(process.cwd(), '.env');
    
    if (!fs.existsSync(envPath)) {
      return NextResponse.json(
        { error: 'No auto-sync settings found' },
        { status: 404 }
      );
    }

    const envContent = fs.readFileSync(envPath, 'utf8');
    const autoSyncEnabled = getEnvValue(envContent, 'AUTO_SYNC_ENABLED') === 'true';

    if (!autoSyncEnabled) {
      return NextResponse.json(
        { error: 'Auto-sync is not enabled' },
        { status: 400 }
      );
    }

    // Trigger manual sync using the auto-sync service
    const { AutoSyncService } = await import('../../../../server/services/autoSyncService.js');
    const autoSyncService = new AutoSyncService();
    const result = await autoSyncService.executeAutoSync() as any;

    if (result && result.success) {
      return NextResponse.json({
        success: true,
        message: 'Manual sync completed successfully',
        result
      });
    } else {
      return NextResponse.json(
        { error: result.message },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error triggering manual sync:', error);
    return NextResponse.json(
      { error: 'Failed to trigger manual sync' },
      { status: 500 }
    );
  }
}

// Helper function to extract value from .env content
function getEnvValue(envContent: string, key: string): string {
  // Try to match the pattern with quotes around the value (handles nested quotes)
  const regex = new RegExp(`^${key}="(.+)"$`, 'm');
  let match = regex.exec(envContent);
  
  if (match && match[1]) {
    let value = match[1];
    // Remove extra quotes that might be around JSON values
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    return value;
  }
  
  // Try to match without quotes (fallback)
  const regexNoQuotes = new RegExp(`^${key}=([^\\s]*)$`, 'm');
  match = regexNoQuotes.exec(envContent);
  if (match && match[1]) {
    return match[1];
  }
  
  return '';
}
