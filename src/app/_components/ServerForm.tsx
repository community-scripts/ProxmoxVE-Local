'use client';

import { useState } from 'react';
import type { CreateServerData } from '../../types/server';
import { Button } from './ui/button';

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
    }
  );

  const [errors, setErrors] = useState<Partial<CreateServerData>>({});

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

    if (!formData.password.trim()) {
      newErrors.password = 'Password is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit(formData);
      if (!isEditing) {
        setFormData({ name: '', ip: '', user: '', password: '' });
      }
    }
  };

  const handleChange = (field: keyof CreateServerData) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          <label htmlFor="password" className="block text-sm font-medium text-muted-foreground mb-1">
            Password *
          </label>
          <input
            type="password"
            id="password"
            value={formData.password}
            onChange={handleChange('password')}
            className={`w-full px-3 py-2 border rounded-md shadow-sm bg-card text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring ${
              errors.password ? 'border-destructive' : 'border-border'
            }`}
            placeholder="Enter password"
          />
          {errors.password && <p className="mt-1 text-sm text-destructive">{errors.password}</p>}
        </div>
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        {isEditing && onCancel && (
          <Button
            type="button"
            onClick={onCancel}
            variant="outline"
            size="default"
          >
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          variant="default"
          size="default"
        >
          {isEditing ? 'Update Server' : 'Add Server'}
        </Button>
      </div>
    </form>
  );
}

