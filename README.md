# npm-registry-csv

This script lets you download data about the npm registry (packages, their versions, maintainers, and dependencies)
and store it as .csv files for easy import into e.g. Neo4j.

# Requirements

The script downloads a large JSON file from npm (~45GB as of 2020-06-18) and parses it.
As far as I can tell, npm throttles the download, so the first requirements are (a) time and (b) ample disk space.

The data is processed using streams, but it does need to save a lot of information in memory. With the 45GB JSON file it uses just above 10GB of RAM.

# Running and importing

To run the script, use `node --max-old-space-size=16384 index.js`.

To import into Neo4j, make sure that there isn't an existing database already. Then, from the `data/` directory, run
```
neo4j-admin import \
  --id-type=STRING \
  --nodes:Package=nodes/package.csv \
  --nodes:Registry=nodes/registry.csv \
  --nodes:User=nodes/user.csv \
  --nodes:VersionRequirement=nodes/versionRequirement.csv \
  --nodes:Version=nodes/version.csv \
  --relationships:DEPENDS_ON=relationships/dependsOn.csv \
  --relationships:IN_REGISTRY=relationships/inRegistry.csv \
  --relationships:MAINTAINS=relationships/maintains.csv \
  --relationships:REQUIREMENT_OF=relationships/requirementOf.csv \
  --relationships:RESOLVES_TO=relationships/resolvesTo.csv \
  --relationships:VERSION_OF=relationships/versionOf.csv
```

# Data modeling

There are five node types with the following properties:

- Registry
  - `id`. There's just one node of this type with id `npm`.
  - `last_update_check`. This is equivalent to the current revision in npm's database. This makes it easy to get incremental updates to the graph (though this script does not handle this).
- Package
  - `id` (this is just the package name prefixed with `npm-`.)
  - `name`
- Version
  - `version`
  - `timestamp`
- VersionRequirement
  - `requirement` (e.g. `^2.0.0` or `>=5.0.1`)
- User
  - `id` (the username prefixed with `npm-`)
  - `username`

And several relationships:

- `(Version)--[VERSION_OF]-->(Package)`
- `(Version)--[DEPENDS_ON]-->(VersionRequirement)`
  - Has property `type` which is one of `normal`, `dev`, `peer`
- `(VersionRequirement)--[REQUIREMENT_OF]-->(Package)`
- `(VersionRequirement)--[RESOLVES_TO]-->(Version)`
- `(User)--[MAINTAINS]-->(Version)`
- `(Package)--[IN_REGISTRY]-->(Registry)`
