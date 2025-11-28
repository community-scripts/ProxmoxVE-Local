import { AutoSyncService } from '../services/autoSyncService.js';
import { repositoryService } from '../services/repositoryService.js';

/** @type {AutoSyncService | null} */
let autoSyncService = null;
let isInitialized = false;

/**
 * Initialize default repositories
 * @returns {Promise<void>}
 */
export async function initializeRepositories() {
  try {
    console.log('Initializing default repositories...');
    await repositoryService.initializeDefaultRepositories();
    console.log('Default repositories initialized successfully');
  } catch (error) {
    console.error('Failed to initialize repositories:', error);
    console.error('Error stack:', error.stack);
  }
}

/**
 * Initialize auto-sync service and schedule cron job if enabled
 */
export function initializeAutoSync() {
  if (isInitialized) {
    console.log('Auto-sync service already initialized, skipping...');
    return;
  }
  
  try {
    console.log('Initializing auto-sync service...');
    autoSyncService = new AutoSyncService();
    isInitialized = true;
    console.log('AutoSyncService instance created');
    
    // Load settings and schedule if enabled
    const settings = autoSyncService.loadSettings();
    console.log('Settings loaded:', settings);
    
    if (settings.autoSyncEnabled) {
      console.log('Auto-sync is enabled, scheduling cron job...');
      autoSyncService.scheduleAutoSync();
      console.log('Cron job scheduled');
    } else {
      console.log('Auto-sync is disabled');
    }
    
    console.log('Auto-sync service initialized successfully');
  } catch (error) {
    console.error('Failed to initialize auto-sync service:', error);
    console.error('Error stack:', error.stack);
  }
}

/**
 * Stop auto-sync service and clean up cron jobs
 */
export function stopAutoSync() {
  try {
    if (autoSyncService) {
      console.log('Stopping auto-sync service...');
      autoSyncService.stopAutoSync();
      autoSyncService = null;
      isInitialized = false;
      console.log('Auto-sync service stopped');
    }
  } catch (error) {
    console.error('Error stopping auto-sync service:', error);
  }
}

/**
 * Get the auto-sync service instance
 */
export function getAutoSyncService() {
  return autoSyncService;
}

/**
 * Set the auto-sync service instance (for external management)
 */
export function setAutoSyncService(service) {
  autoSyncService = service;
}

/**
 * Graceful shutdown handler
 */
export function setupGracefulShutdown() {
  const shutdown = (signal) => {
    console.log(`Received ${signal}, shutting down gracefully...`);
    stopAutoSync();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGUSR2', () => shutdown('SIGUSR2')); // For nodemon
}
