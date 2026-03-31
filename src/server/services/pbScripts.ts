/**
 * PocketBase queries for script data.
 * Mirrors ProxmoxVE-Frontend/lib/pb-queries-server.ts.
 * All queries are unauthenticated (public API).
 */
import { getPb, withPbRetry } from "./pbService";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PBCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  sort_order?: number;
}

export interface PBScriptType {
  id: string;
  type: string; // "ct", "vm", "pve", "addon", "turnkey"
}

export interface PBInstallMethod {
  type: string; // "default", "alpine", etc.
  script?: string; // e.g. "ct/adguard.sh" – present in local JSON scripts, absent in PocketBase records
  resources: {
    cpu: number;
    ram: number;
    hdd: number;
    os: string;
    version: string;
  };
  config_path?: string;
}

export interface PBNote {
  text: string;
  type: string; // "info", "warning", "danger"
}

/** Lightweight card for listing – no install methods / notes. */
export interface PBScriptCard {
  id: string;
  name: string;
  slug: string;
  description: string;
  logo: string | null;
  /** Type slug resolved from the expanded type relation. */
  type: string;
  updateable: boolean;
  privileged: boolean;
  port: number | null;
  website: string | null;
  documentation: string | null;
  is_dev: boolean;
  has_arm: boolean;
  is_disabled: boolean;
  is_deleted: boolean;
  script_created: string;
  script_updated: string;
  categories: PBCategory[];
}

/** Full script record including install methods and notes. */
export interface PBScript extends PBScriptCard {
  config_path: string | null;
  default_user: string | null;
  default_passwd: string | null;
  install_methods_json: PBInstallMethod[];
  notes_json: PBNote[];
  version: string | null;
  github: string | null;
  execute_in: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract the type slug from the expand.type object or fall back to the raw field. */
function resolveTypeSlug(record: Record<string, unknown>): string {
  const expand = record.expand as Record<string, unknown> | undefined;
  const expandedType = expand?.type as Record<string, unknown> | undefined;
  if (expandedType?.type && typeof expandedType.type === "string") {
    return expandedType.type;
  }
  // Raw field may be a relation ID string – treat as unknown type
  return typeof record.type === "string" ? record.type : "ct";
}

function resolveCategories(record: Record<string, unknown>): PBCategory[] {
  const expand = record.expand as Record<string, unknown> | undefined;
  const cats = expand?.categories;
  if (Array.isArray(cats)) {
    return cats as PBCategory[];
  }
  return [];
}

function parseJsonField<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function toCard(record: Record<string, unknown>): PBScriptCard {
  return {
    id: record.id as string,
    name: (record.name as string) ?? "",
    slug: (record.slug as string) ?? "",
    description: (record.description as string) ?? "",
    logo: (record.logo as string | null) ?? null,
    type: resolveTypeSlug(record),
    updateable: Boolean(record.updateable),
    privileged: Boolean(record.privileged),
    port: (record.port as number | null) ?? null,
    website: (record.website as string | null) ?? null,
    documentation: (record.documentation as string | null) ?? null,
    is_dev: Boolean(record.is_dev),
    has_arm: Boolean(record.has_arm),
    is_disabled: Boolean(record.is_disabled),
    is_deleted: Boolean(record.is_deleted),
    script_created: (record.script_created as string) ?? "",
    script_updated: (record.script_updated as string) ?? "",
    categories: resolveCategories(record),
  };
}

function toScript(record: Record<string, unknown>): PBScript {
  return {
    ...toCard(record),
    config_path: (record.config_path as string | null) ?? null,
    default_user: (record.default_user as string | null) ?? null,
    default_passwd: (record.default_passwd as string | null) ?? null,
    install_methods_json: parseJsonField<PBInstallMethod>(
      record.install_methods_json,
    ),
    notes_json: parseJsonField<PBNote>(record.notes_json),
    version: (record.version as string | null) ?? null,
    github: (record.github as string | null) ?? null,
    execute_in: parseJsonField<string>(record.execute_in),
  };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

const CARD_FIELDS =
  "id,slug,name,description,logo,type,categories,is_dev,has_arm,is_disabled,is_deleted,privileged,port,updateable,website,documentation,script_created,script_updated,expand.categories.*,expand.type.*";

 

/**
 * Fetch all script cards (lightweight, no install methods / notes).
 * Suitable for the script listing UI.
 */
export async function getScriptCards(): Promise<PBScriptCard[]> {
  const pb = getPb();
  const records = await withPbRetry(() =>
    pb.collection("script_scripts").getFullList({
      sort: "name",
      expand: "categories,type",
      batch: 500,
      fields: CARD_FIELDS,
    }),
  );
  return records.map((r) => toCard(r as unknown as Record<string, unknown>));
}

/**
 * Fetch all categories, sorted.
 */
export async function getCategories(): Promise<PBCategory[]> {
  const pb = getPb();
  const records = await withPbRetry(() =>
    pb.collection("script_categories").getFullList({
      sort: "sort_order,name",
      batch: 100,
    }),
  );
  return records as unknown as PBCategory[];
}

/**
 * Fetch all script types.
 */
export async function getScriptTypes(): Promise<PBScriptType[]> {
  const pb = getPb();
  const records = await withPbRetry(() =>
    pb.collection("z_ref_script_types").getFullList({
      fields: "id,type",
      batch: 100,
    }),
  );
  return records as unknown as PBScriptType[];
}

/**
 * Fetch a single full script by slug.
 * Returns null when not found.
 */
export async function getScriptBySlug(slug: string): Promise<PBScript | null> {
  const pb = getPb();
  try {
    const record = await withPbRetry(() =>
      pb
        .collection("script_scripts")
        .getFirstListItem(pb.filter("slug = {:slug}", { slug }), {
          expand: "categories,type",
        }),
    );
    return toScript(record as unknown as Record<string, unknown>);
  } catch {
    return null;
  }
}

/**
 * Fetch all full scripts (with install methods and notes).
 * Use sparingly – fetches the complete records.
 */
export async function getAllScripts(): Promise<PBScript[]> {
  const pb = getPb();
  const records = await withPbRetry(() =>
    pb.collection("script_scripts").getFullList({
      sort: "name",
      expand: "categories,type",
      batch: 500,
    }),
  );
  return records.map((r) => toScript(r as unknown as Record<string, unknown>));
}

/**
 * Metadata bundle used by the UI for filtering (categories + types).
 */
export async function getMetadata(): Promise<{
  categories: PBCategory[];
  scriptTypes: PBScriptType[];
}> {
  const [categories, scriptTypes] = await Promise.all([
    getCategories(),
    getScriptTypes(),
  ]);
  return { categories, scriptTypes };
}
