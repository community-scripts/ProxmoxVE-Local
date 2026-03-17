import { readFile, readdir, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import type { Script, ScriptCard } from '~/types/script';

export class LocalScriptsService {
  private scriptsDirectory: string;

  constructor() {
    this.scriptsDirectory = join(process.cwd(), 'scripts', 'json');
  }

  async getJsonFiles(): Promise<string[]> {
    try {
      const files = await readdir(this.scriptsDirectory);
      return files.filter(file => file.endsWith('.json'));
    } catch {
      return [];
    }
  }

  async getScriptContent(filename: string): Promise<Script> {
    try {
      const filePath = join(this.scriptsDirectory, filename);
      const content = await readFile(filePath, 'utf-8');
      return JSON.parse(content) as Script;
    } catch (error) {
      console.error(`Error reading script file ${filename}:`, error);
      throw new Error(`Failed to read script: ${filename}`);
    }
  }

  /** Returns all scripts from PocketBase (community scripts) merged with any local JSON user scripts. */
  async getAllScripts(): Promise<Script[]> {
    try {
      const { getAllScripts: pbGetAll } = await import('./pbScripts.js');
      const pbScripts = await pbGetAll();

      const communityScripts: Script[] = pbScripts.map(pb => ({
        name: pb.name,
        slug: pb.slug,
        description: pb.description,
        logo: pb.logo ?? undefined,
        type: pb.type as Script['type'],
        updateable: pb.updateable,
        privileged: pb.privileged,
        port: pb.port ?? undefined,
        website: pb.website ?? undefined,
        documentation: pb.documentation ?? undefined,
        config_path: pb.config_path ?? null,
        default_user: pb.default_user ?? undefined,
        default_passwd: pb.default_passwd ?? undefined,
        is_dev: pb.is_dev,
        is_disabled: pb.is_disabled,
        is_deleted: pb.is_deleted,
        has_arm: pb.has_arm,
        categories: pb.categories.map(c => c.name),
        install_methods: pb.install_methods_json.map(m => ({
          type: m.type,
          resources: m.resources,
          config_path: m.config_path,
        })),
        notes: pb.notes_json.map(n => ({ text: n.text, type: n.type })),
      }));

      // Merge local user JSON scripts (only those not already in PocketBase)
      try {
        const jsonFiles = await this.getJsonFiles();
        const slugsSeen = new Set(communityScripts.map(s => s.slug));
        for (const filename of jsonFiles) {
          try {
            const script = await this.getScriptContent(filename);
            if (!slugsSeen.has(script.slug)) {
              communityScripts.push(script);
              slugsSeen.add(script.slug);
            }
          } catch { /* skip bad files */ }
        }
      } catch { /* local JSON folder absent – fine */ }

      return communityScripts;
    } catch (error) {
      console.error('Error fetching scripts from PocketBase, falling back to local JSON:', error);
      try {
        const jsonFiles = await this.getJsonFiles();
        const scripts: Script[] = [];
        for (const filename of jsonFiles) {
          try { scripts.push(await this.getScriptContent(filename)); } catch { /* skip */ }
        }
        return scripts;
      } catch {
        return [];
      }
    }
  }

  async getScriptCards(): Promise<ScriptCard[]> {
    const scripts = await this.getAllScripts();
    return scripts.map(script => ({
      name: script.name,
      slug: script.slug,
      description: script.description,
      logo: script.logo,
      type: script.type,
      updateable: script.updateable,
    }));
  }

  /** Fetches a script by slug, preferring PocketBase then local JSON. */
  async getScriptBySlug(slug: string): Promise<Script | null> {
    try {
      const { getScriptBySlug: pbGetBySlug } = await import('./pbScripts.js');
      const pb = await pbGetBySlug(slug);
      if (pb) {
        return {
          name: pb.name,
          slug: pb.slug,
          description: pb.description,
          logo: pb.logo ?? undefined,
          type: pb.type as Script['type'],
          updateable: pb.updateable,
          privileged: pb.privileged,
          port: pb.port ?? undefined,
          website: pb.website ?? undefined,
          documentation: pb.documentation ?? undefined,
          config_path: pb.config_path ?? null,
          default_user: pb.default_user ?? undefined,
          default_passwd: pb.default_passwd ?? undefined,
          is_dev: pb.is_dev,
          is_disabled: pb.is_disabled,
          is_deleted: pb.is_deleted,
          has_arm: pb.has_arm,
          categories: pb.categories.map(c => c.name),
          install_methods: pb.install_methods_json.map(m => ({
            type: m.type,
            resources: m.resources,
            config_path: m.config_path,
          })),
          notes: pb.notes_json.map(n => ({ text: n.text, type: n.type })),
        };
      }
    } catch (error) {
      console.warn(`PocketBase lookup failed for slug "${slug}", trying local JSON:`, error);
    }

    // Fallback: local JSON user script
    try {
      const filePath = join(this.scriptsDirectory, `${slug}.json`);
      const content = await readFile(filePath, 'utf-8');
      return JSON.parse(content) as Script;
    } catch {
      return null;
    }
  }

  async getMetadata(): Promise<unknown> {
    try {
      const { getMetadata } = await import('./pbScripts.js');
      return await getMetadata();
    } catch {
      return {};
    }
  }

  async saveScriptsFromGitHub(scripts: Script[]): Promise<void> {
    try {
      await mkdir(this.scriptsDirectory, { recursive: true });
      for (const script of scripts) {
        const filename = `${script.slug}.json`;
        const filePath = join(this.scriptsDirectory, filename);
        await writeFile(filePath, JSON.stringify(script, null, 2), 'utf-8');
      }
    } catch (error) {
      console.error('Error saving scripts from GitHub:', error);
      throw new Error('Failed to save scripts from GitHub');
    }
  }
}

// Singleton instance
export const localScriptsService = new LocalScriptsService();