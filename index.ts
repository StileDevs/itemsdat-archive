import { readFile, readdir, writeFile } from "fs/promises";
import { join } from "path";

export interface ItemInfo {
  content: string;
  hash: number;
}

export interface LatestConfig {
  latest: ItemInfo;
  old_items: ItemInfo[];
}

export function protonSDKHash(chunk: Uint8Array | Buffer | number[]): number {
  let hash = 0x55555555;
  for (let i = 0; i < chunk.length; i++) {
    hash = (hash >>> 27) + (hash << 5) + (chunk[i] as number);
  }
  return hash;
}

export function parseVersion(filename: string) {
  const match = filename.match(
    /^items-v(\d+)\.(\d+)(?:\.(\d+))?(-[a-zA-Z0-9]+)?\.dat$/,
  );
  if (!match) return { major: 0, minor: 0, patch: 0, tag: "" };
  return {
    major: parseInt(match[1]!, 10),
    minor: parseInt(match[2]!, 10),
    patch: match[3] ? parseInt(match[3], 10) : 0,
    tag: match[4] || "",
  };
}

export async function generateLatestJson(
  dir: string = ".",
): Promise<LatestConfig> {
  const files = await readdir(dir);
  const itemFiles = files.filter(
    (f) => f.startsWith("items-") && f.endsWith(".dat"),
  );

  itemFiles.sort((a, b) => {
    const va = parseVersion(a);
    const vb = parseVersion(b);
    if (va.major !== vb.major) return va.major - vb.major;
    if (va.minor !== vb.minor) return va.minor - vb.minor;
    if (va.patch !== vb.patch) return va.patch - vb.patch;
    return va.tag.localeCompare(vb.tag);
  });

  if (itemFiles.length === 0) {
    throw new Error("no items dat files found");
  }

  const items: ItemInfo[] = [];

  for (const file of itemFiles) {
    const filePath = join(dir, file);
    const data = await readFile(filePath);
    const hash = protonSDKHash(data);
    items.push({ content: file, hash });
  }

  const latest = items[items.length - 1]!;
  const old_items = items.slice(0, items.length - 1);

  const result: LatestConfig = {
    latest,
    old_items,
  };

  return result;
}

(async () => {
  const config = await generateLatestJson(".");
  await writeFile("latest.json", JSON.stringify(config, null, 2) + "\n");
  console.log("successfully generated latest.json with:", {
    latest: config.latest,
    oldItemsCount: config.old_items.length,
  });
})();
