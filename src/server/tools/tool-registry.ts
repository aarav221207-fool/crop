/**
 * AGENT_OS - Real Tool Execution Registry
 * 
 * Every tool performs a genuine system/workspace operation.
 * - Enforces BUILD vs ASK mode distinction: ASK mode strictly rejects mutating tools.
 * - Routes all shell commands to the Docker sandbox (rejects host execution if Docker is offline).
 * - Returns structured results with stdout, stderr, exitCode, duration, and status.
 */

import { projectFs } from '../workspace/project-fs';
import { dockerSandbox } from '../sandbox/docker-provider';
import { RunMode } from '../types';

export interface ToolExecutionContext {
  projectId: string;
  mode: RunMode;
  workspacePath: string;
}

export interface StructuredToolResult {
  tool: string;
  success: boolean;
  output: any;
  error?: string;
  timestamp: string;
}

export class ToolRegistry {
  private static instance: ToolRegistry | null = null;

  public static getInstance(): ToolRegistry {
    if (!ToolRegistry.instance) {
      ToolRegistry.instance = new ToolRegistry();
    }
    return ToolRegistry.instance;
  }

  /**
   * Executes a requested tool with strict mode validation and real execution.
   */
  public async execute(
    name: string,
    args: Record<string, any>,
    ctx: ToolExecutionContext
  ): Promise<StructuredToolResult> {
    const timestamp = new Date().toISOString();

    // 1. Enforce BUILD vs ASK Mode Distinction
    const mutatingTools = ['write_file', 'patch_file', 'create_directory', 'delete_file', 'execute_command', 'git_commit', 'start_app', 'stop_app', 'restart_app'];
    if (ctx.mode === 'ASK' && mutatingTools.includes(name)) {
      return {
        tool: name,
        success: false,
        output: null,
        error: `Permission Denied: '${name}' modifies project state. ASK mode is strictly read-only. Switch to BUILD mode to apply modifications.`,
        timestamp,
      };
    }

    try {
      switch (name) {
        // Filesystem Tools
        case 'list_files': {
          const files = await projectFs.listFiles(ctx.projectId, args.dirPath || '');
          return { tool: name, success: true, output: files, timestamp };
        }

        case 'read_file': {
          if (!args.filePath) throw new Error("Missing 'filePath' argument");
          const content = await projectFs.readFile(ctx.projectId, args.filePath);
          return { tool: name, success: true, output: { filePath: args.filePath, content }, timestamp };
        }

        case 'write_file': {
          if (!args.filePath) throw new Error("Missing 'filePath' argument");
          if (typeof args.content !== 'string') throw new Error("Missing or invalid 'content' argument");
          await projectFs.writeFile(ctx.projectId, args.filePath, args.content);
          return { tool: name, success: true, output: { filePath: args.filePath, writtenBytes: args.content.length }, timestamp };
        }

        case 'patch_file': {
          if (!args.filePath || !args.search || args.replace === undefined) {
            throw new Error("patch_file requires 'filePath', 'search', and 'replace'");
          }
          await projectFs.patchFile(ctx.projectId, args.filePath, args.search, args.replace);
          return { tool: name, success: true, output: { filePath: args.filePath, patched: true }, timestamp };
        }

        case 'search_files': {
          if (!args.query) throw new Error("Missing 'query' argument");
          const matches = await projectFs.searchFiles(ctx.projectId, args.query);
          return { tool: name, success: true, output: { query: args.query, matchesCount: matches.length, matches }, timestamp };
        }

        case 'create_directory': {
          if (!args.dirPath) throw new Error("Missing 'dirPath' argument");
          await projectFs.createDirectory(ctx.projectId, args.dirPath);
          return { tool: name, success: true, output: { dirPath: args.dirPath, created: true }, timestamp };
        }

        case 'delete_file': {
          if (!args.filePath) throw new Error("Missing 'filePath' argument");
          await projectFs.deleteFile(ctx.projectId, args.filePath);
          return { tool: name, success: true, output: { filePath: args.filePath, deleted: true }, timestamp };
        }

        // Docker Sandbox Command Execution (Zero Host Execution)
        case 'execute_command': {
          if (!args.command) throw new Error("Missing 'command' argument");
          const execResult = await dockerSandbox.executeCommand(ctx.projectId, ctx.workspacePath, args.command, {
            timeoutMs: args.timeoutMs,
          });
          return {
            tool: name,
            success: execResult.exitCode === 0,
            output: execResult,
            error: execResult.exitCode !== 0 ? execResult.stderr || 'Command exited with non-zero status' : undefined,
            timestamp,
          };
        }

        case 'run_tests': {
          const testResult = await dockerSandbox.runTests(ctx.projectId, ctx.workspacePath, args.testCommand || 'npm test');
          return {
            tool: name,
            success: testResult.success,
            output: testResult,
            error: !testResult.success ? `Tests failed: ${testResult.failed} failures` : undefined,
            timestamp,
          };
        }

        case 'run_build': {
          const buildResult = await dockerSandbox.runBuild(ctx.projectId, ctx.workspacePath, args.buildCommand || 'npm run build');
          return {
            tool: name,
            success: buildResult.success,
            output: buildResult,
            error: !buildResult.success ? `Build failed with ${buildResult.errors.length} error(s)` : undefined,
            timestamp,
          };
        }

        case 'inspect_process': {
          const status = dockerSandbox.getAppStatus(ctx.projectId);
          return { tool: name, success: true, output: status, timestamp };
        }

        case 'inspect_logs': {
          const logs = dockerSandbox.getAppLogs(ctx.projectId, args.maxLines || 100);
          return { tool: name, success: true, output: { lines: logs.length, logs }, timestamp };
        }

        case 'start_app': {
          const appInfo = await dockerSandbox.startApp(ctx.projectId, ctx.workspacePath, args.port || 3000);
          return { tool: name, success: true, output: appInfo, timestamp };
        }

        case 'stop_app': {
          await dockerSandbox.stopApp(ctx.projectId);
          return { tool: name, success: true, output: { stopped: true }, timestamp };
        }

        case 'restart_app': {
          const restarted = await dockerSandbox.restartApp(ctx.projectId, ctx.workspacePath, args.port || 3000);
          return { tool: name, success: true, output: restarted, timestamp };
        }

        // Git Tools
        case 'git_status': {
          const status = await projectFs.gitStatus(ctx.projectId);
          return { tool: name, success: true, output: { status }, timestamp };
        }

        case 'git_diff': {
          const diff = await projectFs.gitDiff(ctx.projectId);
          return { tool: name, success: true, output: { diff }, timestamp };
        }

        case 'git_commit': {
          if (!args.message) throw new Error("Missing 'message' argument");
          const commitResult = await projectFs.gitCommit(ctx.projectId, args.message);
          return { tool: name, success: true, output: { commit: commitResult }, timestamp };
        }

        case 'git_branch': {
          const branch = await projectFs.gitBranch(ctx.projectId);
          return { tool: name, success: true, output: { branch }, timestamp };
        }

        default:
          return {
            tool: name,
            success: false,
            output: null,
            error: `Unknown tool: '${name}'`,
            timestamp,
          };
      }
    } catch (err: any) {
      return {
        tool: name,
        success: false,
        output: null,
        error: err.message || 'Tool execution error',
        timestamp,
      };
    }
  }

