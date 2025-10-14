'use client';

import { Button } from './ui/button';
import { StatusBadge } from './Badge';
import { getContrastColor } from '../../lib/colorUtils';

interface InstalledScript {
  id: number;
  script_name: string;
  script_path: string;
  container_id: string | null;
  server_id: number | null;
  server_name: string | null;
  server_ip: string | null;
  server_user: string | null;
  server_password: string | null;
  server_auth_type: string | null;
  server_ssh_key: string | null;
  server_ssh_key_passphrase: string | null;
  server_ssh_port: number | null;
  server_color: string | null;
  installation_date: string;
  status: 'in_progress' | 'success' | 'failed';
  output_log: string | null;
  execution_mode: 'local' | 'ssh';
  container_status?: 'running' | 'stopped' | 'unknown';
  web_ui_ip: string | null;
  web_ui_port: number | null;
}

interface ScriptInstallationCardProps {
  script: InstalledScript;
  isEditing: boolean;
  editFormData: { script_name: string; container_id: string; web_ui_ip: string; web_ui_port: string };
  onInputChange: (field: 'script_name' | 'container_id' | 'web_ui_ip' | 'web_ui_port', value: string) => void;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onUpdate: () => void;
  onShell: () => void;
  onDelete: () => void;
  isUpdating: boolean;
  isDeleting: boolean;
  // New container control props
  containerStatus?: 'running' | 'stopped' | 'unknown';
  onStartStop: (action: 'start' | 'stop') => void;
  onDestroy: () => void;
  isControlling: boolean;
  // Web UI props
  onOpenWebUI: () => void;
  onAutoDetectWebUI: () => void;
  isAutoDetecting: boolean;
}

