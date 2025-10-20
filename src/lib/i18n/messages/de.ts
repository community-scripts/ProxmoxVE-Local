import type { NestedMessages } from './types';

export const deMessages: NestedMessages = {
  common: {
    language: {
      english: 'Englisch',
      german: 'Deutsch',
      switch: 'Sprache wechseln',
    },
    actions: {
      cancel: 'Abbrechen',
      close: 'Schließen',
      confirm: 'Bestätigen',
      save: 'Speichern',
      delete: 'Löschen',
      edit: 'Bearbeiten',
      reset: 'Zurücksetzen',
      search: 'Suchen',
      retry: 'Erneut versuchen',
      install: 'Installieren',
      update: 'Aktualisieren',
      download: 'Herunterladen',
      details: 'Details',
    },
    status: {
      loading: 'Lädt ...',
      success: 'Erfolg',
      error: 'Ein Fehler ist aufgetreten',
      empty: 'Keine Daten verfügbar',
    },
  },
  confirmationModal: {
    typeToConfirm: 'Tippe {text} um zu bestätigen:',
    placeholder: 'Tippe "{text}" hier ein',
  },
  errorModal: {
    detailsLabel: 'Details:',
    errorDetailsLabel: 'Fehlerdetails:',
  },
  layout: {
    title: 'PVE Skriptverwaltung',
    tagline: 'Verwalte und starte lokale Proxmox-Hilfsskripte mit Live-Ausgabe',
    releaseNotes: 'Versionshinweise',
    tabs: {
      available: 'Verfügbare Skripte',
      availableShort: 'Verfügbar',
      downloaded: 'Heruntergeladene Skripte',
      downloadedShort: 'Downloads',
      installed: 'Installierte Skripte',
      installedShort: 'Installiert',
    },
    help: {
      availableTooltip: 'Hilfe zu Verfügbaren Skripten',
      downloadedTooltip: 'Hilfe zu heruntergeladenen Skripten',
      installedTooltip: 'Hilfe zu installierten Skripten',
    },
  },
  footer: {
    copyright: '© {year} PVE Scripts Local',
    github: 'GitHub',
    releaseNotes: 'Versionshinweise',
  },
  filterBar: {
    loading: 'Gespeicherte Filter werden geladen...',
    header: 'Skripte filtern',
    helpTooltip: 'Hilfe zum Filtern und Suchen',
    search: {
      placeholder: 'Skripte durchsuchen...'
    },
    updatable: {
      all: 'Aktualisierbar: Alle',
      yes: 'Aktualisierbar: Ja ({count})',
      no: 'Aktualisierbar: Nein'
    },
    types: {
      all: 'Alle Typen',
      multiple: '{count} Typen',
      options: {
        ct: 'LXC-Container',
        vm: 'Virtuelle Maschine',
        addon: 'Add-on',
        pve: 'PVE-Host'
      }
    },
    actions: {
      clearAllTypes: 'Alle löschen',
      clearFilters: 'Alle Filter löschen'
    },
    sort: {
      byName: 'Nach Name',
      byCreated: 'Nach Erstelldatum',
      oldestFirst: 'Älteste zuerst',
      newestFirst: 'Neueste zuerst',
      aToZ: 'A-Z',
      zToA: 'Z-A'
    },
    summary: {
      showingAll: 'Alle {count} Skripte werden angezeigt',
      showingFiltered: '{filtered} von {total} Skripten',
      filteredSuffix: '(gefiltert)'
    },
    persistence: {
      enabled: 'Filter werden automatisch gespeichert'
    }
  },
  categorySidebar: {
    headerTitle: 'Kategorien',
    totalScripts: '{count} Skripte insgesamt',
    helpTooltip: 'Hilfe zu Kategorien',
    actions: {
      collapse: 'Kategorien einklappen',
      expand: 'Kategorien ausklappen',
    },
    all: {
      label: 'Alle Kategorien',
      tooltip: 'Alle Kategorien ({count})',
    },
    tooltips: {
      category: '{category} ({count})',
    },
    categories: {
      'Proxmox & Virtualization': 'Proxmox & Virtualisierung',
      'Operating Systems': 'Betriebssysteme',
      'Containers & Docker': 'Container & Docker',
      'Network & Firewall': 'Netzwerk & Firewall',
      'Adblock & DNS': 'Adblock & DNS',
      'Authentication & Security': 'Authentifizierung & Sicherheit',
      'Backup & Recovery': 'Backup & Wiederherstellung',
      'Databases': 'Datenbanken',
      'Monitoring & Analytics': 'Monitoring & Analysen',
      'Dashboards & Frontends': 'Dashboards & Frontends',
      'Files & Downloads': 'Dateien & Downloads',
      'Documents & Notes': 'Dokumente & Notizen',
      'Media & Streaming': 'Medien & Streaming',
      '*Arr Suite': '*Arr Suite',
      'NVR & Cameras': 'NVR & Kameras',
      'IoT & Smart Home': 'IoT & Smart Home',
      'ZigBee, Z-Wave & Matter': 'ZigBee, Z-Wave & Matter',
      'MQTT & Messaging': 'MQTT & Messaging',
      'Automation & Scheduling': 'Automatisierung & Planung',
      'AI / Coding & Dev-Tools': 'KI / Coding & Dev-Tools',
      'Webservers & Proxies': 'Webserver & Proxys',
      'Bots & ChatOps': 'Bots & ChatOps',
      'Finance & Budgeting': 'Finanzen & Budgetierung',
      'Gaming & Leisure': 'Gaming & Freizeit',
      'Business & ERP': 'Business & ERP',
      'Miscellaneous': 'Verschiedenes',
    },
  },
  settings: {
    title: 'Einstellungen',
    close: 'Schließen',
    help: 'Hilfe zu den Einstellungen',
    tabs: {
      general: 'Allgemein',
      github: 'GitHub',
      auth: 'Authentifizierung',
    },
    general: {
      title: 'Allgemeine Einstellungen',
      description: 'Konfiguriere allgemeine Anwendungspräferenzen und Verhalten.',
      sections: {
        theme: {
          title: 'Design',
          description: 'Wähle dein bevorzugtes Farbdesign für die Anwendung.',
          current: 'Aktuelles Design',
          lightLabel: 'Hell',
          darkLabel: 'Dunkel',
          actions: {
            light: 'Hell',
            dark: 'Dunkel',
          },
        },
        language: {
          title: 'Sprache',
          description: 'Wähle deine bevorzugte Anzeigesprache.',
          current: 'Aktuelle Sprache',
          actions: {
            english: 'Englisch',
            german: 'Deutsch',
          },
        },
        filters: {
          title: 'Filter speichern',
          description: 'Speichere deine konfigurierten Skriptfilter.',
          toggleLabel: 'Filterspeicherung aktivieren',
          savedTitle: 'Gespeicherte Filter',
          savedActive: 'Filter sind derzeit gespeichert',
          savedEmpty: 'Noch keine Filter gespeichert',
          details: {
            search: 'Suche: {value}',
            types: 'Typen: {count} ausgewählt',
            sort: 'Sortierung: {field} ({order})',
            none: 'Keine',
          },
          actions: {
            clear: 'Löschen',
          },
        },
        colorCoding: {
          title: 'Server-Farbcodierung',
          description: 'Aktiviere die Farbcodierung für Server, um sie in der Anwendung visuell zu unterscheiden.',
          toggleLabel: 'Server-Farbcodierung aktivieren',
        },
      },
    },
    github: {
      title: 'GitHub-Integration',
      description: 'Konfiguriere die GitHub-Integration für Skriptverwaltung und Updates.',
      sections: {
        token: {
          title: 'Persönliches GitHub-Zugriffstoken',
          description: 'Speichere ein GitHub Personal Access Token, um GitHub API-Ratenbeschränkungen zu umgehen.',
          tokenLabel: 'Token',
          placeholder: 'Gib dein GitHub Personal Access Token ein',
          actions: {
            save: 'Token speichern',
            saving: 'Speichern...',
            refresh: 'Aktualisieren',
            loading: 'Lädt...',
          },
        },
      },
    },
    auth: {
      title: 'Authentifizierungseinstellungen',
      description: 'Konfiguriere die Authentifizierung, um den Zugriff auf deine Anwendung zu sichern.',
      sections: {
        status: {
          title: 'Authentifizierungsstatus',
          enabledWithCredentials: 'Authentifizierung ist {status}. Aktueller Benutzername: {username}',
          enabledWithoutCredentials: 'Authentifizierung ist {status}. Keine Anmeldedaten konfiguriert.',
          notSetup: 'Authentifizierung wurde noch nicht eingerichtet.',
          enabled: 'aktiviert',
          disabled: 'deaktiviert',
          toggleLabel: 'Authentifizierung aktivieren',
          toggleEnabled: 'Authentifizierung ist bei jedem Seitenladen erforderlich',
          toggleDisabled: 'Authentifizierung ist optional',
        },
        credentials: {
          title: 'Anmeldedaten aktualisieren',
          description: 'Ändere deinen Benutzernamen und dein Passwort für die Authentifizierung.',
          usernameLabel: 'Benutzername',
          usernamePlaceholder: 'Benutzername eingeben',
          passwordLabel: 'Neues Passwort',
          passwordPlaceholder: 'Neues Passwort eingeben',
          confirmPasswordLabel: 'Passwort bestätigen',
          confirmPasswordPlaceholder: 'Neues Passwort bestätigen',
          actions: {
            update: 'Anmeldedaten aktualisieren',
            updating: 'Speichern...',
            refresh: 'Aktualisieren',
            loading: 'Lädt...',
          },
        },
      },
    },
    messages: {
      filterSettingSaved: 'Filterspeicherungseinstellung aktualisiert!',
      filterSettingError: 'Fehler beim Speichern der Einstellung',
      clearFiltersSuccess: 'Gespeicherte Filter gelöscht!',
      clearFiltersError: 'Fehler beim Löschen der Filter',
      colorCodingSuccess: 'Farbcodierungseinstellung erfolgreich gespeichert',
      colorCodingError: 'Fehler beim Speichern der Farbcodierungseinstellung',
      githubTokenSuccess: 'GitHub-Token erfolgreich gespeichert!',
      githubTokenError: 'Fehler beim Speichern des Tokens',
      authCredentialsSuccess: 'Authentifizierungsanmeldedaten erfolgreich aktualisiert!',
      authCredentialsError: 'Fehler beim Speichern der Anmeldedaten',
      authStatusSuccess: 'Authentifizierung erfolgreich {status}!',
      authStatusError: 'Fehler beim Aktualisieren des Authentifizierungsstatus',
      passwordMismatch: 'Passwörter stimmen nicht überein',
    },
  },
};