  public getAvailableTools(mode: RunMode): Array<{ name: string; description: string; parameters: Record<string, string> }> {
    const allTools = [
      { name: 'list_files', description: 'Lists files in the project workspace directory', parameters: { dirPath: 'optional sub-directory' } },
      { name: 'read_file', description: 'Reads content of a file in the project workspace', parameters: { filePath: 'relative path to file' } },
      { name: 'search_files', description: 'Searches text across files in project workspace', parameters: { query: 'search string' } },
      { name: 'write_file', description: 'Writes complete file content (BUILD mode only)', parameters: { filePath: 'relative path', content: 'string content' } },
      { name: 'patch_file', description: 'Replaces specific snippet inside a file (BUILD mode only)', parameters: { filePath: 'path', search: 'exact substring', replace: 'new content' } },
      { name: 'create_directory', description: 'Creates a directory path in workspace (BUILD mode only)', parameters: { dirPath: 'relative path' } },
      { name: 'delete_file', description: 'Deletes a file in workspace (BUILD mode only)', parameters: { filePath: 'relative path' } },
      { name: 'execute_command', description: 'Executes command inside isolated Docker sandbox container (BUILD mode only)', parameters: { command: 'shell command' } },
      { name: 'run_tests', description: 'Runs automated tests inside Docker sandbox container', parameters: { testCommand: 'optional command' } },
      { name: 'run_build', description: 'Runs production build inside Docker sandbox container', parameters: { buildCommand: 'optional build command' } },
      { name: 'inspect_process', description: 'Inspects project runtime process status', parameters: {} },
      { name: 'inspect_logs', description: 'Retrieves application and execution logs', parameters: { maxLines: 'optional line limit' } },
      { name: 'git_status', description: 'Returns git status of the project workspace', parameters: {} },
      { name: 'git_diff', description: 'Returns uncommitted git diff of the project workspace', parameters: {} },
      { name: 'git_commit', description: 'Creates a git commit checkpoint (BUILD mode only)', parameters: { message: 'commit message' } },
    ];

    if (mode === 'ASK') {
      return allTools.filter((t) => !['write_file', 'patch_file', 'create_directory', 'delete_file', 'execute_command', 'git_commit'].includes(t.name));
    }
    return allTools;
  }
}

export const toolRegistry = ToolRegistry.getInstance();
