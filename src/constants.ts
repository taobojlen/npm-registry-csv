import path from "path";

export const ALL_DOCS_DEST = path.resolve("./data/all_docs.json");

export const SUSPICIOUS_INSTALL_SCRIPTS = [
  "preinstall",
  "install",
  "postinstall"
]

export const SUSPICIOUS_UNINSTALL_SCRIPTS = [
  "preuninstall",
  "uninstall",
  "postuninstall"
]