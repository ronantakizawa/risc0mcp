#!/usr/bin/env node
import { RiscZeroCodeServer } from './server.js';

const server = new RiscZeroCodeServer();
server.run().catch(console.error);