"use client";

import { Settings } from "lucide-react";
import type { ScriptAppVar } from "~/types/script";

interface AppVarFieldsProps {
  appVars: ScriptAppVar[];
  values: Record<string, string>;
  onChange: (name: string, value: string) => void;
  className?: string;
}

export function AppVarFields({
  appVars,
  values,
  onChange,
  className = "",
}: AppVarFieldsProps) {
  if (appVars.length === 0) return null;

  return (
    <fieldset
      className={`border-border bg-muted/20 rounded-xl border p-3.5 dark:bg-white/[0.02] ${className}`}
    >
      <legend className="text-muted-foreground flex items-center gap-1.5 px-1 text-[0.6875rem] font-semibold tracking-wider uppercase">
        <Settings className="text-primary h-3.5 w-3.5" aria-hidden />
        Application settings
      </legend>
      <p className="text-muted-foreground mb-3 text-xs">
        Values this script accepts up front. Leave a field empty to be prompted
        during installation.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {appVars.map((appVar) => (
          <AppVarField
            key={appVar.name}
            appVar={appVar}
            value={values[appVar.name] ?? ""}
            onChange={onChange}
          />
        ))}
      </div>
      {appVars.some((appVar) => appVar.secret) && (
        <p className="text-muted-foreground/70 mt-3 text-[0.6875rem]">
          Supplied secrets are passed to the shell process and appear in copied
          commands. Leave them empty to enter them interactively instead.
        </p>
      )}
    </fieldset>
  );
}

function AppVarField({
  appVar,
  value,
  onChange,
}: {
  appVar: ScriptAppVar;
  value: string;
  onChange: (name: string, value: string) => void;
}) {
  const id = `app-var-${appVar.name}`;
  const inputClass =
    "border-input bg-background focus:border-primary h-9 w-full rounded-lg border px-3 font-mono text-sm outline-none transition-colors";

  return (
    <div>
      <label
        htmlFor={id}
        className="text-muted-foreground mb-1 flex items-center gap-1.5 text-xs font-medium"
      >
        {appVar.label || appVar.name}
        {appVar.required && (
          <span className="text-primary" title="Required when unattended">
            *
          </span>
        )}
        <code className="text-muted-foreground/60 text-[0.625rem]">
          {appVar.name}
        </code>
      </label>

      {appVar.type === "boolean" ? (
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(appVar.name, event.target.value)}
          className={inputClass}
        >
          <option value="">
            {appVar.default ? `${appVar.default} (default)` : "script default"}
          </option>
          <option value="yes">yes</option>
          <option value="no">no</option>
        </select>
      ) : appVar.type === "select" && appVar.options?.length ? (
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(appVar.name, event.target.value)}
          className={inputClass}
        >
          <option value="">
            {appVar.default ? `${appVar.default} (default)` : "script default"}
          </option>
          {appVar.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          type={
            appVar.secret || appVar.type === "password"
              ? "password"
              : appVar.type === "number"
                ? "number"
                : "text"
          }
          value={value}
          onChange={(event) => onChange(appVar.name, event.target.value)}
          placeholder={appVar.default ?? "leave empty to be prompted"}
          className={inputClass}
          autoComplete={appVar.secret ? "new-password" : "off"}
        />
      )}

      {appVar.help && (
        <span className="text-muted-foreground/70 mt-1 block text-[0.6875rem]">
          {appVar.help}
        </span>
      )}
    </div>
  );
}
