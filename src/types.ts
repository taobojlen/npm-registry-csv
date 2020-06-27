export interface StringMap {
  [key: string]: string;
}

export interface VersionRequirement {
  id: number;
  name: string;
  range: string;
}

export type DependencyType = "normal" | "peer" | "dev"

export type Maintainer = string | {name: string, email: string}