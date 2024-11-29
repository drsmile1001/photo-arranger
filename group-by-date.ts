import { existsSync } from "https://deno.land/std@0.224.0/fs/mod.ts";
import { format } from "date-fns";
const sourceDir = Deno.args[0];
if (!sourceDir) {
  console.error("Please provide source directory");
  Deno.exit(1);
}
if (!existsSync(sourceDir)) {
  console.error("Source directory does not exist");
  Deno.exit(1);
}
const photoNameRegex = /([A-Z]{3})_(\d{4})\.([A-Z0-9]{3})/;

type FileRecord = {
  date: string;
  fullPath: string;
  directory: string;
  fileName: string;
  prefix: string;
  index: number;
  indexStr: string;
  extension: string;
};

async function readAllFiles(dir: string): Promise<FileRecord[]> {
  const dateFiles: FileRecord[] = [];
  for await (const element of Deno.readDir(dir)) {
    if (element.isDirectory) {
      const files = await readAllFiles(`${dir}/${element.name}`);
      dateFiles.push(...files);
    } else {
      const match = photoNameRegex.exec(element.name);
      if (!match) continue;
      const stats = await Deno.stat(`${dir}/${element.name}`);
      const date = format(stats.mtime!, "yyyyMMdd");
      dateFiles.push({
        date,
        fullPath: `${dir}/${element.name}`,
        directory: dir,
        fileName: element.name,
        prefix: match[1],
        index: parseInt(match[2]),
        indexStr: match[2],
        extension: match[3],
      });
    }
  }
  return dateFiles;
}

const files = await readAllFiles(sourceDir);

const dateGroups = files.reduce((acc, file) => {
  if (!acc.has(file.date)) {
    acc.set(file.date, []);
  }
  acc.get(file.date)!.push(file);
  return acc;
}, new Map<string, FileRecord[]>());

for (const [date, files] of dateGroups.entries()) {
  const sorted = files.sort((a, b) =>
    a.directory.localeCompare(b.directory) || a.index - b.index
  );
  let latestIndex = 0;
  let extraIndex = 0;
  const operations: {
    source: string;
    destination: string;
    destinationWithExtra: string;
  }[] = [];
  for (const file of sorted) {
    if (file.index < latestIndex) {
      extraIndex++;
    }
    const destination =
      `${sourceDir}/${date}/${file.prefix}_${file.indexStr}.${file.extension}`;
    const destinationWithExtra =
      `${sourceDir}/${date}/${file.prefix}_${extraIndex}${file.indexStr}.${file.extension}`;
    operations.push({
      source: file.fullPath,
      destination,
      destinationWithExtra,
    });
    latestIndex = file.index;
  }
  await Deno.mkdir(`${sourceDir}/${date}`, { recursive: true });
  if (extraIndex > 0) {
    console.log(`Extra index for ${date}: ${extraIndex}`);
    for (const element of operations) {
      await Deno.rename(element.source, element.destinationWithExtra);
    }
  } else {
    console.log(`No extra index for ${date}`);
    for (const element of operations) {
      await Deno.rename(element.source, element.destination);
    }
  }
}
