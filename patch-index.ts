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
const photoNameRegex = /([A-Z]{3})_(\d{4})\.([A-Z]{3})/;
let sn = 0;
let index = 0;

for await (const element of Deno.readDir(sourceDir)) {
  if (!element.isDirectory) continue;
  for await (const subElement of Deno.readDir(`${sourceDir}/${element.name}`)) {
    if (!subElement.isFile) continue;
    const match = photoNameRegex.exec(subElement.name);
    if (!match) continue;
    const photoIndex = parseInt(match[2]);
    if (photoIndex < index) {
      sn++;
    }
    const oldName = `${sourceDir}/${element.name}/${subElement.name}`;
    const newName = `${sourceDir}/${element.name}/${match[1]}_${sn}${
      match[2]
    }.${match[3]}`;
    await Deno.rename(oldName, newName);
    index = photoIndex;
  }
}
