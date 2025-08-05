import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

export const execAsync = promisify(exec);

export class ProjectUtils {
  static async ensureProjectExists(projectPath: string, forceRebuild: boolean = false): Promise<void> {
    if (!fs.existsSync(projectPath)) {
      throw new Error(`RISC Zero project not found at ${projectPath}. Please ensure the risc0code project exists.`);
    }
    
    const targetPath = path.join(projectPath, 'target');
    const needsBuild = forceRebuild || !fs.existsSync(targetPath);
    
    if (needsBuild) {
      console.error('[Setup] Building RISC Zero project...');
      try {
        if (forceRebuild) {
          console.error('[Setup] Force rebuild requested, cleaning only target directory...');
          // Only clean the release target to speed up rebuild
          await execAsync('rm -rf target/release', { 
            cwd: projectPath,
            timeout: 30000 
          });
        }
        
        // Build only the host binary for faster rebuild
        console.error('[Setup] Building host binary only...');
        await execAsync('cargo build --release --bin host', { 
          cwd: projectPath,
          timeout: 120000, // 2 minutes timeout for host build only
          env: {
            ...process.env,
            RISC0_DEV_MODE: '0'
          }
        });
        
        console.error('[Setup] RISC Zero host binary built successfully');
      } catch (error) {
        throw new Error(`Failed to build RISC Zero project: ${error instanceof Error ? error.message : String(error)}`);
      }
    } else {
      console.error('[Setup] RISC Zero project already built, skipping build');
    }
  }

  static parseJsonFromOutput(stdout: string): any {
    const lines = stdout.split('\n');
    let jsonStart = -1;
    let jsonEnd = -1;
    
    // Find the line that starts with '{'
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('{')) {
        jsonStart = i;
        break;
      }
    }
    
    // Find the line that ends with '}'
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].trim().endsWith('}')) {
        jsonEnd = i;
        break;
      }
    }
    
    if (jsonStart >= 0 && jsonEnd >= 0) {
      const jsonLines = lines.slice(jsonStart, jsonEnd + 1);
      const jsonString = jsonLines.join('\n');
      return JSON.parse(jsonString);
    } else {
      throw new Error('Could not find JSON block in output');
    }
  }

  static containsUnsafeOperations(code: string): boolean {
    const unsafePatterns = [
      /std::fs/,
      /std::net/,
      /std::thread/,
      /std::process/,
      /unsafe\s*{/,
      /extern\s+"C"/,
      /libc::/,
      /__/,  // Double underscore functions (often internal/unsafe)
    ];
    
    return unsafePatterns.some(pattern => pattern.test(code));
  }

  static indentCode(code: string, spaces: number): string {
    const indent = ' '.repeat(spaces);
    return code.split('\n').map(line => indent + line).join('\n');
  }
}