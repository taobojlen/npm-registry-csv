import gh from "github-url-to-object";
import { Dependency, DependencyType } from "./types";
import { concat } from "lodash";

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
  [key: string]: string;
}

export const saveDependencies = (
  normalDeps?: DependencyList,
  devDeps?: DependencyList,
  peerDeps?: DependencyList
): Dependency[] => {
  const mapAndSave = (
    deps: DependencyList,
    type: DependencyType
  ): Dependency[] => {
    Object.entries(deps)
      .filter(([depName, depRange]) => !!depName && !!depRange)
      .map(
        ([depName, depRange]): Dependency => ({
          package: depName,
          range: depRange,
          type: type,
        })
      );

    return concat(
      mapAndSave(normalDeps, "normal"),
      mapAndSave(devDeps, "dev"),
      mapAndSave(peerDeps, "peer")
    ).filter((d) => !!d);
  };
};
