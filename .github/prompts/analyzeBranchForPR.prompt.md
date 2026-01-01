---
name: analyzeBranchForPR
description: Analyze git branch commits and generate structured PR title and description
argument-hint: branch comparison range (e.g., main..feature-branch)
---

Analyze all commits in the specified git branch comparison range and generate a comprehensive Pull Request title and description.

## Steps:

1. Fetch the latest changes from the base branch
2. List all commits in the comparison range using git log
3. Get file change statistics (files changed, insertions, deletions)
4. Review the actual code changes (diffs) to understand what was modified
5. Summarize the changes into a clear, concise PR title following conventional commit format
6. Generate a structured PR description with the following sections:

## PR Description Format:

```
**簡短說明**
<Brief summary of what this PR accomplishes>

**變更重點**
<Key changes made in bullet points with relevant emojis>

**影響範圍（檔案變更統計）**
<Statistics: X files changed, Y insertions, Z deletions>
<List of modified files with line counts>

**Commit 列表**
<List all commits with short hash and title>
- <hash> <commit message>

**Reviewer checklist**
<Contextual checklist items based on the changes>
- [ ] <specific check related to the changes>
- [ ] <verification step>
- [ ] <test or build command to run>
```

## Guidelines:

- PR title should follow conventional commit format (type(scope): description)
- Keep the title concise but descriptive (max 72 characters)
- In 變更重點, use emojis to make it visually appealing and categorize changes
- For 影響範圍, include both summary statistics and per-file details
- Reviewer checklist should be specific to the actual changes (not generic)
- Always include a build/test verification step in the checklist
- If UI changes are involved, include visual verification steps
- If API changes are involved, include backward compatibility checks
