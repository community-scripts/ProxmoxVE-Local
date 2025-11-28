"use client";

import { useState } from "react";
import type { Script } from "../../types/script";
import { Button } from "./ui/button";
import { useRegisterModal } from "./modal/ModalStackProvider";

interface ScriptVersionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectVersion: (versionType: string) => void;
  script: Script | null;
}

export function ScriptVersionModal({
  isOpen,
  onClose,
  onSelectVersion,
  script,
}: ScriptVersionModalProps) {
  useRegisterModal(isOpen, {
    id: "script-version-modal",
    allowEscape: true,
    onClose,
  });
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);

  if (!isOpen || !script) return null;

  // Get available install methods
  const installMethods = script.install_methods || [];
  const defaultMethod = installMethods.find(
    (method) => method.type === "default",
  );
  const alpineMethod = installMethods.find(
    (method) => method.type === "alpine",
  );

  const handleConfirm = () => {
    if (selectedVersion) {
      onSelectVersion(selectedVersion);
      onClose();
    }
  };

  const handleVersionSelect = (versionType: string) => {
    setSelectedVersion(versionType);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="bg-card border-border w-full max-w-2xl rounded-lg border shadow-xl">
        {/* Header */}
        <div className="border-border flex items-center justify-between border-b p-6">
          <h2 className="text-foreground text-xl font-bold">Select Version</h2>
          <Button
            onClick={onClose}
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </Button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="mb-6">
            <h3 className="text-foreground mb-2 text-lg font-medium">
              Choose a version for &quot;{script.name}&quot;
            </h3>
            <p className="text-muted-foreground text-sm">
              Select the version you want to install. Each version has different
              resource requirements.
            </p>
          </div>

          <div className="space-y-4">
            {/* Default Version */}
            {defaultMethod && (
              <div
                onClick={() => handleVersionSelect("default")}
                className={`cursor-pointer rounded-lg border-2 p-4 transition-all ${
                  selectedVersion === "default"
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card hover:border-primary/50"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="mb-3 flex items-center space-x-3">
                      <div
                        className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                          selectedVersion === "default"
                            ? "border-primary bg-primary"
                            : "border-border"
                        }`}
                      >
                        {selectedVersion === "default" && (
                          <svg
                            className="h-3 w-3 text-white"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </div>
                      <h4 className="text-foreground text-base font-semibold capitalize">
                        {defaultMethod.type}
                      </h4>
                    </div>
                    <div className="ml-8 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-muted-foreground">CPU: </span>
                        <span className="text-foreground font-medium">
                          {defaultMethod.resources.cpu} cores
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">RAM: </span>
                        <span className="text-foreground font-medium">
                          {defaultMethod.resources.ram} MB
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">HDD: </span>
                        <span className="text-foreground font-medium">
                          {defaultMethod.resources.hdd} GB
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">OS: </span>
                        <span className="text-foreground font-medium">
                          {defaultMethod.resources.os}{" "}
                          {defaultMethod.resources.version}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Alpine Version */}
            {alpineMethod && (
              <div
                onClick={() => handleVersionSelect("alpine")}
                className={`cursor-pointer rounded-lg border-2 p-4 transition-all ${
                  selectedVersion === "alpine"
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card hover:border-primary/50"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="mb-3 flex items-center space-x-3">
                      <div
                        className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                          selectedVersion === "alpine"
                            ? "border-primary bg-primary"
                            : "border-border"
                        }`}
                      >
                        {selectedVersion === "alpine" && (
                          <svg
                            className="h-3 w-3 text-white"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </div>
                      <h4 className="text-foreground text-base font-semibold capitalize">
                        {alpineMethod.type}
                      </h4>
                    </div>
                    <div className="ml-8 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-muted-foreground">CPU: </span>
                        <span className="text-foreground font-medium">
                          {alpineMethod.resources.cpu} cores
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">RAM: </span>
                        <span className="text-foreground font-medium">
                          {alpineMethod.resources.ram} MB
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">HDD: </span>
                        <span className="text-foreground font-medium">
                          {alpineMethod.resources.hdd} GB
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">OS: </span>
                        <span className="text-foreground font-medium">
                          {alpineMethod.resources.os}{" "}
                          {alpineMethod.resources.version}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex justify-end space-x-3">
            <Button onClick={onClose} variant="outline" size="default">
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!selectedVersion}
              variant="default"
              size="default"
              className={
                !selectedVersion ? "bg-muted-foreground cursor-not-allowed" : ""
              }
            >
              Continue
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
