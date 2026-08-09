import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { EXPECTED_EXTENSION_VERSION } from "../../config/version";

function readRepoFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("version markers", () => {
  it("keeps Chrome manifest, extension payload markers, and app expectation aligned", () => {
    const manifest = JSON.parse(readRepoFile("extension/manifest.json")) as { version: string };
    const background = readRepoFile("extension/background.js");
    const appBridge = readRepoFile("extension/appBridge.js");

    expect(manifest.version).toBe(EXPECTED_EXTENSION_VERSION);
    expect(background).toContain(`const EXTENSION_VERSION = "${manifest.version}"`);
    expect(appBridge).toContain(`const EXTENSION_VERSION = "${manifest.version}"`);
  });
});
