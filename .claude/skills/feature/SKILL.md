name: feature
description: Create and check out a feature branch for a GitHub issue
allowed-tools: Bash(git *), Bash(gh issue view *)

# Create feature branch

1. Fetch issue #$0 with `gh issue view $0`
2. Pull the latest main: `git checkout main && git pull`
3. Create and check out a branch named `fix/<short-description>-$0` based on the issue title
4. Confirm the branch is ready for work

