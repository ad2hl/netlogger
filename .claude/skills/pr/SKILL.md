name: pr
description: Commit, push, and create a pull request for the current feature branch
allowed-tools: Bash(git *), Bash(gh *)

# Create Pull Request

1. Run `git status` and `git diff` to review all changes
2. Run `git log --oneline -5` to see recent commit message style
3. Stage modified/new files relevant to the work (not secrets or unrelated files)
4. Commit with a concise message describing the change, ending with `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`
5. Push the branch with `-u origin`
6. Create a PR using `gh pr create` with:
   - A short title (under 70 characters)
   - A body containing: ## Summary (bullet points), ## Test plan (checklist), and a `Fixes #N` line if the branch name contains an issue number
7. Return the PR URL
