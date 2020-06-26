# npm-registry-csv

This script lets you download data about the npm registry (packages, their versions, maintainers, and dependencies)
and store it as .csv files for easy import into e.g. Neo4j.

# Requirements

The script downloads a large JSON file from npm (~45GB as of 2020-06-18) and parses it.
As far as I can tell, npm throttles the download, so the first requirements are (a) time and (b) ample disk space.

The data is processed using streams, but it does need to save a lot of information in memory. With the 45GB JSON file it uses just above 10GB of RAM.

# Running and importing

To run the script, use `node --max-old-space-size=24576 index.js`.

To import into Neo4j, make sure that there isn't an existing database already. Then, from the `data/` directory, run
```
neo4j-admin import \
  --id-type=STRING \
  --multiline-fields=true \
  --nodes:Package=nodes/package.csv \
  --nodes:Registry=nodes/registry.csv \
  --nodes:User=nodes/user.csv \
  --nodes:Version=nodes/version.csv \
  --relationships:DEPENDS_ON=relationships/dependsOn.csv \
  --relationships:MAINTAINS=relationships/maintains.csv \
  --relationships:VERSION_OF=relationships/versionOf.csv
```

# Data modeling

There are five node types with the following properties:

- Package
  - `id` (this is just the package name prefixed with `npm-`.)
  - `name`
- Version
  - `version`
  - `timestamp`: the time of publication in ISO8601 format, e.g. `2020-06-24T13:25:00.000Z`
  - `repository`: URL of the git repo, e.g. `ssh://git@github.com/organization/repo.git`
  - `file_count`: the number of files in the extracted tarball
  - `unpacked_size`: size (in bytes) of the unpacked tarball
- User
  - `id` (the username prefixed with `npm-`)
  - `username`

And several relationships:

- `(Version)--[VERSION_OF]-->(Package)`
- `(Version)--[DEPENDS_ON]-->(Version)`
  - `type`: one of `normal`, `dev`, `peer`
  - `range`: the version range specified as a dependency
- `(User)--[MAINTAINS]-->(Version)`
- `(Version)--[NEXT_VERSION]--(Version)`
  - `interval`: the duration (in milliseconds) between the two versions
