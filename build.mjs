import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JavaScriptObfuscator from "javascript-obfuscator";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WEB_DIR = path.join(__dirname, "web");
const DIST_DIR = path.join(__dirname, "dist");

/* =========================================================
   CLEAN DIST
========================================================= */

fs.rmSync(DIST_DIR, {
  recursive: true,
  force: true
});

fs.mkdirSync(DIST_DIR, {
  recursive: true
});

/* =========================================================
   BUILD
========================================================= */

for (const file of fs.readdirSync(WEB_DIR)) {
  const sourcePath = path.join(WEB_DIR, file);
  const targetPath = path.join(DIST_DIR, file);

  const stat = fs.statSync(sourcePath);

  /*
   * Copy directories without modification.
   */
  if (stat.isDirectory()) {
    fs.cpSync(sourcePath, targetPath, {
      recursive: true
    });

    continue;
  }

  /*
   * Obfuscate every JavaScript file.
   */
  if (file.endsWith(".js")) {
    const source =
      fs.readFileSync(
        sourcePath,
        "utf8"
      );

    const result =
      JavaScriptObfuscator.obfuscate(
        source,
        {
          compact: true,

          controlFlowFlattening: true,
          controlFlowFlatteningThreshold: 0.75,

          deadCodeInjection: true,
          deadCodeInjectionThreshold: 0.2,

          stringArray: true,
          stringArrayRotate: true,
          stringArrayShuffle: true,
          stringArrayThreshold: 0.75,

          splitStrings: true,
          splitStringsChunkLength: 8,

          simplify: true
        }
      );

    fs.writeFileSync(
      targetPath,
      result.getObfuscatedCode(),
      "utf8"
    );

    console.log(
      `Obfuscated: ${file}`
    );

    continue;
  }

  /*
   * Copy all non-JavaScript files unchanged.
   */
  fs.copyFileSync(
    sourcePath,
    targetPath
  );

  console.log(
    `Copied: ${file}`
  );
}

console.log(
  "Build completed: dist/"
);