/**
 * AGENT_OS - Project Workspace File System
 * 
 * Manages file operations on the isolated project workspace:
 * - Prevents path traversal out of project directory.
 * - Prevents reading host credentials, SSH keys, or arbitrary host paths.
 * - Provides file CRUD, patch/diff, search, and git operations.
 */

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface FileEntry {
  name: string;
  path: string; // Relative to project root
  isDirectory: boolean;
  sizeBytes?: number;
  updatedAt: string;
}

export interface SearchMatch {
  file: string;
  line: number;
  content: string;
}

export class ProjectFileSystem {
  private baseWorkspacesDir: string;

  constructor(baseDir?: string) {
    this.baseWorkspacesDir = baseDir || path.resolve(process.cwd(), 'workspaces');
    if (!fs.existsSync(this.baseWorkspacesDir)) {
      fs.mkdirSync(this.baseWorkspacesDir, { recursive: true });
    }
  }

  /**
   * Resolves and strictly validates that a path stays inside the project workspace.
   */
  public resolveSafePath(projectId: string, relativePath: string = ''): string {
    const sanitizedProjectId = projectId.replace(/[^a-zA-Z0-9_\-]/g, '');
    const projectRoot = path.resolve(this.baseWorkspacesDir, sanitizedProjectId);

    if (!fs.existsSync(projectRoot)) {
      fs.mkdirSync(projectRoot, { recursive: true });
    }

    const resolved = path.resolve(projectRoot, relativePath.replace(/^\/+/, ''));
    if (!resolved.startsWith(projectRoot)) {
      throw new Error(`Path traversal denied: '${relativePath}' is outside project workspace.`);
    }

    return resolved;
  }

  public getProjectRoot(projectId: string): string {
    return this.resolveSafePath(projectId, '');
  }

  public async listFiles(projectId: string, dirPath: string = ''): Promise<FileEntry[]> {
    const fullDir = this.resolveSafePath(projectId, dirPath);
    if (!fs.existsSync(fullDir)) return [];

    const entries = await fs.promises.readdir(fullDir, { withFileTypes: true });
    const projectRoot = this.getProjectRoot(projectId);

    const result: FileEntry[] = [];
    for (const entry of entries) {
      if (entry.name === '.git' || entry.name === 'node_modules') continue;

      const fullPath = path.join(fullDir, entry.name);
      const relativePath = path.relative(projectRoot, fullPath);
      const stats = await fs.promises.stat(fullPath);

      result.push({
        name: entry.name,
        path: relativePath,
        isDirectory: entry.isDirectory(),
        sizeBytes: stats.size,
        updatedAt: stats.mtime.toISOString(),
      });
    }

    return result.sort((a, b) => {
      if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name);
      return a.isDirectory ? -1 : 1;
    });
  }

  public async listAllFilesRecursive(projectId: string, currentDir: string = ''): Promise<string[]> {
    const files: string[] = [];
    const entries = await this.listFiles(projectId, currentDir);

    for (const entry of entries) {
      if (entry.isDirectory) {
        const subFiles = await this.listAllFilesRecursive(projectId, entry.path);
        files.push(...subFiles);
      } else {
        files.push(entry.path);
      }
    }
    return files;
  }

  public async readFile(projectId: string, filePath: string): Promise<string> {
    const fullPath = this.resolveSafePath(projectId, filePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: '${filePath}'`);
    }
    return fs.promises.readFile(fullPath, 'utf8');
  }

  public async writeFile(projectId: string, filePath: string, content: string): Promise<void> {
    const fullPath = this.resolveSafePath(projectId, filePath);
    const parentDir = path.dirname(fullPath);
    if (!fs.existsSync(parentDir)) {
      await fs.promises.mkdir(parentDir, { recursive: true });
    }
    await fs.promises.writeFile(fullPath, content, 'utf8');
  }

  public async patchFile(projectId: string, filePath: string, searchStr: string, replaceStr: string): Promise<void> {
    const current = await this.readFile(projectId, filePath);
    if (!current.includes(searchStr)) {
      throw new Error(`Search string not found in file '${filePath}'`);
    }
    const updated = current.replace(searchStr, replaceStr);
    await this.writeFile(projectId, filePath, updated);
  }

  public async createDirectory(projectId: string, dirPath: string): Promise<void> {
    const fullPath = this.resolveSafePath(projectId, dirPath);
    await fs.promises.mkdir(fullPath, { recursive: true });
  }

  public async deleteFile(projectId: string, filePath: string): Promise<void> {
    const fullPath = this.resolveSafePath(projectId, filePath);
    if (fs.existsSync(fullPath)) {
      const stat = await fs.promises.stat(fullPath);
      if (stat.isDirectory()) {
        await fs.promises.rm(fullPath, { recursive: true, force: true });
      } else {
        await fs.promises.unlink(fullPath);
      }
    }
  }

  public async searchFiles(projectId: string, query: string): Promise<SearchMatch[]> {
    const allFiles = await this.listAllFilesRecursive(projectId);
    const matches: SearchMatch[] = [];

    for (const relPath of allFiles) {
      // Skip binary files and large assets
      if (/\.(png|jpg|jpeg|gif|ico|pdf|zip|tar|gz|woff|woff2)$/i.test(relPath)) continue;

      try {
        const content = await this.readFile(projectId, relPath);
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].toLowerCase().includes(query.toLowerCase())) {
            matches.push({
              file: relPath,
              line: i + 1,
              content: lines[i].trim(),
            });
            if (matches.length >= 100) return matches;
          }
        }
      } catch (err) {
        // Skip unreadable files
      }
    }

    return matches;
  }

  // Git operations
  public async gitStatus(projectId: string): Promise<string> {
    const projectRoot = this.getProjectRoot(projectId);
    try {
      if (!fs.existsSync(path.join(projectRoot, '.git'))) {
        await execAsync('git init -b main', { cwd: projectRoot });
      }
      const { stdout } = await execAsync('git status --short', { cwd: projectRoot });
      return stdout || 'Clean working tree';
    } catch (err: any) {
      return `Git status error: ${err.message}`;
    }
  }

  public async gitDiff(projectId: string): Promise<string> {
    const projectRoot = this.getProjectRoot(projectId);
    try {
      const { stdout } = await execAsync('git diff', { cwd: projectRoot });
      return stdout || 'No uncommitted changes';
    } catch (err: any) {
      return `Git diff error: ${err.message}`;
    }
  }

  public async gitCommit(projectId: string, message: string): Promise<string> {
    const projectRoot = this.getProjectRoot(projectId);
    try {
      if (!fs.existsSync(path.join(projectRoot, '.git'))) {
        await execAsync('git init -b main', { cwd: projectRoot });
      }
      await execAsync('git add -A', { cwd: projectRoot });
      const { stdout } = await execAsync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { cwd: projectRoot });
      return stdout;
    } catch (err: any) {
      return `Commit error: ${err.message}`;
    }
  }

  public async gitBranch(projectId: string): Promise<string> {
    const projectRoot = this.getProjectRoot(projectId);
    try {
      const { stdout } = await execAsync('git branch --show-current', { cwd: projectRoot });
      return stdout.trim() || 'main';
    } catch (err: any) {
      return 'main';
    }
  }
}

export const projectFs = new ProjectFileSystem();
