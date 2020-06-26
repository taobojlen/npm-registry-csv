import gh from "github-url-to-object";
import { Dependency } from "./types";

export const normalizeRepo = (repository: string) => {
  // Only handles GitHub repos but these make up ~98% of
  // npm packages, according to
  // https://github.com/nice-registry/all-the-package-repos
  let normalizedRepo: gh.Result;
  let cleanedRepo = repository.trim();

  try {
    if (typeof repository === "string") {
      normalizedRepo = gh(repository);
    } else if (
      typeof repository === "object" &&
      "url" in repository &&
      !!repository["url"]
    ) {
      normalizedRepo = gh(repository["url"]);
    }
    if (!!normalizedRepo) {
      cleanedRepo = normalizedRepo.https_url;
    }
  } catch {
    console.error(`Failed to parse repo in ${name}`);
  }
  return cleanedRepo;
};

interface DependencyList {
  [key: string]: string
}

export const saveDependencies = (normalDeps?: DependencyList, devDeps?: DependencyList, peerDeps?: DependencyList): Dependency[] => {
  const mapAndSave = (deps, type) => {
    Object.keys(deps).forEach()
  }
}
