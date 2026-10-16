import { describe, expect, it } from "vitest";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

async function sources(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? sources(file) : Promise.resolve(/\.(?:tsx?|html)$/.test(file) ? [file] : []);
  }));
  return nested.flat();
}

describe("English product copy", () => {
  it("keeps shipped UI literals and accessible text in English", async () => {
    const files = [...(await Promise.all(["src", "electron", "plugin/ui"].map(sources))).flat(), "index.html", "plugin/plugin.json"];
    const remaining: string[] = [];
    for (const file of files) {
      const text = await readFile(file, "utf8");
      if (/\.(html|json)$/.test(file)) {
        if (/\p{Script=Han}/u.test(text)) remaining.push(file);
        continue;
      }
      const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
      const visit = (node: ts.Node) => {
        if ((ts.isStringLiteralLike(node) || ts.isJsxText(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node) || ts.isTemplateHead(node)) && /\p{Script=Han}/u.test(node.text)) {
          // Legacy user-named caption tracks must remain discoverable in old projects.
          if (file.replaceAll("\\", "/") === "src/components/SubtitlePanel.tsx" && node.text === "字幕") return;
          const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
          remaining.push(`${file}:${line} ${node.text.slice(0, 100)}`);
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
    }
    expect(remaining, "Product text must be English; user-written project content is not part of this source scan.").toEqual([]);
  });
});
