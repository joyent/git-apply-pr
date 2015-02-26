# git-apply-pr

Applies a PR and tries to figure who reviewed the patch and also adds
the PR-url.

Example usage:

```
git-apply-pr joyent/node#1337
```

To include support for using `+1` as a valid vote in favor of merging a pull request, you can use the `--plusone` command line switch like following:

```
git-apply-pr --plusone apache/couchdb-fauxton#321
```