export function ScriptInstallationCard({
  script,
  isEditing,
  editFormData,
  onInputChange,
  onEdit,
  onSave,
  onCancel,
  onUpdate,
  onShell,
  onDelete,
  isUpdating,
  isDeleting,
  containerStatus,
  onStartStop,
  onDestroy,
  isControlling,
  onOpenWebUI,
  onAutoDetectWebUI,
  isAutoDetecting
}: ScriptInstallationCardProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div 
      className="bg-card border border-border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
      style={{ borderLeft: `4px solid ${script.server_color ?? 'transparent'}` }}
    >
      {/* Header with Script Name and Status */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="space-y-2">
              <input
                type="text"
                value={editFormData.script_name}
                onChange={(e) => onInputChange('script_name', e.target.value)}
                className="w-full px-2 py-1 text-sm border border-border rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Script name"
              />
              <div className="text-xs text-muted-foreground">{script.script_path}</div>
            </div>
          ) : (
            <div>
              <div className="text-sm font-medium text-foreground truncate">{script.script_name}</div>
              <div className="text-xs text-muted-foreground truncate">{script.script_path}</div>
            </div>
          )}
        </div>
        <div className="ml-2 flex-shrink-0">
          <StatusBadge status={script.status}>
            {script.status.replace('_', ' ').toUpperCase()}
          </StatusBadge>
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 gap-3 mb-4">
        {/* Container ID */}
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-1">Container ID</div>
          {isEditing ? (
            <input
              type="text"
              value={editFormData.container_id}
              onChange={(e) => onInputChange('container_id', e.target.value)}
              className="w-full px-2 py-1 text-sm font-mono border border-border rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Container ID"
            />
          ) : (
            <div className="text-sm font-mono text-foreground break-all">
              {script.container_id ? (
                <div className="flex items-center space-x-2">
                  <span>{script.container_id}</span>
                  {script.container_status && (
                    <div className="flex items-center space-x-1">
                      <div className={`w-2 h-2 rounded-full ${
                        script.container_status === 'running' ? 'bg-green-500' : 
                        script.container_status === 'stopped' ? 'bg-red-500' : 
                        'bg-gray-400'
                      }`}></div>
                      <span className={`text-xs font-medium ${
                        script.container_status === 'running' ? 'text-green-700 dark:text-green-300' : 
                        script.container_status === 'stopped' ? 'text-red-700 dark:text-red-300' : 
                        'text-gray-500 dark:text-gray-400'
                      }`}>
                        {script.container_status === 'running' ? 'Running' : 
                         script.container_status === 'stopped' ? 'Stopped' : 
                         'Unknown'}
                      </span>
                    </div>
                  )}
                </div>
              ) : '-'}
            </div>
          )}
        </div>

        {/* Web UI */}
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-1">IP:PORT</div>
          {isEditing ? (
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={editFormData.web_ui_ip}
                onChange={(e) => onInputChange('web_ui_ip', e.target.value)}
                className="flex-1 px-2 py-1 text-sm font-mono border border-border rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="IP"
              />
              <span className="text-muted-foreground">:</span>
              <input
                type="number"
                value={editFormData.web_ui_port}
                onChange={(e) => onInputChange('web_ui_port', e.target.value)}
                className="w-20 px-2 py-1 text-sm font-mono border border-border rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Port"
              />
            </div>
          ) : (
            <div className="text-sm font-mono text-foreground">
              {script.web_ui_ip ? (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={onOpenWebUI}
                    disabled={containerStatus === 'stopped'}
                    className={`text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:underline ${
                      containerStatus === 'stopped' ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    {script.web_ui_ip}:{script.web_ui_port || 80}
                  </button>
                  {script.container_id && script.execution_mode === 'ssh' && (
                    <button
                      onClick={onAutoDetectWebUI}
                      disabled={isAutoDetecting}
                      className="text-xs px-2 py-1 bg-blue-900 hover:bg-blue-800 text-blue-300 border border-blue-700 rounded disabled:opacity-50 transition-colors"
                      title="Re-detect IP and port"
                    >
                      {isAutoDetecting ? '...' : 'Re-detect'}
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <span className="text-muted-foreground">-</span>
                  {script.container_id && script.execution_mode === 'ssh' && (
                    <button
                      onClick={onAutoDetectWebUI}
                      disabled={isAutoDetecting}
                      className="text-xs px-2 py-1 bg-blue-900 hover:bg-blue-800 text-blue-300 border border-blue-700 rounded disabled:opacity-50 transition-colors"
                      title="Re-detect IP and port"
                    >
                      {isAutoDetecting ? '...' : 'Re-detect'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Server */}
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-1">Server</div>
          <span 
            className="text-sm px-3 py-1 rounded inline-block"
            style={{
              backgroundColor: script.server_color ?? 'transparent',
              color: script.server_color ? getContrastColor(script.server_color) : 'inherit'
            }}
          >
            {script.server_name ?? '-'}
          </span>
        </div>

        {/* Installation Date */}
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-1">Installation Date</div>
          <div className="text-sm text-muted-foreground">
            {formatDate(String(script.installation_date))}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        {isEditing ? (
          <>
            <Button
              onClick={onSave}
              disabled={isUpdating}
              variant="save"
              size="sm"
              className="flex-1 min-w-0"
            >
              {isUpdating ? 'Saving...' : 'Save'}
            </Button>
            <Button
              onClick={onCancel}
              variant="cancel"
              size="sm"
              className="flex-1 min-w-0"
            >
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button
              onClick={onEdit}
              variant="edit"
              size="sm"
              className="flex-1 min-w-0"
            >
              Edit
            </Button>
            {script.container_id && (
              <Button
                onClick={onUpdate}
                variant="update"
                size="sm"
                className="flex-1 min-w-0"
                disabled={containerStatus === 'stopped'}
              >
                Update
              </Button>
            )}
            {/* Shell button - only show for SSH scripts with container_id */}
            {script.container_id && script.execution_mode === 'ssh' && (
              <Button
                onClick={onShell}
                variant="secondary"
                size="sm"
                className="flex-1 min-w-0"
                disabled={containerStatus === 'stopped'}
              >
                Shell
              </Button>
            )}
            {/* Open UI button - only show when web_ui_ip exists */}
            {script.web_ui_ip && (
              <Button
                onClick={onOpenWebUI}
                variant="openui"
                size="sm"
                disabled={containerStatus === 'stopped'}
                className="flex-1 min-w-0"
              >
                Open UI
              </Button>
            )}
            {/* Container Control Buttons - only show for SSH scripts with container_id */}
            {script.container_id && script.execution_mode === 'ssh' && (
              <>
                <Button
                  onClick={() => onStartStop(containerStatus === 'running' ? 'stop' : 'start')}
                  disabled={isControlling || containerStatus === 'unknown'}
                  variant={containerStatus === 'running' ? 'stop' : 'start'}
                  size="sm"
                  className="flex-1 min-w-0"
                >
                  {isControlling ? 'Working...' : containerStatus === 'running' ? 'Stop' : 'Start'}
                </Button>
                <Button
                  onClick={onDestroy}
                  disabled={isControlling}
                  variant="destructive"
                  size="sm"
                  className="flex-1 min-w-0"
                >
                  {isControlling ? 'Working...' : 'Destroy'}
                </Button>
              </>
            )}
            {/* Fallback to old Delete button for non-SSH scripts */}
            {(!script.container_id || script.execution_mode !== 'ssh') && (
              <Button
                onClick={onDelete}
                variant="delete"
                size="sm"
                disabled={isDeleting}
                className="flex-1 min-w-0"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
