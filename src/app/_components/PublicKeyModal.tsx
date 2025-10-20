"use client";

import { useState } from "react";
import { X, Copy, Check, Server, Globe } from "lucide-react";
import { Button } from "./ui/button";
import { useRegisterModal } from "./modal/ModalStackProvider";
import { useTranslation } from "@/lib/i18n/useTranslation";

interface PublicKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  publicKey: string;
  serverName: string;
  serverIp: string;
}

export function PublicKeyModal({
  isOpen,
  onClose,
  publicKey,
  serverName,
  serverIp,
}: PublicKeyModalProps) {
  const { t } = useTranslation("publicKeyModal");
  useRegisterModal(isOpen, {
    id: "public-key-modal",
    allowEscape: true,
    onClose,
  });
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
        const textArea = document.createElement("textarea");
        textArea.value = publicKey;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
          document.execCommand("copy");
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch (fallbackError) {
          console.error("Fallback copy failed:", fallbackError);
          // If all else fails, show the key in an alert
          alert(t("copyFallback") + publicKey);
        }

        document.body.removeChild(textArea);
      }
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
      // Fallback: show the key in an alert
      alert(t("copyFallback") + publicKey);
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
        const textArea = document.createElement("textarea");
        textArea.value = command;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
          document.execCommand("copy");
          setCommandCopied(true);
          setTimeout(() => setCommandCopied(false), 2000);
        } catch (fallbackError) {
          console.error("Fallback copy failed:", fallbackError);
          alert(t("copyCommandFallback") + command);
        }

        document.body.removeChild(textArea);
      }
    } catch (error) {
      console.error("Failed to copy command to clipboard:", error);
      alert(t("copyCommandFallback") + command);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="bg-card border-border w-full max-w-2xl rounded-lg border shadow-xl">
        {/* Header */}
        <div className="border-border flex items-center justify-between border-b p-6">
          <div className="flex items-center gap-3">
            <div className="bg-info/10 rounded-lg p-2">
              <Server className="text-info h-6 w-6" />
            </div>
            <div>
              <h2 className="text-card-foreground text-xl font-semibold">
                {t("title")}
              </h2>
              <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
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
        <div className="space-y-6 p-6">
          {/* Server Info */}
          <div className="bg-muted/50 flex items-center gap-4 rounded-lg p-4">
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <Server className="h-4 w-4" />
              <span className="font-medium">{serverName}</span>
            </div>
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <Globe className="h-4 w-4" />
              <span>{serverIp}</span>
            </div>
          </div>

          {/* Instructions */}
          <div className="space-y-2">
            <h3 className="text-foreground font-medium">
              {t("instructions.title")}
            </h3>
            <ol className="text-muted-foreground list-inside list-decimal space-y-1 text-sm">
              <li>{t("instructions.step1")}</li>
              <li>
                {t("instructions.step2")}{" "}
                <code className="bg-muted rounded px-1">
                  ssh root@{serverIp}
                </code>
              </li>
              <li>
                {t("instructions.step3")}{" "}
                <code className="bg-muted rounded px-1">
                  echo &quot;&lt;paste-key&gt;&quot; &gt;&gt;
                  ~/.ssh/authorized_keys
                </code>
              </li>
              <li>
                {t("instructions.step4")}{" "}
                <code className="bg-muted rounded px-1">
                  chmod 600 ~/.ssh/authorized_keys
                </code>
              </li>
            </ol>
          </div>

          {/* Public Key */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-foreground text-sm font-medium">
                {t("publicKeyLabel")}
              </label>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="gap-2"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4" />
                    {t("actions.copied")}
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    {t("actions.copy")}
                  </>
                )}
              </Button>
            </div>
            <textarea
              value={publicKey}
              readOnly
              className="bg-card text-foreground border-border focus:ring-ring focus:border-ring min-h-[60px] w-full resize-none rounded-md border px-3 py-2 font-mono text-xs shadow-sm focus:ring-2 focus:outline-none"
              placeholder={t("placeholder")}
            />
          </div>

          {/* Quick Command */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-foreground text-sm font-medium">
                {t("quickCommandLabel")}
              </label>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyCommand}
                className="gap-2"
              >
                {commandCopied ? (
                  <>
                    <Check className="h-4 w-4" />
                    {t("actions.copied")}
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    {t("actions.copyCommand")}
                  </>
                )}
              </Button>
            </div>
            <div className="bg-muted/50 border-border rounded-md border p-3">
              <code className="text-foreground font-mono text-sm break-all">
                echo &quot;{publicKey}&quot; &gt;&gt; ~/.ssh/authorized_keys
              </code>
            </div>
            <p className="text-muted-foreground text-xs">
              {t("quickCommandHint")}
            </p>
          </div>

          {/* Footer */}
          <div className="border-border flex justify-end gap-3 border-t pt-4">
            <Button variant="outline" onClick={onClose}>
              {t("actions.close")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
