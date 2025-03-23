const sourceDir = "C:\\Users\\drsmile\\Desktop\\20241130員工旅遊日本東北";
const targetDir = "D:\\Pictures\\20241204員工旅遊日本東北";

const allowFileNames = new Set<string>();
for await (const element of Deno.readDir(sourceDir)) {
  allowFileNames.add(element.name);
}

const deleteFileNames = new Set<string>();

for await (const element of Deno.readDir(targetDir)) {
  if (!element.isFile) continue;
  if (!element.name.endsWith("JPG")) continue;
  if (allowFileNames.has(element.name)) continue;
  deleteFileNames.add(`${targetDir}\\${element.name}`);
}

for (const element of deleteFileNames) {
  await Deno.remove(element);
}
