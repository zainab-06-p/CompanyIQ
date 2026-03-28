import { createRequire } from "module";
const require = createRequire(import.meta.url);
export const top500Companies = require("./companies.json");
