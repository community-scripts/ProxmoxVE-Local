'use client';

import { useState, useRef } from 'react';
import { Button } from './ui/button';

interface SSHKeyInputProps {
  value: string;
  onChange: (value: string) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
}

export function SSHKeyInput({ value, onChange, onError, disabled = false }: SSHKeyInputProps) {
  const [inputMode, setInputMode] = useState<'upload' | 'paste'>('upload');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateSSHKey = (keyContent: string): boolean => {
    const trimmed = keyContent.trim();
    return (
      trimmed.includes('BEGIN') &&
      trimmed.includes('PRIVATE KEY') &&
      trimmed.includes('END') &&
      trimmed.includes('PRIVATE KEY')
    );
  };

  const handleFileUpload = (file: File) => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (validateSSHKey(content)) {
        onChange(content);
        onError?.('');
      } else {
        onError?.('Invalid SSH key format. Please ensure the file contains a valid private key.');
      }
    };
    reader.onerror = () => {
      onError?.('Failed to read the file. Please try again.');
    };
    reader.readAsText(file);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
    
    const file = event.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handlePasteChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const content = event.target.value;
    onChange(content);
    
    if (content.trim() && !validateSSHKey(content)) {
      onError?.('Invalid SSH key format. Please ensure the content is a valid private key.');
    } else {
      onError?.('');
    }
  };

  const getKeyFingerprint = (keyContent: string): string => {
    // This is a simplified fingerprint - in a real implementation,
    // you might want to use a library to generate proper SSH key fingerprints
    if (!keyContent.trim()) return '';
    
    const lines = keyContent.trim().split('\n');
    const keyLine = lines.find(line => 
      line.includes('BEGIN') && line.includes('PRIVATE KEY')
    );
    
    if (keyLine) {
      const keyType = keyLine.includes('RSA') ? 'RSA' : 
                     keyLine.includes('ED25519') ? 'ED25519' : 
                     keyLine.includes('ECDSA') ? 'ECDSA' : 'Unknown';
      return `${keyType} key (${keyContent.length} characters)`;
    }
    
    return 'Unknown key type';
  };

  return (
    <div className="space-y-4">
      {/* Mode Toggle */}
      <div className="flex space-x-2">
        <Button
          type="button"
          variant={inputMode === 'upload' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setInputMode('upload')}
          disabled={disabled}
        >
          Upload File
        </Button>
        <Button
          type="button"
          variant={inputMode === 'paste' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setInputMode('paste')}
          disabled={disabled}
        >
          Paste Key
        </Button>
      </div>

      {/* File Upload Mode */}
      {inputMode === 'upload' && (
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            isDragOver
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !disabled && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pem,.key,.id_rsa,.id_ed25519,.id_ecdsa"
            onChange={handleFileSelect}
            className="hidden"
            disabled={disabled}
          />
          <div className="space-y-2">
            <div className="text-lg">📁</div>
            <p className="text-sm text-muted-foreground">
              Drag and drop your SSH private key here, or click to browse
            </p>
            <p className="text-xs text-muted-foreground">
              Supported formats: RSA, ED25519, ECDSA (.pem, .key, .id_rsa, etc.)
            </p>
          </div>
        </div>
      )}

      {/* Paste Mode */}
      {inputMode === 'paste' && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">
            Paste your SSH private key:
          </label>
          <textarea
            value={value}
            onChange={handlePasteChange}
            placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABFwAAAAdzc2gtcn...&#10;-----END OPENSSH PRIVATE KEY-----"
            className="w-full h-32 px-3 py-2 border rounded-md shadow-sm bg-card text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring font-mono text-xs"
            disabled={disabled}
          />
        </div>
      )}

      {/* Key Information */}
      {value && (
        <div className="p-3 bg-muted rounded-md">
          <div className="text-sm">
            <span className="font-medium">Key detected:</span> {getKeyFingerprint(value)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            ⚠️ Keep your private keys secure. This key will be stored in the database.
          </div>
        </div>
      )}
    </div>
  );
}
