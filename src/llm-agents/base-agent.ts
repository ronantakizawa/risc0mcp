import OpenAI from 'openai';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface ZkProof {
  operation: string;
  inputs: any;
  result: number;
  imageId: string;
  verificationStatus: string;
  proofFilePath: string;
  authentication?: any;
}

export interface Message {
  from: string;
  to: string;
  type: 'claim' | 'proof' | 'verification' | 'chat';
  content: string;
  zkProof?: ZkProof;
  timestamp: number;
  toolCalls?: any[];
  toolResults?: any[];
}

export abstract class BaseLLMAgent {
  protected openai: OpenAI;
  protected name: string;
  protected mcpProcess: ChildProcess | null = null;
  protected conversationHistory: Message[] = [];

  constructor(name: string, apiKey: string) {
    this.name = name;
    this.openai = new OpenAI({
      apiKey: apiKey
    });
  }

  protected async startMCPServer(): Promise<void> {
    if (this.mcpProcess) {
      return; // Already running
    }

    console.log(`[${this.name}] Starting MCP server...`);
    
    // Set environment variable for key password
    const env = {
      ...process.env,
      RISC0_KEY_PASSWORD: 'secure-test-password-2024'
    };

    this.mcpProcess = spawn('node', ['dist/index.js'], {
      cwd: process.cwd(),
      env,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Wait for server to be ready
    await new Promise((resolve, reject) => {
      let output = '';
      const timeout = setTimeout(() => reject(new Error('MCP server startup timeout')), 10000);

      this.mcpProcess!.stdout!.on('data', (data) => {
        output += data.toString();
        console.log(`[${this.name}] MCP stdout:`, data.toString());
        if (output.includes('RISC Zero Code MCP server running on stdio')) {
          clearTimeout(timeout);
          resolve(void 0);
        }
      });

      this.mcpProcess!.stderr!.on('data', (data) => {
        const stderrOutput = data.toString();
        console.log(`[${this.name}] MCP stderr:`, stderrOutput);
        output += stderrOutput;
        if (output.includes('RISC Zero Code MCP server running on stdio')) {
          clearTimeout(timeout);
          resolve(void 0);
        }
      });

      this.mcpProcess!.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });

    console.log(`[${this.name}] MCP server ready`);
  }

  protected async callMCPTool(toolName: string, args: any): Promise<any> {
    if (!this.mcpProcess) {
      throw new Error('MCP server not started');
    }

    const request = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      }
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('MCP call timeout')), 120000); // 2 minutes

      let responseBuffer = '';
      
      const onData = (data: Buffer) => {
        responseBuffer += data.toString();
        
        // Look for complete JSON response
        try {
          const lines = responseBuffer.split('\n');
          for (const line of lines) {
            if (line.trim() && line.includes('"id"')) {
              const response = JSON.parse(line);
              if (response.id === request.id) {
                clearTimeout(timeout);
                this.mcpProcess!.stdout!.off('data', onData);
                
                if (response.error) {
                  reject(new Error(`MCP error: ${response.error.message}`));
                } else {
                  resolve(response.result);
                }
                return;
              }
            }
          }
        } catch (e) {
          // Not a complete JSON yet, continue waiting
        }
      };

      this.mcpProcess!.stdout!.on('data', onData);

      // Send request
      this.mcpProcess!.stdin!.write(JSON.stringify(request) + '\n');
    });
  }

  protected async chatWithGPT(systemPrompt: string, userMessage: string): Promise<string> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.7,
        max_tokens: 1000
      });

      return completion.choices[0].message.content || '';
    } catch (error) {
      console.error(`[${this.name}] OpenAI API error:`, error);
      throw error;
    }
  }

  protected addToHistory(message: Message): void {
    this.conversationHistory.push(message);
    console.log(`[${this.name}] Received message:`, {
      from: message.from,
      type: message.type,
      content: message.content.substring(0, 100) + (message.content.length > 100 ? '...' : ''),
      hasZkProof: !!message.zkProof
    });
  }

  protected getConversationContext(): string {
    return this.conversationHistory
      .slice(-5) // Last 5 messages for context
      .map(msg => `${msg.from}: ${msg.content}`)
      .join('\n');
  }

  public async cleanup(): Promise<void> {
    if (this.mcpProcess) {
      this.mcpProcess.kill();
      this.mcpProcess = null;
    }
  }

  public abstract handleMessage(message: Message): Promise<Message[]>;
  public abstract start(): Promise<void>;
}