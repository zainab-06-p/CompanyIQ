const fs = require("fs");
const files = fs.readdirSync("engine").filter(f => f.endsWith(".js"));
for (const file of files) {
  let content = fs.readFileSync("engine/" + file, "utf8");
  if (content.includes("function safe(v)")) {
    let replaced = content.replace(
       /function safe\(v\) \{ return typeof v === "number" && !isNaN\(v\) \? v : 0; \}/g,
       `function safe(v) { if (v && typeof v === "object" && "value" in v) return v.value; return (typeof v === "number" && !isNaN(v)) ? v : null; }`
     );
    fs.writeFileSync("engine/" + file, replaced);
  }
}
console.log("Patched safe functions.");

