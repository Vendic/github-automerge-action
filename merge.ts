import * as core from '@actions/core'
import * as github from '@actions/github'

const run = async (): Promise<void> => {
    try {
        const token = core.getInput('token');
        const octokit = github.getOctokit(token)
        const pull_number = core.getInput('pull_number') ??  github.context.payload.pull_request?.number

        if (!pull_number) {
            core.info('No pull request number provided (via context or input), do not automerge.')
            core.setOutput('not-merged', true)
            return
        }

        const owner = github.context.repo.owner
        const repo = github.context.repo.repo
        const pull_request = await octokit.rest.pulls.get({
            owner: owner,
            repo: repo,
            pull_number: parseInt(pull_number)
        })

        const pr_title: string = pull_request.data.title
        const search_for = core.getInput('title-contains') || 'automerge'

        if (!pr_title.includes(search_for)) {
            core.info(`The PR title "${pr_title}" does not include "${search_for}", do not automerge.`)
            core.setOutput('not-merged', true)
            return
        }

        core.info(`"${search_for}" found in the PR title! Automerging pull request.`)

        await octokit.rest.pulls.merge({
            owner: owner,
            repo: repo,
            pull_number: parseInt(pull_number)
        })

        core.info(`PR #${pull_number} merged successfully.`)
        core.setOutput('auto-merged', true)
    } catch (error) {
        core.setFailed(`Action failed: ${error}`)
    }
}

run()

export default run
