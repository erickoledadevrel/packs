import * as fs from "fs";

let fontFiles = fs.readdirSync("node_modules/figlet/importable-fonts");
let imports = [];
let lines = [
  "export type Font = { name: string; definition: any; }",
  "export const fonts: Font[] = [];"
];
for (let fontFile of fontFiles) {
  let name = fontFile.replace(/\.js$/, "");
  let module = "font_" + name.replace(/[^\w]/g, "_");
  imports.push(`import ${module} from "figlet/importable-fonts/${fontFile}";`);
  lines.push(`fonts.push({name: "${name}", definition: ${module}});`);
}
let text = imports.concat([""], lines).join("\n");

fs.writeFileSync("asciify/fonts.ts", text);