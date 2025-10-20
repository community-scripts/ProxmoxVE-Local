import type { NestedMessages } from './types';

export const enMessages: NestedMessages = {
  common: {
    language: {
      english: 'English',
      german: 'German',
      switch: 'Switch language',
    },
    actions: {
      cancel: 'Cancel',
      close: 'Close',
      confirm: 'Confirm',
      save: 'Save',
      delete: 'Delete',
      edit: 'Edit',
      reset: 'Reset',
      search: 'Search',
      retry: 'Retry',
      install: 'Install',
      update: 'Update',
      download: 'Download',
      details: 'Details',
    },
    status: {
      loading: 'Loading...',
      success: 'Success',
      error: 'An error occurred',
      empty: 'No data available',
    },
  },
  confirmationModal: {
    typeToConfirm: 'Type {text} to confirm:',
    placeholder: 'Type "{text}" here',
  },
  errorModal: {
    detailsLabel: 'Details:',
    errorDetailsLabel: 'Error Details:',
  },
  versionDisplay: {
    loading: 'Loading...',
    unknownVersion: 'Unknown',
    unableToCheck: '(Unable to check for updates)',
    upToDate: '✓ Up to date',
    releaseNotes: 'Release Notes:',
    helpTooltip: 'Help with updates',
    update: {
      updateNow: 'Update Now',
      updateNowShort: 'Update',
      updating: 'Updating...',
      updatingShort: '...',
    },
    loadingOverlay: {
      serverRestarting: 'Server Restarting',
      updatingApplication: 'Updating Application',
      serverRestartingMessage: 'The server is restarting after the update...',
      updatingMessage: 'Please stand by while we update your application...',
      serverRestartingNote: 'This may take a few moments. The page will reload automatically.',
      updatingNote: 'The server will restart automatically when complete.',
      updateStarted: 'Update started...',
      updateComplete: 'Update complete! Server restarting...',
      serverRestarting2: 'Server restarting... waiting for reconnection...',
      reconnecting: 'Attempting to reconnect...',
      serverBackOnline: 'Server is back online! Reloading...',
    },
  },
  layout: {
    title: 'PVE Scripts Management',
    tagline: 'Manage and execute Proxmox helper scripts locally with live output streaming',
    releaseNotes: 'Release Notes',
    tabs: {
      available: 'Available Scripts',
      availableShort: 'Available',
      downloaded: 'Downloaded Scripts',
      downloadedShort: 'Downloaded',
      installed: 'Installed Scripts',
      installedShort: 'Installed',
    },
    help: {
      availableTooltip: 'Help with Available Scripts',
      downloadedTooltip: 'Help with Downloaded Scripts',
      installedTooltip: 'Help with Installed Scripts',
    },
  },
  footer: {
    copyright: '© {year} PVE Scripts Local',
    github: 'GitHub',
    releaseNotes: 'Release Notes',
  },
  filterBar: {
    loading: 'Loading saved filters...',
    header: 'Filter Scripts',
    helpTooltip: 'Help with filtering and searching',
    search: {
      placeholder: 'Search scripts...'
    },
    updatable: {
      all: 'Updatable: All',
      yes: 'Updatable: Yes ({count})',
      no: 'Updatable: No'
    },
    types: {
      all: 'All Types',
      multiple: '{count} Types',
      options: {
        ct: 'LXC Container',
        vm: 'Virtual Machine',
        addon: 'Add-on',
        pve: 'PVE Host'
      }
    },
    actions: {
      clearAllTypes: 'Clear all',
      clearFilters: 'Clear all filters'
    },
    sort: {
      byName: 'By Name',
      byCreated: 'By Created Date',
      oldestFirst: 'Oldest First',
      newestFirst: 'Newest First',
      aToZ: 'A-Z',
      zToA: 'Z-A'
    },
    summary: {
      showingAll: 'Showing all {count} scripts',
      showingFiltered: '{filtered} of {total} scripts',
      filteredSuffix: '(filtered)'
    },
    persistence: {
      enabled: 'Filters are being saved automatically'
    }
  },
  categorySidebar: {
    headerTitle: 'Categories',
    totalScripts: '{count} total scripts',
    helpTooltip: 'Help with categories',
    actions: {
      collapse: 'Collapse categories',
      expand: 'Expand categories',
    },
    all: {
      label: 'All Categories',
      tooltip: 'All Categories ({count})',
    },
    tooltips: {
      category: '{category} ({count})',
    },
    categories: {
      'Proxmox & Virtualization': 'Proxmox & Virtualization',
      'Operating Systems': 'Operating Systems',
      'Containers & Docker': 'Containers & Docker',
      'Network & Firewall': 'Network & Firewall',
      'Adblock & DNS': 'Adblock & DNS',
      'Authentication & Security': 'Authentication & Security',
  'Backup & Recovery': 'Backup & Recovery',
  'Databases': 'Databases',
      'Monitoring & Analytics': 'Monitoring & Analytics',
      'Dashboards & Frontends': 'Dashboards & Frontends',
      'Files & Downloads': 'Files & Downloads',
      'Documents & Notes': 'Documents & Notes',
      'Media & Streaming': 'Media & Streaming',
      '*Arr Suite': '*Arr Suite',
      'NVR & Cameras': 'NVR & Cameras',
      'IoT & Smart Home': 'IoT & Smart Home',
      'ZigBee, Z-Wave & Matter': 'ZigBee, Z-Wave & Matter',
      'MQTT & Messaging': 'MQTT & Messaging',
      'Automation & Scheduling': 'Automation & Scheduling',
      'AI / Coding & Dev-Tools': 'AI / Coding & Dev-Tools',
      'Webservers & Proxies': 'Webservers & Proxies',
      'Bots & ChatOps': 'Bots & ChatOps',
      'Finance & Budgeting': 'Finance & Budgeting',
      'Gaming & Leisure': 'Gaming & Leisure',
      'Business & ERP': 'Business & ERP',
      'Miscellaneous': 'Miscellaneous',
    },
  },
  settings: {
    title: 'Settings',
    close: 'Close',
    help: 'Help with General Settings',
    tabs: {
      general: 'General',
      github: 'GitHub',
      auth: 'Authentication',
    },
    general: {
      title: 'General Settings',
      description: 'Configure general application preferences and behavior.',
      sections: {
        theme: {
          title: 'Theme',
          description: 'Choose your preferred color theme for the application.',
          current: 'Current Theme',
          lightLabel: 'Light mode',
          darkLabel: 'Dark mode',
          actions: {
            light: 'Light',
            dark: 'Dark',
          },
        },
        language: {
          title: 'Language',
          description: 'Choose your preferred display language.',
          current: 'Current Language',
          actions: {
            english: 'English',
            german: 'German',
          },
        },
        filters: {
          title: 'Save Filters',
          description: 'Save your configured script filters.',
          toggleLabel: 'Enable filter saving',
          savedTitle: 'Saved Filters',
          savedActive: 'Filters are currently saved',
          savedEmpty: 'No filters saved yet',
          details: {
            search: 'Search: {value}',
            types: 'Types: {count} selected',
            sort: 'Sort: {field} ({order})',
            none: 'None',
          },
          actions: {
            clear: 'Clear',
          },
        },
        colorCoding: {
          title: 'Server Color Coding',
          description: 'Enable color coding for servers to visually distinguish them throughout the application.',
          toggleLabel: 'Enable server color coding',
        },
      },
    },
    github: {
      title: 'GitHub Integration',
      description: 'Configure GitHub integration for script management and updates.',
      sections: {
        token: {
          title: 'GitHub Personal Access Token',
          description: 'Save a GitHub Personal Access Token to circumvent GitHub API rate limits.',
          tokenLabel: 'Token',
          placeholder: 'Enter your GitHub Personal Access Token',
          actions: {
            save: 'Save Token',
            saving: 'Saving...',
            refresh: 'Refresh',
            loading: 'Loading...',
          },
        },
      },
    },
    auth: {
      title: 'Authentication Settings',
      description: 'Configure authentication to secure access to your application.',
      sections: {
        status: {
          title: 'Authentication Status',
          enabledWithCredentials: 'Authentication is {status}. Current username: {username}',
          enabledWithoutCredentials: 'Authentication is {status}. No credentials configured.',
          notSetup: 'Authentication setup has not been completed yet.',
          enabled: 'enabled',
          disabled: 'disabled',
          toggleLabel: 'Enable Authentication',
          toggleEnabled: 'Authentication is required on every page load',
          toggleDisabled: 'Authentication is optional',
        },
        credentials: {
          title: 'Update Credentials',
          description: 'Change your username and password for authentication.',
          usernameLabel: 'Username',
          usernamePlaceholder: 'Enter username',
          passwordLabel: 'New Password',
          passwordPlaceholder: 'Enter new password',
          confirmPasswordLabel: 'Confirm Password',
          confirmPasswordPlaceholder: 'Confirm new password',
          actions: {
            update: 'Update Credentials',
            updating: 'Saving...',
            refresh: 'Refresh',
            loading: 'Loading...',
          },
        },
      },
    },
    messages: {
      filterSettingSaved: 'Save filter setting updated!',
      filterSettingError: 'Failed to save setting',
      clearFiltersSuccess: 'Saved filters cleared!',
      clearFiltersError: 'Failed to clear filters',
      colorCodingSuccess: 'Color coding setting saved successfully',
      colorCodingError: 'Failed to save color coding setting',
      githubTokenSuccess: 'GitHub token saved successfully!',
      githubTokenError: 'Failed to save token',
      authCredentialsSuccess: 'Authentication credentials updated successfully!',
      authCredentialsError: 'Failed to save credentials',
      authStatusSuccess: 'Authentication {status} successfully!',
      authStatusError: 'Failed to update auth status',
      passwordMismatch: 'Passwords do not match',
    },
  },
  loadingModal: {
    processing: 'Processing',
    pleaseWait: 'Please wait...',
  },
  authModal: {
    title: 'Authentication Required',
    description: 'Please enter your credentials to access the application.',
    username: {
      label: 'Username',
      placeholder: 'Enter your username',
    },
    password: {
      label: 'Password',
      placeholder: 'Enter your password',
    },
    error: 'Invalid username or password',
    actions: {
      signIn: 'Sign In',
      signingIn: 'Signing In...',
    },
  },
  setupModal: {
    title: 'Setup Authentication',
    description: 'Set up authentication to secure your application. This will be required for future access.',
    username: {
      label: 'Username',
      placeholder: 'Choose a username',
    },
    password: {
      label: 'Password',
      placeholder: 'Choose a password',
    },
    confirmPassword: {
      label: 'Confirm Password',
      placeholder: 'Confirm your password',
    },
    enableAuth: {
      title: 'Enable Authentication',
      descriptionEnabled: 'Authentication will be required on every page load',
      descriptionDisabled: 'Authentication will be optional (can be enabled later in settings)',
      label: 'Enable authentication',
    },
    errors: {
      passwordMismatch: 'Passwords do not match',
      setupFailed: 'Failed to setup authentication',
    },
    actions: {
      completeSetup: 'Complete Setup',
      settingUp: 'Setting Up...',
    },
  },
};
