import TrieMap from "mnemonist/trie-map";
import { VersionRequirement } from "./types";
import Trie from "mnemonist/trie";

// {name--range => {id: version requirement ID, name: name, range: range}}
export const versionRequirements = new TrieMap<string, VersionRequirement>();
// {name => list of versions}
export const packageVersions = new TrieMap<string, string[]>();
// {set of all packages saved thus far}
export const packages = new Trie<string>();
// {set of all users saved thus far}
export const users = new Trie<string>();
