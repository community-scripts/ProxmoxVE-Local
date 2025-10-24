import { AutoSyncService } from '~/server/services/autoSyncService';

let autoSyncService: AutoSyncService | null = null;

/**
 * Initialize auto-sync service and schedule cron job if enabled
 */
export function initializeAutoSync(): void {
  try {
    console.log('Initializing auto-sync service...');
    autoSyncService = new AutoSyncService();
    
    // Load settings and schedule if enabled
    const settings = autoSyncService.loadSettings();
    
    if (settings.autoSyncEnabled) {
      console.log('Auto-sync is enabled, scheduling cron job...');
      autoSyncService.scheduleAutoSync();
    } else {
      console.log('Auto-sync is disabled');
    }
    
    console.log('Auto-sync service initialized successfully');
  } catch (error) {
    console.error('Failed to initialize auto-sync service:', error);
  }
}

/**
 * Stop auto-sync service and clean up cron jobs
 */
export function stopAutoSync(): void {
  try {
    if (autoSyncService) {
      console.log('Stopping auto-sync service...');
      autoSyncService.stopAutoSync();
      autoSyncService = null;
      console.log('Auto-sync service stopped');
    }
  } catch (error) {
    console.error('Error stopping auto-sync service:', error);
  }
}

/**
 * Get the auto-sync service instance
 */
export function getAutoSyncService(): AutoSyncService | null {
  return autoSyncService;
}

/**
 * Set the auto-sync service instance (for external management)
 */
export function setAutoSyncService(service: AutoSyncService | null): void {
  autoSyncService = service;
}

/**
 * Graceful shutdown handler
 */
export function setupGracefulShutdown(): void {
  const shutdown = (signal: string) => {
    console.log(`Received ${signal}, shutting down gracefully...`);
    stopAutoSync();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGUSR2', () => shutdown('SIGUSR2')); // For nodemon
}
