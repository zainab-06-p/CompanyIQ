const fs = require("fs");
const files = fs.readdirSync("agents").filter(f => f.endsWith(".js"));
for (const file of files) {
  let content = fs.readFileSync("agents/" + file, "utf8");
  if (content.includes("function toNum")) {
    let replaced = content.replace(
       /function toNum\(val\) \{[\s\S]*?return null;\s*\}/,
       `function toNum(val) {
  let numVal = null;
  if (val === null || val === undefined || val === "" || val === "N/A" || val === "-") numVal = null;
  else if (typeof val === "number") numVal = isNaN(val) ? null : val;
  else if (typeof val === "string") {
    const cleaned = val.replace(/[?,Cr%]/g, "").replace(/\\s/g, "").trim();
    const num = parseFloat(cleaned);
    numVal = isNaN(num) ? null : num;
  }
  return { value: numVal, state: numVal === null ? "FETCH_FAILED" : "FETCHED" };
}`
     );
    fs.writeFileSync("agents/" + file, replaced);
  }
}
console.log("Patched toNum inside agents.");

