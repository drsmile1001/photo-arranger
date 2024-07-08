import { readdir } from "node:fs/promises";
import { ExifDateTime, exiftool } from "exiftool-vendored";
import { format } from "date-fns";
const sourceFolder = "D:/Pictures/高中照片/高中_畢業旅行";
const outputFolder = "D:/Pictures/高中照片";

async function getAllExif(dirPath: string) {
  const dirents = await readdir(dirPath, {
    withFileTypes: true,
    recursive: true,
  });

  for (const dirent of dirents) {
    if (dirent.isDirectory()) {
      continue;
    } else {
      const ext = dirent.name.split(".").pop()?.toLocaleLowerCase();
      if (!["jpg", "nef"].includes(ext!)) {
        continue;
      }

      const source = `${dirent.parentPath}/${dirent.name}`;
      const tags = await exiftool.read(source);
      const toFolder = format(
        (tags.CreateDate as ExifDateTime).toDate(),
        "yyyyMMdd"
      );
      const folderFullPath = `${outputFolder}/${toFolder}`;
      const newFileName = `${outputFolder}/${toFolder}/${dirent.name}`;
      await Bun.$`mkdir -p "${folderFullPath}"`;
      await Bun.$`mv "${source}" "${newFileName}"`;
      console.log(`Moved ${source} to ${newFileName}`);
    }
  }
}

await getAllExif(sourceFolder);
console.log("Done");
