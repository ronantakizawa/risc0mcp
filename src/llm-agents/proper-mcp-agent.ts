import OpenAI from 'openai';
import { spawn, ChildProcess } from 'child_process';

export interface Message {
  from: string;
  to: string;
  type: 'claim' | 'proof' | 'verification' | 'chat';
  content: string;
  timestamp: number;
  toolCalls?: any[];
  toolResults?: any[];
  proofData?: string;
  proofSize?: number;
}

export abstract class ProperMCPAgent {
  protected openai: OpenAI;
  protected name: string;
  protected mcpProcess: ChildProcess | null = null;
  protected conversationHistory: Message[] = [];
  protected toolDefinitions: any[] = [];
  protected currentMessage: Message | null = null;

  constructor(name: string, apiKey: string) {
    this.name = name;
    this.openai = new OpenAI({
      apiKey: apiKey
    });
  }

  protected async startMCPServer(): Promise<void> {
    if (this.mcpProcess) {
      return;
    }

    console.log(`[${this.name}] Starting MCP server...`);
    
    const env = {
      ...process.env,
      RISC0_KEY_PASSWORD: 'secure-test-password-2024'
    };

    this.mcpProcess = spawn('node', ['dist/index.js'], {
      cwd: process.cwd(),
      env,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Get tool definitions from the server
    await this.loadToolDefinitions();

    console.log(`[${this.name}] MCP server ready with ${this.toolDefinitions.length} tools`);
  }

  private async loadToolDefinitions(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Tool loading timeout')), 15000);

      const request = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list'
      };

      let responseBuffer = '';
      
      const onData = (data: Buffer) => {
        responseBuffer += data.toString();
        
        try {
          const lines = responseBuffer.split('\n');
          for (const line of lines) {
            if (line.trim() && line.includes('"result"')) {
              const response = JSON.parse(line);
              if (response.id === 1 && response.result) {
                clearTimeout(timeout);
                this.mcpProcess!.stdout!.off('data', onData);
                this.toolDefinitions = response.result.tools;
                console.log(`[${this.name}] Loaded ${this.toolDefinitions.length} tool definitions`);
                resolve();
                return;
              }
            }
          }
        } catch (e) {
          // Not complete JSON yet
        }
      };

      this.mcpProcess!.stdout!.on('data', onData);
      this.mcpProcess!.stdin!.write(JSON.stringify(request) + '\n');
    });
  }

  protected async callLLMWithTools(systemPrompt: string, userMessage: string, message?: Message): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    // Store current message for proof data injection
    if (message) {
      this.currentMessage = message;
    }
    try {
      // Convert MCP tool definitions to OpenAI function format
      const functions = this.toolDefinitions.map(tool => ({
        type: 'function' as const,
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema
        }
      }));

      console.log(`[${this.name}] Calling LLM with ${functions.length} available tools`);

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        tools: functions,
        tool_choice: 'auto', // Let the LLM decide whether to use tools
        temperature: 0.7,
        max_tokens: 1500
      });

      return completion;
    } catch (error) {
      console.error(`[${this.name}] OpenAI API error:`, error);
      throw error;
    }
  }

  protected async executeMCPTool(toolName: string, args: any): Promise<any> {
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
      const timeout = setTimeout(() => reject(new Error('MCP call timeout')), 6000000); // 100 minutes for complex ML compilation

      let responseBuffer = '';
      
      const onData = (data: Buffer) => {
        responseBuffer += data.toString();
        
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
          // Not complete JSON yet
        }
      };

      this.mcpProcess!.stdout!.on('data', onData);
      this.mcpProcess!.stdin!.write(JSON.stringify(request) + '\n');
    });
  }

  protected async processLLMResponse(completion: OpenAI.Chat.Completions.ChatCompletion): Promise<any> {
    const message = completion.choices[0].message;
    
    if (!message.tool_calls || message.tool_calls.length === 0) {
      // No tool calls, return the text response
      return {
        response: message.content || '',
        toolResults: [],
        toolCalls: []
      };
    }

    // LLM decided to call tools!
    console.log(`[${this.name}] LLM chose to call ${message.tool_calls.length} tool(s)`);
    
    let responses: string[] = [];
    let toolResults: any[] = [];

    for (const toolCall of message.tool_calls) {
      console.log(`[${this.name}] Executing tool: ${toolCall.function.name}`);
      console.log(`[${this.name}] Tool arguments:`, toolCall.function.arguments);

      try {
        let args = JSON.parse(toolCall.function.arguments);
        
        // Special handling for verify_proof_data - inject actual proof data from message
        if (toolCall.function.name === 'verify_proof_data' && this.currentMessage?.proofData) {
          console.log(`[${this.name}] Injecting actual proof data into tool arguments`);
          args.proofData = this.currentMessage.proofData;
          args.proofSize = this.currentMessage.proofSize;
        }
        
        const result = await this.executeMCPTool(toolCall.function.name, args);
        toolResults.push({
          toolName: toolCall.function.name,
          args,
          result
        });

        // Generate a follow-up completion with the tool results
        const followUpCompletion = await this.openai.chat.completions.create({
          model: 'gpt-4',
          messages: [
            { role: 'assistant', content: message.content, tool_calls: message.tool_calls },
            {
              role: 'tool',
              content: JSON.stringify(result, null, 2),
              tool_call_id: toolCall.id
            }
          ],
          temperature: 0.3, // Lower temperature for more consistent output
          max_tokens: 1500
        });

        const toolResponse = followUpCompletion.choices[0].message.content || '';
        responses.push(toolResponse);

      } catch (error) {
        console.error(`[${this.name}] Tool execution error:`, error);
        responses.push(`Error executing ${toolCall.function.name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return {
      response: responses.join('\n\n'),
      toolResults: toolResults,
      toolCalls: message.tool_calls || []
    };
  }

  protected addToHistory(message: Message): void {
    this.conversationHistory.push(message);
    console.log(`[${this.name}] Received message:`, {
      from: message.from,
      type: message.type,
      content: message.content.substring(0, 100) + (message.content.length > 100 ? '...' : '')
    });
  }

  protected getConversationContext(): string {
    return this.conversationHistory
      .slice(-5)
      .map(msg => `${msg.from}: ${msg.content}`)
      .join('\\n');
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