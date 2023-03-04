# commit-action

Commit and push files to a repository

## Inputs

### `branch`

Target branch files will be committed to. Defaults to the checked out branch.

### `delete_files`

A newline-delimited list of files to delete in this commit. Files that are not
on the target branch are logged and ignored.

### `files`

**Required:** A newline-delimited list of files add or modify in this commit.
Files listed that are not modified will no appear in the commit.

### `message`

Commit message. Default:

```txt
committed files

created  [ list of created files ]
modified [ list of modified files ]
deleted  [ list of deleted files ]
```

### `message_file`

A text file containing the commit message. Fails if file does not exist.

### `repository`

The repository to commit files to. Must be formatted as 'OWNER/REPOSITORY'.
Defaults to `env.GITHUB_REPOSITORY`.

### `token`

The token used to interact with the Github API. Defaults to `env.GITHUB_TOKEN`

## Example Usage

```yaml
jobs:
  run:
    steps:
    - uses: wranders/commit-action@v0
      with:
        message: Update README
        files: |
          README.md
```
