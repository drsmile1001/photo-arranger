import { existsSync } from "https://deno.land/std@0.224.0/fs/mod.ts";
const sourceDir = Deno.args[0];
if (!sourceDir) {
  console.error("Please provide source directory");
  Deno.exit(1);
}
if (!existsSync(sourceDir)) {
  console.error("Source directory does not exist");
  Deno.exit(1);
}
for await (const element of Deno.readDir(sourceDir)) {
  if (!element.isDirectory) continue;
  const childDir = `${sourceDir}/${element.name}`;
  const rawDir = `${childDir}/raw`;
  if (!existsSync(rawDir)) {
    Deno.mkdirSync(rawDir);
  }

  const jpgFiles: string[] = [];
  for await (const element of Deno.readDir(childDir)) {
    if (!element.isFile) continue;
    if (element.name.endsWith(".JPG")) {
      jpgFiles.push(element.name);
    }
    if (element.name.endsWith(".NEF")) {
      await Deno.rename(
        `${childDir}/${element.name}`,
        `${rawDir}/${element.name}`,
      );
    }
  }

  for await (const rawFile of Deno.readDir(rawDir)) {
    const nameWithoutExt = rawFile.name.split(".").slice(0, -1).join(".");
    const jpgFile = jpgFiles.find((jpg) => jpg.startsWith(nameWithoutExt));
    if (jpgFile) continue;
    await Deno.remove(`${rawDir}\\${rawFile.name}`);
  }
}

console.log("Done");
