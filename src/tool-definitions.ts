export const toolDefinitions = [
  {
    name: 'zkvm_add',
    description: 'Perform addition of two numbers using RISC Zero zkVM and return the result with ZK proof receipt',
    inputSchema: {
      type: 'object',
      properties: {
        a: {
          type: 'number',
          description: 'First number to add',
        },
        b: {
          type: 'number',
          description: 'Second number to add',
        },
        forceRebuild: {
          type: 'boolean',
          description: 'Whether to rebuild the project from scratch (slower but ensures fresh build)',
          default: false
        }
      },
      required: ['a', 'b'],
    },
  },
  {
    name: 'zkvm_multiply',
    description: 'Perform multiplication of two numbers using RISC Zero zkVM and return the result with ZK proof receipt',
    inputSchema: {
      type: 'object',
      properties: {
        a: {
          type: 'number',
          description: 'First number to multiply',
        },
        b: {
          type: 'number',
          description: 'Second number to multiply',
        },
        forceRebuild: {
          type: 'boolean',
          description: 'Whether to rebuild the project from scratch (slower but ensures fresh build)',
          default: false
        }
      },
      required: ['a', 'b'],
    },
  },
  {
    name: 'zkvm_sqrt',
    description: 'Compute square root of a decimal number using RISC Zero zkVM and return the result with ZK proof receipt',
    inputSchema: {
      type: 'object',
      properties: {
        n: {
          type: 'number',
          description: 'Decimal number to compute square root for (must be non-negative)',
        },
        forceRebuild: {
          type: 'boolean',
          description: 'Whether to rebuild the project from scratch (slower but ensures fresh build)',
          default: false
        }
      },
      required: ['n'],
    },
  },
  {
    name: 'zkvm_modexp',
    description: 'Perform modular exponentiation (a^b mod n) using RISC Zero zkVM and return the result with ZK proof receipt',
    inputSchema: {
      type: 'object',
      properties: {
        base: {
          type: 'number',
          description: 'Base number (a)',
        },
        exponent: {
          type: 'number',
          description: 'Exponent (b)',
        },
        modulus: {
          type: 'number',
          description: 'Modulus (n)',
        },
        forceRebuild: {
          type: 'boolean',
          description: 'Whether to rebuild the project from scratch (slower but ensures fresh build)',
          default: false
        }
      },
      required: ['base', 'exponent', 'modulus'],
    },
  },
  {
    name: 'zkvm_range',
    description: 'Prove that a secret number is within a specified range using RISC Zero zkVM without revealing the secret number',
    inputSchema: {
      type: 'object',
      properties: {
        secretNumber: {
          type: 'number',
          description: 'Secret number to prove is in range (will remain private)',
        },
        minValue: {
          type: 'number',
          description: 'Minimum value of the range (inclusive)',
        },
        maxValue: {
          type: 'number',
          description: 'Maximum value of the range (inclusive)',
        },
        forceRebuild: {
          type: 'boolean',
          description: 'Whether to rebuild the project from scratch (slower but ensures fresh build)',
          default: false
        }
      },
      required: ['secretNumber', 'minValue', 'maxValue'],
    },
  },
  {
    name: 'verify_proof',
    description: 'Verify a RISC Zero proof from a .bin file and extract the computation result',
    inputSchema: {
      type: 'object',
      properties: {
        proofFilePath: {
          type: 'string',
          description: 'Path to the .bin proof file to verify',
        }
      },
      required: ['proofFilePath'],
    },
  },
  {
    name: 'zkvm_run_rust_file',
    description: 'Execute arbitrary Rust code from a file using RISC Zero zkVM and return the result with ZK proof',
    inputSchema: {
      type: 'object',
      properties: {
        rustFilePath: {
          type: 'string',
          description: 'Path to the Rust file (.rs) containing the guest program code',
        },
        inputs: {
          type: 'array',
          description: 'Array of inputs to pass to the Rust program (will be serialized as JSON)',
          items: {
            type: 'any'
          },
          default: []
        },
        forceRebuild: {
          type: 'boolean',
          description: 'Whether to force recompilation of the Rust code',
          default: false
        }
      },
      required: ['rustFilePath'],
    },
  },
  {
    name: 'zkvm_run_rust_code',
    description: 'Execute arbitrary Rust code from text input using RISC Zero zkVM and return the result with ZK proof',
    inputSchema: {
      type: 'object',
      properties: {
        rustCode: {
          type: 'string',
          description: 'Rust source code for the guest program (must include main function)',
        },
        inputs: {
          type: 'array',
          description: 'Array of inputs to pass to the Rust program (will be serialized as JSON)',
          items: {
            type: 'any'
          },
          default: []
        },
        forceRebuild: {
          type: 'boolean',
          description: 'Whether to force recompilation of the Rust code',
          default: false
        }
      },
      required: ['rustCode'],
    },
  },
  {
    name: 'zkvm_authenticated_add',
    description: 'Perform addition with cryptographic signature proving authenticity using stored private key',
    inputSchema: {
      type: 'object',
      properties: {
        a: {
          type: 'number',
          description: 'First number to add',
        },
        b: {
          type: 'number',
          description: 'Second number to add',
        },
        keyId: {
          type: 'string',
          description: 'Identifier for the private key stored in keys/ directory (e.g., "default")',
          default: 'default'
        },
        forceRebuild: {
          type: 'boolean',
          description: 'Whether to rebuild the project from scratch (slower but ensures fresh build)',
          default: false
        }
      },
      required: ['a', 'b'],
    },
  },
  {
    name: 'zkvm_authenticated_multiply',
    description: 'Perform multiplication with cryptographic signature proving authenticity using stored private key',
    inputSchema: {
      type: 'object',
      properties: {
        a: {
          type: 'number',
          description: 'First number to multiply',
        },
        b: {
          type: 'number',
          description: 'Second number to multiply',
        },
        keyId: {
          type: 'string',
          description: 'Identifier for the private key stored in keys/ directory (e.g., "default")',
          default: 'default'
        },
        forceRebuild: {
          type: 'boolean',
          description: 'Whether to rebuild the project from scratch (slower but ensures fresh build)',
          default: false
        }
      },
      required: ['a', 'b'],
    },
  },
  {
    name: 'zkvm_authenticated_sqrt',
    description: 'Compute square root with cryptographic signature proving authenticity using stored private key',
    inputSchema: {
      type: 'object',
      properties: {
        n: {
          type: 'number',
          description: 'Decimal number to compute square root for (must be non-negative)',
        },
        keyId: {
          type: 'string',
          description: 'Identifier for the private key stored in keys/ directory (e.g., "default")',
          default: 'default'
        },
        forceRebuild: {
          type: 'boolean',
          description: 'Whether to rebuild the project from scratch (slower but ensures fresh build)',
          default: false
        }
      },
      required: ['n'],
    },
  },
  {
    name: 'zkvm_authenticated_modexp',
    description: 'Perform modular exponentiation with cryptographic signature proving authenticity using stored private key',
    inputSchema: {
      type: 'object',
      properties: {
        base: {
          type: 'number',
          description: 'Base number (a)',
        },
        exponent: {
          type: 'number',
          description: 'Exponent (b)',
        },
        modulus: {
          type: 'number',
          description: 'Modulus (n)',
        },
        keyId: {
          type: 'string',
          description: 'Identifier for the private key stored in keys/ directory (e.g., "default")',
          default: 'default'
        },
        forceRebuild: {
          type: 'boolean',
          description: 'Whether to rebuild the project from scratch (slower but ensures fresh build)',
          default: false
        }
      },
      required: ['base', 'exponent', 'modulus'],
    },
  },
  {
    name: 'zkvm_authenticated_range',
    description: 'Prove that a secret number is within a range with cryptographic signature proving authenticity using stored private key',
    inputSchema: {
      type: 'object',
      properties: {
        secretNumber: {
          type: 'number',
          description: 'Secret number to prove is in range (will remain private)',
        },
        minValue: {
          type: 'number',
          description: 'Minimum value of the range (inclusive)',
        },
        maxValue: {
          type: 'number',
          description: 'Maximum value of the range (inclusive)',
        },
        keyId: {
          type: 'string',
          description: 'Identifier for the private key stored in keys/ directory (e.g., "default")',
          default: 'default'
        },
        forceRebuild: {
          type: 'boolean',
          description: 'Whether to rebuild the project from scratch (slower but ensures fresh build)',
          default: false
        }
      },
      required: ['secretNumber', 'minValue', 'maxValue'],
    },
  }
];