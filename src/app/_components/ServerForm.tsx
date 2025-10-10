'use client';

import { useState } from 'react';
import type { CreateServerData } from '../../types/server';
import { Button } from './ui/button';
import { SSHKeyInput } from './SSHKeyInput';

interface ServerFormProps {
  onSubmit: (data: CreateServerData) => void;
  initialData?: CreateServerData;
  isEditing?: boolean;
  onCancel?: () => void;
}

export function ServerForm({ onSubmit, initialData, isEditing = false, onCancel }: ServerFormProps) {
  const [formData, setFormData] = useState<CreateServerData>(
    initialData ?? {
      name: '',
      ip: '',
      user: '',
      password: '',
      auth_type: 'password',
      ssh_key: '',
      ssh_key_passphrase: '',
      ssh_port: 22,
    }
  );

  const [errors, setErrors] = useState<Partial<CreateServerData>>({});
  const [sshKeyError, setSshKeyError] = useState<string>('');

  const validateForm = (): boolean => {
    const newErrors: Partial<CreateServerData> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Server name is required';
    }

    if (!formData.ip.trim()) {
      newErrors.ip = 'IP address is required';
    } else {
      // Basic IP validation
      const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
      if (!ipRegex.test(formData.ip)) {
        newErrors.ip = 'Please enter a valid IP address';
      }
    }

    if (!formData.user.trim()) {
      newErrors.user = 'Username is required';
    }

    // Validate SSH port
    if (formData.ssh_port !== undefined && (formData.ssh_port < 1 || formData.ssh_port > 65535)) {
      newErrors.ssh_port = 'SSH port must be between 1 and 65535';
    }

    // Validate authentication based on auth_type
    const authType = formData.auth_type || 'password';
    
    if (authType === 'password' || authType === 'both') {
      if (!formData.password?.trim()) {
        newErrors.password = 'Password is required for password authentication';
      }
    }
    
    if (authType === 'key' || authType === 'both') {
      if (!formData.ssh_key?.trim()) {
        newErrors.ssh_key = 'SSH key is required for key authentication';
      }
    }

    // Check if at least one authentication method is provided
    if (authType === 'both') {
      if (!formData.password?.trim() && !formData.ssh_key?.trim()) {
        newErrors.password = 'At least one authentication method (password or SSH key) is required';
        newErrors.ssh_key = 'At least one authentication method (password or SSH key) is required';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0 && !sshKeyError;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit(formData);
      if (!isEditing) {
        setFormData({ 
          name: '', 
          ip: '', 
          user: '', 
          password: '', 
          auth_type: 'password',
          ssh_key: '',
          ssh_key_passphrase: '',
          ssh_port: 22
        });
      }
    }
  };

  const handleChange = (field: keyof CreateServerData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSSHKeyChange = (value: string) => {
    setFormData(prev => ({ ...prev, ssh_key: value }));
    if (errors.ssh_key) {
      setErrors(prev => ({ ...prev, ssh_key: undefined }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-muted-foreground mb-1">
            Server Name *
          </label>
          <input
            type="text"
            id="name"
            value={formData.name}
            onChange={handleChange('name')}
            className={`w-full px-3 py-2 border rounded-md shadow-sm bg-card text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring ${
              errors.name ? 'border-destructive' : 'border-border'
            }`}
            placeholder="e.g., Production Server"
          />
          {errors.name && <p className="mt-1 text-sm text-destructive">{errors.name}</p>}
        </div>

        <div>
          <label htmlFor="ip" className="block text-sm font-medium text-muted-foreground mb-1">
            IP Address *
          </label>
          <input
            type="text"
            id="ip"
            value={formData.ip}
            onChange={handleChange('ip')}
            className={`w-full px-3 py-2 border rounded-md shadow-sm bg-card text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring ${
              errors.ip ? 'border-destructive' : 'border-border'
            }`}
            placeholder="e.g., 192.168.1.100"
          />
          {errors.ip && <p className="mt-1 text-sm text-destructive">{errors.ip}</p>}
        </div>

        <div>
          <label htmlFor="user" className="block text-sm font-medium text-muted-foreground mb-1">
            Username *
          </label>
          <input
            type="text"
            id="user"
            value={formData.user}
            onChange={handleChange('user')}
            className={`w-full px-3 py-2 border rounded-md shadow-sm bg-card text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring ${
              errors.user ? 'border-destructive' : 'border-border'
            }`}
            placeholder="e.g., root"
          />
          {errors.user && <p className="mt-1 text-sm text-destructive">{errors.user}</p>}
        </div>

        <div>
          <label htmlFor="ssh_port" className="block text-sm font-medium text-muted-foreground mb-1">
            SSH Port
          </label>
          <input
            type="number"
            id="ssh_port"
            value={formData.ssh_port || 22}
            onChange={handleChange('ssh_port')}
            className={`w-full px-3 py-2 border rounded-md shadow-sm bg-card text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring ${
              errors.ssh_port ? 'border-destructive' : 'border-border'
            }`}
            placeholder="22"
            min="1"
            max="65535"
          />
          {errors.ssh_port && <p className="mt-1 text-sm text-destructive">{errors.ssh_port}</p>}
        </div>

        <div>
          <label htmlFor="auth_type" className="block text-sm font-medium text-muted-foreground mb-1">
            Authentication Type *
          </label>
          <select
            id="auth_type"
            value={formData.auth_type || 'password'}
            onChange={handleChange('auth_type')}
            className="w-full px-3 py-2 border rounded-md shadow-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring border-border"
          >
            <option value="password">Password Only</option>
            <option value="key">SSH Key Only</option>
            <option value="both">Both Password & SSH Key</option>
          </select>
        </div>
      </div>

      {/* Password Authentication */}
      {(formData.auth_type === 'password' || formData.auth_type === 'both') && (
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-muted-foreground mb-1">
            Password {formData.auth_type === 'both' ? '(Optional)' : '*'}
          </label>
          <input
            type="password"
            id="password"
            value={formData.password || ''}
            onChange={handleChange('password')}
            className={`w-full px-3 py-2 border rounded-md shadow-sm bg-card text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring ${
              errors.password ? 'border-destructive' : 'border-border'
            }`}
            placeholder="Enter password"
          />
          {errors.password && <p className="mt-1 text-sm text-destructive">{errors.password}</p>}
        </div>
      )}

      {/* SSH Key Authentication */}
      {(formData.auth_type === 'key' || formData.auth_type === 'both') && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              SSH Private Key {formData.auth_type === 'both' ? '(Optional)' : '*'}
            </label>
            <SSHKeyInput
              value={formData.ssh_key || ''}
              onChange={handleSSHKeyChange}
              onError={setSshKeyError}
            />
            {errors.ssh_key && <p className="mt-1 text-sm text-destructive">{errors.ssh_key}</p>}
            {sshKeyError && <p className="mt-1 text-sm text-destructive">{sshKeyError}</p>}
          </div>

          <div>
            <label htmlFor="ssh_key_passphrase" className="block text-sm font-medium text-muted-foreground mb-1">
              SSH Key Passphrase (Optional)
            </label>
            <input
              type="password"
              id="ssh_key_passphrase"
              value={formData.ssh_key_passphrase || ''}
              onChange={handleChange('ssh_key_passphrase')}
              className="w-full px-3 py-2 border rounded-md shadow-sm bg-card text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring border-border"
              placeholder="Enter passphrase for encrypted key"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Only required if your SSH key is encrypted with a passphrase
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3 pt-4">
        {isEditing && onCancel && (
          <Button
            type="button"
            onClick={onCancel}
            variant="outline"
            size="default"
            className="w-full sm:w-auto order-2 sm:order-1"
          >
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          variant="default"
          size="default"
          className="w-full sm:w-auto order-1 sm:order-2"
        >
          {isEditing ? 'Update Server' : 'Add Server'}
        </Button>
      </div>
    </form>
  );
}

