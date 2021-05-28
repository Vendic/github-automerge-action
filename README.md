# Github pull request automerge action [![Tests](https://github.com/Vendic/github-automerge-action/actions/workflows/tests.yml/badge.svg)](https://github.com/Vendic/github-automerge-action/actions/workflows/tests.yml) 
Github action to automatically merge a pull request **based on the pull request title**.

## Usage
Create a new workflow, for example `.github/workflows/automerge.yml`:

```yaml
name: 'Auto merge workflow'
on:
  pull_request:
    types: [ opened ]

jobs:
    build:
        name: Auto merge
        runs-on: ubuntu-latest
        steps:
            -   uses: actions/checkout@v1
                with:
                    fetch-depth: 1

            -   name: Auto merge action
                uses: Vendic/github-automerge-action@1.0.0
                with:
                    token: ${{ secrets.GITHUB_TOKEN }}
                    title-contains: automerge
                id: merge-action

            # Do something if the PR is merged
            -   name: Merged
                if: ${{ steps.merge-action.outputs.auto-merged }}
                run: |
                    echo "The PR is merged!"
            
            # Do something is the PR is not merged
            -   name: Not merged
                if: ${{ steps.merge-action.outputs.not-merged }}
                run: |
                    echo "The PR is not merged"
```

If you create a new PR with a title that contains 'automerge'  (this is configurable via the `title-contains` input option) the PR will be merged after creation.

### About Vendic
[Vendic - Magento 2](https://vendic.nl "Vendic Homepage") develops technically challenging e-commerce websites using Magento 2. Feel free to check out our projects on our website.
