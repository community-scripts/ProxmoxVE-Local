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
  server_color: string | null;
  installation_date: string;
  status: 'in_progress' | 'success' | 'failed';
  output_log: string | null;
}

interface ScriptInstallationCardProps {
  script: InstalledScript;
  isEditing: boolean;
  editFormData: { script_name: string; container_id: string };
  onInputChange: (field: 'script_name' | 'container_id', value: string) => void;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onUpdate: () => void;
  onDelete: () => void;
  isUpdating: boolean;
  isDeleting: boolean;
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
  onDelete,
  isUpdating,
  isDeleting
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
              {script.container_id ?? '-'}
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
              variant="outline"
              size="sm"
              className="flex-1 min-w-0 bg-green-900/20 hover:bg-green-900/30 border-green-700/50 text-green-300 hover:text-green-200 hover:border-green-600/60 transition-all duration-200 hover:scale-105 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {isUpdating ? 'Saving...' : 'Save'}
            </Button>
            <Button
              onClick={onCancel}
              variant="outline"
              size="sm"
              className="flex-1 min-w-0 bg-gray-800/20 hover:bg-gray-800/30 border-gray-600/50 text-gray-300 hover:text-gray-200 hover:border-gray-500/60 transition-all duration-200 hover:scale-105 hover:shadow-md"
            >
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button
              onClick={onEdit}
              variant="outline"
              size="sm"
              className="flex-1 min-w-0 bg-blue-900/20 hover:bg-blue-900/30 border-blue-700/50 text-blue-300 hover:text-blue-200 hover:border-blue-600/60 transition-all duration-200 hover:scale-105 hover:shadow-md"
            >
              Edit
            </Button>
            {script.container_id && (
              <Button
                onClick={onUpdate}
                variant="outline"
                size="sm"
                className="flex-1 min-w-0 bg-cyan-900/20 hover:bg-cyan-900/30 border-cyan-700/50 text-cyan-300 hover:text-cyan-200 hover:border-cyan-600/60 transition-all duration-200 hover:scale-105 hover:shadow-md"
              >
                Update
              </Button>
            )}
            <Button
              onClick={onDelete}
              variant="outline"
              size="sm"
              disabled={isDeleting}
              className="flex-1 min-w-0 bg-red-900/20 hover:bg-red-900/30 border-red-700/50 text-red-300 hover:text-red-200 hover:border-red-600/60 transition-all duration-200 hover:scale-105 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
