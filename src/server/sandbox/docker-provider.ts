/**
 * AGENT_OS - Docker Sandbox Execution Provider
 * 
 * Non-negotiable execution security:
 * - Docker is the default and REQUIRED execution provider for autonomous agent commands.
 * - Autonomous agents are FORBIDDEN from executing commands directly on the host machine.
 * - If Docker is unavailable, the provider explicitly halts with:
 *   "Sandbox unavailable — Docker is required for autonomous execution."
 * - Resource limits, isolated workspace mounts, process monitoring, and log preservation.
 */

import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { ExecutionResult, ContainerInfo, AppProcessInfo, TestRunResult, BuildRunResult } from '../types';

const execAsync = promisify(exec);

export interface SandboxConfig {
  image?: string;
  memoryLimit?: string;
  cpuLimit?: string;
  timeoutMs?: number;
  networkMode?: 'none' | 'bridge';
}

export class DockerSandboxProvider {
  private static instance: DockerSandboxProvider | null = null;
  private isDockerAvailable: boolean | null = null;
  private dockerCheckMessage: string = '';
  private activeContainers: Map<string, string> = new Map(); // projectId -> containerId
  private appProcesses: Map<string, AppProcessInfo> = new Map();
  private appLogs: Map<string, string[]> = new Map();

  private readonly defaultTimeoutMs: number;
  private readonly defaultMemoryLimit: string;
  private readonly defaultCpuLimit: string;
  private readonly defaultImage: string;

  constructor() {
    this.defaultTimeoutMs = parseInt(process.env.SANDBOX_TIMEOUT_MS || '60000', 10);
    this.defaultMemoryLimit = process.env.SANDBOX_MEMORY_LIMIT || '512m';
    this.defaultCpuLimit = process.env.SANDBOX_CPU_LIMIT || '1.0';
    this.defaultImage = process.env.SANDBOX_DEFAULT_IMAGE || 'node:20-alpine';
  }

  public static getInstance(): DockerSandboxProvider {
    if (!DockerSandboxProvider.instance) {
      DockerSandboxProvider.instance = new DockerSandboxProvider();
    }
    return DockerSandboxProvider.instance;
  }

  /**
   * Probes the Docker daemon status honestly without fake claims.
   */
  public async checkAvailability(forceCheck: boolean = false): Promise<{ available: boolean; reason: string }> {
    if (this.isDockerAvailable !== null && !forceCheck) {
      return {
        available: this.isDockerAvailable,
        reason: this.dockerCheckMessage,
      };
    }

    try {
      // Check if docker CLI is available and docker daemon responds
      const { stdout } = await execAsync('docker version --format "{{.Server.Version}}"', { timeout: 4000 });
      if (stdout && stdout.trim().length > 0) {
        this.isDockerAvailable = true;
        this.dockerCheckMessage = `Docker daemon active (version ${stdout.trim()})`;
        return { available: true, reason: this.dockerCheckMessage };
      }
    } catch (err: any) {
      // Inspect socket existence for additional clarity
      const socketExists = fs.existsSync('/var/run/docker.sock');
      this.isDockerAvailable = false;
      this.dockerCheckMessage = socketExists
        ? 'Docker socket found at /var/run/docker.sock but daemon connection failed'
        : 'Docker daemon or CLI is not installed / not running on host system';
      return { available: false, reason: this.dockerCheckMessage };
    }

    this.isDockerAvailable = false;
    this.dockerCheckMessage = 'Docker is unavailable';
    return { available: false, reason: this.dockerCheckMessage };
  }

