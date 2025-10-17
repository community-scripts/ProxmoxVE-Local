'use client';

import { useState } from 'react';
import { X, Copy, Check, Server, Globe } from 'lucide-react';
import { Button } from './ui/button';

interface PublicKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  publicKey: string;
  serverName: string;
  serverIp: string;
}

export function PublicKeyModal({ isOpen, onClose, publicKey, serverName, serverIp }: PublicKeyModalProps) {
  const [copied, setCopied] = useState(false);
  const [commandCopied, setCommandCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      // Try modern clipboard API first
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(publicKey);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        // Fallback for older browsers or non-HTTPS
        const textArea = document.createElement('textarea');
        textArea.value = publicKey;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
          document.execCommand('copy');
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch (fallbackError) {
          console.error('Fallback copy failed:', fallbackError);
          // If all else fails, show the key in an alert
          alert('Please manually copy this key:\n\n' + publicKey);
        }
        
        document.body.removeChild(textArea);
      }
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      // Fallback: show the key in an alert
      alert('Please manually copy this key:\n\n' + publicKey);
    }
  };

  const handleCopyCommand = async () => {
    const command = `echo "${publicKey}" >> ~/.ssh/authorized_keys`;
    try {
      // Try modern clipboard API first
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(command);
        setCommandCopied(true);
        setTimeout(() => setCommandCopied(false), 2000);
      } else {
        // Fallback for older browsers or non-HTTPS
        const textArea = document.createElement('textarea');
        textArea.value = command;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
          document.execCommand('copy');
          setCommandCopied(true);
          setTimeout(() => setCommandCopied(false), 2000);
        } catch (fallbackError) {
          console.error('Fallback copy failed:', fallbackError);
          alert('Please manually copy this command:\n\n' + command);
        }
        
        document.body.removeChild(textArea);
      }
    } catch (error) {
      console.error('Failed to copy command to clipboard:', error);
      alert('Please manually copy this command:\n\n' + command);
    }
  };

  return (
    <div className="fixed inset-0 backdrop-blur-sm bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg shadow-xl max-w-2xl w-full border border-border">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-info/10 rounded-lg">
              <Server className="h-6 w-6 text-info" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-card-foreground">SSH Public Key</h2>
              <p className="text-sm text-muted-foreground">Add this key to your server&apos;s authorized_keys</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Server Info */}
          <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Server className="h-4 w-4" />
              <span className="font-medium">{serverName}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Globe className="h-4 w-4" />
              <span>{serverIp}</span>
            </div>
          </div>

          {/* Instructions */}
          <div className="space-y-2">
            <h3 className="font-medium text-foreground">Instructions:</h3>
            <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Copy the public key below</li>
              <li>SSH into your server: <code className="bg-muted px-1 rounded">ssh root@{serverIp}</code></li>
              <li>Add the key to authorized_keys: <code className="bg-muted px-1 rounded">echo &quot;&lt;paste-key&gt;&quot; &gt;&gt; ~/.ssh/authorized_keys</code></li>
              <li>Set proper permissions: <code className="bg-muted px-1 rounded">chmod 600 ~/.ssh/authorized_keys</code></li>
            </ol>
          </div>

          {/* Public Key */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">Public Key:</label>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="gap-2"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy
                  </>
                )}
              </Button>
            </div>
            <textarea
              value={publicKey}
              readOnly
              className="w-full px-3 py-2 border rounded-md shadow-sm bg-card text-foreground font-mono text-xs min-h-[60px] resize-none border-border focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
              placeholder="Public key will appear here..."
            />
          </div>

          {/* Quick Command */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">Quick Add Command:</label>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyCommand}
                className="gap-2"
              >
                {commandCopied ? (
                  <>
                    <Check className="h-4 w-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy Command
                  </>
                )}
              </Button>
            </div>
            <div className="p-3 bg-muted/50 rounded-md border border-border">
              <code className="text-sm font-mono text-foreground break-all">
                echo &quot;{publicKey}&quot; &gt;&gt; ~/.ssh/authorized_keys
              </code>
            </div>
            <p className="text-xs text-muted-foreground">
              Copy and paste this command directly into your server terminal to add the key to authorized_keys
            </p>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
