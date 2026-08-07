import type {
  ScriptAppVar,
  ScriptArchitecture,
  ScriptPlatform,
} from "~/types/script";

interface ArchitectureCarrier {
  architectures: ScriptArchitecture[];
}

interface PlatformCarrier {
  platforms: ScriptPlatform[];
}

interface AppVarCarrier {
  app_vars?: ScriptAppVar[];
}

const ALL_ARCHITECTURES: ScriptArchitecture[] = ["amd64", "arm64"];

export function scriptArchitectures(
  script: ArchitectureCarrier,
): ScriptArchitecture[] {
  if (!Array.isArray(script.architectures)) return [];
  return script.architectures.filter((architecture) =>
    ALL_ARCHITECTURES.includes(architecture),
  );
}

export function supportsArm(script: ArchitectureCarrier): boolean {
  return scriptArchitectures(script).includes("arm64");
}

export function scriptPlatforms(script: PlatformCarrier): ScriptPlatform[] {
  if (!Array.isArray(script.platforms)) return [];
  return script.platforms.filter(
    (platform): platform is ScriptPlatform =>
      platform === "pve" || platform === "incus",
  );
}

export function supportsPlatform(
  script: PlatformCarrier,
  platform: ScriptPlatform,
): boolean {
  return scriptPlatforms(script).includes(platform);
}

export function scriptAppVars(script: AppVarCarrier): ScriptAppVar[] {
  if (!Array.isArray(script.app_vars)) return [];
  return script.app_vars.filter(
    (appVar) =>
      !!appVar &&
      typeof appVar.name === "string" &&
      /^[A-Za-z_][A-Za-z0-9_]*$/.test(appVar.name),
  );
}

/** Only pass explicit values that differ from the script's declared default. */
export function appVarValues(
  appVars: ScriptAppVar[],
  values: Record<string, string>,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const appVar of appVars) {
    const value = values[appVar.name];
    if (value === undefined || value === "" || value === appVar.default)
      continue;
    result[appVar.name] = value;
  }
  return result;
}

function shellDoubleQuote(value: string): string {
  return value.replace(/([\\"$`])/g, "\\$1");
}

export function appVarAssignments(
  appVars: ScriptAppVar[],
  values: Record<string, string>,
): string[] {
  return Object.entries(appVarValues(appVars, values)).map(
    ([name, value]) => `${name}="${shellDoubleQuote(value)}"`,
  );
}
