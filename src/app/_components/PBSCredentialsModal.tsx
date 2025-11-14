'use client';

import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Lock, CheckCircle, AlertCircle } from 'lucide-react';
import { useRegisterModal } from './modal/ModalStackProvider';
import { api } from '~/trpc/react';
import type { Storage } from '~/server/services/storageService';

interface PBSCredentialsModalProps {
  isOpen: boolean;
  onClose: () => void;
  serverId: number;
  serverName: string;
  storage: Storage;
}

export function PBSCredentialsModal({
  isOpen,
  onClose,
  serverId,
  serverName,
  storage
}: PBSCredentialsModalProps) {
  const [pbsIp, setPbsIp] = useState('');
  const [pbsDatastore, setPbsDatastore] = useState('');
  const [pbsPassword, setPbsPassword] = useState('');
  const [pbsFingerprint, setPbsFingerprint] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Extract PBS info from storage object
  const pbsIpFromStorage = (storage as any).server || null;
  const pbsDatastoreFromStorage = (storage as any).datastore || null;
  
  // Fetch existing credentials
  const { data: credentialData, refetch } = api.pbsCredentials.getCredentialsForStorage.useQuery(
    { serverId, storageName: storage.name },
    { enabled: isOpen }
  );
  
  // Initialize form with storage config values or existing credentials
  useEffect(() => {
    if (isOpen) {
      if (credentialData?.success && credentialData.credential) {
        // Load existing credentials
        setPbsIp(credentialData.credential.pbs_ip);
        setPbsDatastore(credentialData.credential.pbs_datastore);
        setPbsPassword(''); // Don't show password
        setPbsFingerprint(credentialData.credential.pbs_fingerprint || '');
      } else {
        // Initialize with storage config values
        setPbsIp(pbsIpFromStorage || '');
        setPbsDatastore(pbsDatastoreFromStorage || '');
        setPbsPassword('');
        setPbsFingerprint('');
      }
    }
  }, [isOpen, credentialData, pbsIpFromStorage, pbsDatastoreFromStorage]);
  
  const saveCredentials = api.pbsCredentials.saveCredentials.useMutation({
    onSuccess: () => {
      void refetch();
      onClose();
    },
    onError: (error) => {
      console.error('Failed to save PBS credentials:', error);
      alert(`Failed to save credentials: ${error.message}`);
    },
  });
  
  const deleteCredentials = api.pbsCredentials.deleteCredentials.useMutation({
    onSuccess: () => {
      void refetch();
      onClose();
    },
    onError: (error) => {
      console.error('Failed to delete PBS credentials:', error);
      alert(`Failed to delete credentials: ${error.message}`);
    },
  });
  
  useRegisterModal(isOpen, { id: 'pbs-credentials-modal', allowEscape: true, onClose });
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!pbsIp || !pbsDatastore || !pbsFingerprint) {
      alert('Please fill in all required fields (IP, Datastore, Fingerprint)');
      return;
    }
    
    // Password is optional when updating existing credentials
    setIsLoading(true);
    try {
      await saveCredentials.mutateAsync({
        serverId,
        storageName: storage.name,
        pbs_ip: pbsIp,
        pbs_datastore: pbsDatastore,
        pbs_password: pbsPassword || undefined, // Undefined means keep existing password
        pbs_fingerprint: pbsFingerprint,
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete the PBS credentials for this storage?')) {
      return;
    }
    
    setIsLoading(true);
    try {
      await deleteCredentials.mutateAsync({
        serverId,
        storageName: storage.name,
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  if (!isOpen) return null;
  
  const hasCredentials = credentialData?.success && credentialData.credential;
  
  return (
    <div className="fixed inset-0 backdrop-blur-sm bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col border border-border">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <Lock className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-bold text-card-foreground">
              PBS Credentials - {storage.name}
            </h2>
          </div>
          <Button
            onClick={onClose}
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Storage Name (read-only) */}
            <div>
              <label htmlFor="storage-name" className="block text-sm font-medium text-foreground mb-1">
                Storage Name
              </label>
              <input
                type="text"
                id="storage-name"
                value={storage.name}
                disabled
                className="w-full px-3 py-2 border rounded-md shadow-sm bg-muted text-muted-foreground border-border cursor-not-allowed"
              />
            </div>
            
            {/* PBS IP */}
            <div>
              <label htmlFor="pbs-ip" className="block text-sm font-medium text-foreground mb-1">
                PBS Server IP <span className="text-error">*</span>
              </label>
              <input
                type="text"
                id="pbs-ip"
                value={pbsIp}
                onChange={(e) => setPbsIp(e.target.value)}
                required
                disabled={isLoading}
                className="w-full px-3 py-2 border rounded-md shadow-sm bg-card text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring border-border"
                placeholder="e.g., 10.10.10.226"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                IP address of the Proxmox Backup Server
              </p>
            </div>
            
            {/* PBS Datastore */}
            <div>
              <label htmlFor="pbs-datastore" className="block text-sm font-medium text-foreground mb-1">
                PBS Datastore <span className="text-error">*</span>
              </label>
              <input
                type="text"
                id="pbs-datastore"
                value={pbsDatastore}
                onChange={(e) => setPbsDatastore(e.target.value)}
                required
                disabled={isLoading}
                className="w-full px-3 py-2 border rounded-md shadow-sm bg-card text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring border-border"
                placeholder="e.g., NAS03-ISCSI-BACKUP"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Name of the datastore on the PBS server
              </p>
            </div>
            
            {/* PBS Password */}
            <div>
              <label htmlFor="pbs-password" className="block text-sm font-medium text-foreground mb-1">
                Password {!hasCredentials && <span className="text-error">*</span>}
              </label>
                <input
                type="password"
                id="pbs-password"
                value={pbsPassword}
                onChange={(e) => setPbsPassword(e.target.value)}
                required={!hasCredentials}
                disabled={isLoading}
                className="w-full px-3 py-2 border rounded-md shadow-sm bg-card text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring border-border"
                placeholder={hasCredentials ? "Enter new password (leave empty to keep existing)" : "Enter PBS password"}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Password for root@pam user on PBS server
              </p>
            </div>
            
            {/* PBS Fingerprint */}
            <div>
              <label htmlFor="pbs-fingerprint" className="block text-sm font-medium text-foreground mb-1">
                Fingerprint <span className="text-error">*</span>
              </label>
              <input
                type="text"
                id="pbs-fingerprint"
                value={pbsFingerprint}
                onChange={(e) => setPbsFingerprint(e.target.value)}
                required
                disabled={isLoading}
                className="w-full px-3 py-2 border rounded-md shadow-sm bg-card text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring border-border"
                placeholder="e.g., 7b:e5:87:38:5e:16:05:d1:12:22:7f:73:d2:e2:d0:cf:8c:cb:28:e2:74:0c:78:91:1a:71:74:2e:79:20:5a:02"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Server fingerprint for auto-acceptance. You can find this on your PBS dashboard by clicking the "Show Fingerprint" button.
              </p>
            </div>
            
            {/* Status indicator */}
            {hasCredentials && (
              <div className="p-3 bg-success/10 border border-success/20 rounded-lg flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-success" />
                <span className="text-sm text-success font-medium">
                  Credentials are configured for this storage
                </span>
              </div>
            )}
            
            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4">
              {hasCredentials && (
                <Button
                  type="button"
                  onClick={handleDelete}
                  variant="outline"
                  disabled={isLoading}
                  className="w-full sm:w-auto order-3"
                >
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Delete Credentials
                </Button>
              )}
              <Button
                type="button"
                onClick={onClose}
                variant="outline"
                disabled={isLoading}
                className="w-full sm:w-auto order-2"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="default"
                disabled={isLoading}
                className="w-full sm:w-auto order-1"
              >
                {isLoading ? 'Saving...' : hasCredentials ? 'Update Credentials' : 'Save Credentials'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

