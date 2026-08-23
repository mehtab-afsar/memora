#!/usr/bin/env node
/**
 * Agent-first signup: mints a working Memora API key with no email or
 * password, in one HTTP call to `POST /api/v1/agent-init`. A human claims
 * ownership later at the printed `claimUrl` — the key works either way.
 *
 * No dependencies, hand-rolled argv parsing: this is one command, and
 * `@memora/client` already sets the precedent of "fetch only, no deps".
 */
declare const DEFAULT_BASE_URL = "https://api.memora.dev";
declare function flagValue(argv: string[], name: string): string | undefined;
declare function usage(): void;
declare function initAgent(argv: string[]): Promise<void>;
declare function main(): Promise<void>;
