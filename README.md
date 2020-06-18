# npm-registry-csv

This script lets you download data about the npm registry (packages, their versions, maintainers, and dependencies)
and store it as .csv files for easy import into e.g. Neo4j.

# Requirements
The script downloads a large JSON file from npm (~40GB as of 2020-06-18) and parses it.
Thus, the first requirements are (a) ample disk space and (b) time.

We avoid loading the entire file into memory at once, but there's a lot of data so it's still memory-intensive.

# Data modeling
There are five node types with the following properties:
* Registry
  * `id`. There's just one node of this type with id `npm`.
  * `last_update_check`. This is equivalent to the current revision in npm's database. This makes it easy to get incremental updates to the graph (though this script does not handle this).
* Package
  * `name`
* Version
  * `version`
  * `timestamp`
* VersionRequirement
  * `requirement` (e.g. `^2.0.0` or `>=5.0.1`)
* User
  * `username`

And several relationships:
* `(Version)--[VERSION_OF]-->(Package)`
* `(Version)--[DEPENDS_ON]-->(VersionRequirement)`
* `(VersionRequirement)--[REQUIREMENT_OF]-->(Package)`
* `(VersionRequirement)--[RESOLVES_TO]-->(Version)`
* `(USER)--[MAINTAINS]-->(Version)`
