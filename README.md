# npm-registry-csv

This script lets you download data about the npm registry (packages, their versions, maintainers, and dependencies)
and store it as .csv files for easy import into e.g. Neo4j.

# Requirements

The script downloads a large JSON file from npm (~45GB as of 2020-06-18) and parses it.
As far as I can tell, npm throttles the download, so the first requirements are (a) time and (b) ample disk space.

The data is processed using streams, but it does need to save a lot of information in memory. With the 45GB JSON file it uses about 6GB of RAM.

# Running and importing

To run the script, use `node --max-old-space-size=16384 index.js`.

To import into Neo4j, make sure that there isn't an existing database already. Then, from the `data/` directory, run
```
neo4j-admin import \
  --id-type=STRING \
  --multiline-fields=true \
  --nodes:Package=nodes/package.csv \
  --nodes:User=nodes/user.csv \
  --nodes:VersionRequirement=nodes/versionRequirement.csv \
  --nodes:Version=nodes/version.csv \
  --relationships:DEPENDS_ON=relationships/dependsOn.csv \
  --relationships:MAINTAINS=relationships/maintains.csv \
  --relationships:REQUIREMENT_OF=relationships/requirementOf.csv \
  --relationships:RESOLVES_TO=relationships/resolvesTo.csv \
  --relationships:VERSION_OF=relationships/versionOf.csv \
  --relationships:DEPENDS_ON_RESOLVES_TO=relationships/dependsOnResolvesTo.csv
```

# Data modeling

There are four node types with the following properties:

- Package
  - `name`
- Version
  - `version`
  - `timestamp`: the time of publication in ISO8601 format, e.g. `2020-06-24T13:25:00.000Z`
  - `repository`: URL of the git repo, e.g. `ssh://git@github.com/organization/repo.git`
  - `file_count`: the number of files in the extracted tarball
  - `unpacked_size`: size (in bytes) of the unpacked tarball
- VersionRequirement
  - `requirement` (e.g. `^2.0.0` or `>=5.0.1`)
- User
  - `username`

And several relationships:

- `(Version)--[VERSION_OF]-->(Package)`
- `(Version)--[DEPENDS_ON]-->(VersionRequirement)`
  - `type`: one of `normal`, `dev`, `peer`
- `(VersionRequirement)--[REQUIREMENT_OF]-->(Package)`
- `(VersionRequirement)--[RESOLVES_TO]-->(Version)`
- `(Version)--[DEPENDS_ON_RESOLVES_TO]-->(Version)`
  - This is the result of following a `DEPENDS_ON`, then a `RESOLVES_TO` relationship. This direct relationship between versions is added for convenience.
- `(User)--[MAINTAINS]-->(Version)`
- `(Version)--[NEXT_VERSION]-->(Version)`
  - `interval`: the duration (in milliseconds) between the two versions