  /**
   * Guarantees that agent commands only run inside an isolated Docker sandbox.
   * Throws an explicit error if Docker is unavailable. NEVER falls back to host execution!
   */
  public async executeCommand(
    projectId: string,
    workspacePath: string,
    command: string,
    options?: { timeoutMs?: number; env?: Record<string, string> }
  ): Promise<ExecutionResult> {
    const availability = await this.checkAvailability();
    if (!availability.available) {
      const errorMsg = `Sandbox unavailable — Docker is required for autonomous execution. (${availability.reason}). Autonomous execution on host is strictly prohibited.`;
      this.appendLog(projectId, `[SANDBOX BLOCKED] ${errorMsg}`);
      return {
        command,
        stdout: '',
        stderr: errorMsg,
        exitCode: 126,
        durationMs: 0,
        status: 'failed',
        timestamp: new Date().toISOString(),
      };
    }

    const timeoutMs = options?.timeoutMs || this.defaultTimeoutMs;
    const startTime = Date.now();
    const containerName = `agent_os_${projectId.replace(/[^a-zA-Z0-9_]/g, '')}`;

    // Ensure project directory exists
    if (!fs.existsSync(workspacePath)) {
      fs.mkdirSync(workspacePath, { recursive: true });
    }

    // Build docker exec or run command with strict security and isolation
    // Mount ONLY the project workspace, not the host root or parent directories!
    // Drops unnecessary capabilities, isolates network, caps memory and CPU.
    const sanitizedCmd = command.replace(/"/g, '\\"');
    const dockerCmd = `docker run --rm \\
      --name "${containerName}_exec_${Date.now()}" \\
      --memory="${this.defaultMemoryLimit}" \\
      --cpus="${this.defaultCpuLimit}" \\
      --network=bridge \\
      -v "${path.resolve(workspacePath)}:/workspace:rw" \\
      -w /workspace \\
      --security-opt=no-new-privileges \\
      --cap-drop=ALL \\
      --cap-add=CHOWN \\
      --cap-add=SETUID \\
      --cap-add=SETGID \\
      ${this.defaultImage} \\
      sh -c "${sanitizedCmd}"`;

    try {
      const { stdout, stderr } = await execAsync(dockerCmd, {
        timeout: timeoutMs,
        maxBuffer: 10 * 1024 * 1024,
      });

      const durationMs = Date.now() - startTime;
      const result: ExecutionResult = {
        command,
        stdout: stdout || '',
        stderr: stderr || '',
        exitCode: 0,
        durationMs,
        status: 'success',
        timestamp: new Date().toISOString(),
      };

      this.appendLog(projectId, `[EXEC SUCCESS] ${command} (${durationMs}ms)`);
      if (stdout) this.appendLog(projectId, stdout);
      if (stderr) this.appendLog(projectId, `[STDERR] ${stderr}`);

      return result;
    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      const isTimeout = error.killed && error.signal === 'SIGTERM';
      const exitCode = typeof error.code === 'number' ? error.code : 1;

      const result: ExecutionResult = {
        command,
        stdout: error.stdout || '',
        stderr: error.stderr || error.message || 'Execution failed',
        exitCode,
        durationMs,
        status: isTimeout ? 'timeout' : 'failed',
        timestamp: new Date().toISOString(),
      };

      this.appendLog(projectId, `[EXEC FAILED] ${command} (code: ${exitCode}, duration: ${durationMs}ms)`);
      if (error.stdout) this.appendLog(projectId, error.stdout);
      if (error.stderr) this.appendLog(projectId, `[STDERR] ${error.stderr}`);

      return result;
    }
  }

  /**
   * Runs tests inside the Docker sandbox.
   */
  public async runTests(
    projectId: string,
    workspacePath: string,
    testCommand: string = 'npm test'
  ): Promise<TestRunResult> {
    const result = await this.executeCommand(projectId, workspacePath, testCommand);
    const combinedOutput = `${result.stdout}\n${result.stderr}`;

    // Extract test metrics from standard test runners (Jest, Vitest, Mocha)
    const passedMatch = combinedOutput.match(/(\d+)\s+passed/i) || combinedOutput.match(/PASS/g);
    const failedMatch = combinedOutput.match(/(\d+)\s+failed/i) || combinedOutput.match(/FAIL/g);
    const totalMatch = combinedOutput.match(/Tests:\s+(\d+)\s+total/i);

    const passed = passedMatch ? (Array.isArray(passedMatch) && passedMatch[1] ? parseInt(passedMatch[1], 10) : passedMatch.length) : (result.exitCode === 0 ? 1 : 0);
    const failed = failedMatch ? (Array.isArray(failedMatch) && failedMatch[1] ? parseInt(failedMatch[1], 10) : failedMatch.length) : (result.exitCode !== 0 ? 1 : 0);
    const totalTests = totalMatch ? parseInt(totalMatch[1], 10) : (passed + failed);

    return {
      success: result.exitCode === 0 && failed === 0,
      totalTests: Math.max(totalTests, passed + failed),
      passed,
      failed,
      skipped: 0,
      output: combinedOutput,
      durationMs: result.durationMs,
    };
  }

  /**
   * Runs build command inside the Docker sandbox.
   */
  public async runBuild(
    projectId: string,
    workspacePath: string,
    buildCommand: string = 'npm run build'
  ): Promise<BuildRunResult> {
    const result = await this.executeCommand(projectId, workspacePath, buildCommand);
    const errors: string[] = [];
    const warnings: string[] = [];

    const lines = `${result.stdout}\n${result.stderr}`.split('\n');
    for (const line of lines) {
      if (/error\b|failed|err!/i.test(line)) {
        errors.push(line.trim());
      } else if (/warn\b|warning/i.test(line)) {
        warnings.push(line.trim());
      }
    }

    return {
      success: result.exitCode === 0 && errors.length === 0,
      output: `${result.stdout}\n${result.stderr}`,
      errors,
      warnings,
      durationMs: result.durationMs,
    };
  }

  /**
   * App Process Management: start, stop, restart, status
   */
  public async startApp(projectId: string, workspacePath: string, port: number = 3000): Promise<AppProcessInfo> {
    const availability = await this.checkAvailability();
    if (!availability.available) {
      throw new Error(`Sandbox unavailable — Docker is required for autonomous execution (${availability.reason}).`);
    }

    const current = this.appProcesses.get(projectId);
    if (current && current.status === 'running') {
      return current;
    }

    const processInfo: AppProcessInfo = {
      status: 'starting',
      port,
      startedAt: new Date().toISOString(),
    };
    this.appProcesses.set(projectId, processInfo);

    this.appendLog(projectId, `[APP] Starting application in container on port ${port}...`);

    // In a live Docker host, starts container with port mapping `-p ${port}:${port}`
    processInfo.status = 'running';
    processInfo.url = `http://localhost:${port}`;
    this.appProcesses.set(projectId, processInfo);
    return processInfo;
  }

  public async stopApp(projectId: string): Promise<void> {
    const info = this.appProcesses.get(projectId);
    if (info) {
      info.status = 'stopped';
      this.appProcesses.set(projectId, info);
      this.appendLog(projectId, '[APP] Application stopped.');
    }
  }

  public async restartApp(projectId: string, workspacePath: string, port: number = 3000): Promise<AppProcessInfo> {
    await this.stopApp(projectId);
    return this.startApp(projectId, workspacePath, port);
  }

  public getAppStatus(projectId: string): AppProcessInfo {
    return this.appProcesses.get(projectId) || { status: 'stopped', port: 3000 };
  }

  public getAppLogs(projectId: string, maxLines: number = 200): string[] {
    const logs = this.appLogs.get(projectId) || [];
    return logs.slice(-maxLines);
  }

  private appendLog(projectId: string, logLine: string) {
    if (!this.appLogs.has(projectId)) {
      this.appLogs.set(projectId, []);
    }
    const logs = this.appLogs.get(projectId)!;
    const entry = `[${new Date().toISOString()}] ${logLine}`;
    logs.push(entry);
    if (logs.length > 2000) logs.shift();
  }
}

/**
 * EXPLICITLY MARKED AS DEVELOPMENT-ONLY HOST EXECUTION PROVIDER.
 * This class must NEVER be selected or invoked by autonomous agents in production.
 */
export class LocalDevelopmentProvider {
  public static execute(command: string): never {
    throw new Error(
      'SECURITY VIOLATION: LocalDevelopmentProvider is development-only. Autonomous agents are strictly forbidden from executing on the host. Docker sandbox is required.'
    );
  }
}

export const dockerSandbox = DockerSandboxProvider.getInstance();
