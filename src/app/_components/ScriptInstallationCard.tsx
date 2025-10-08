'use client';

import { Button } from './ui/button';
import { StatusBadge } from './Badge';

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
    <div className="bg-card border border-border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
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
              {script.container_id || '-'}
            </div>
          )}
        </div>

        {/* Server */}
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-1">Server</div>
          <div className="text-sm text-muted-foreground">
            {script.server_name ?? 'Local'}
          </div>
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
              variant="default"
              size="sm"
              className="flex-1 min-w-0"
            >
              {isUpdating ? 'Saving...' : 'Save'}
            </Button>
            <Button
              onClick={onCancel}
              variant="outline"
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
              variant="default"
              size="sm"
              className="flex-1 min-w-0"
            >
              Edit
            </Button>
            {script.container_id && (
              <Button
                onClick={onUpdate}
                variant="link"
                size="sm"
                className="flex-1 min-w-0"
              >
                Update
              </Button>
            )}
            <Button
              onClick={onDelete}
              variant="destructive"
              size="sm"
              disabled={isDeleting}
              className="flex-1 min-w-0"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
