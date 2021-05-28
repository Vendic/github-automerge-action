import * as core from '@actions/core'
import * as github from '@actions/github'

const run = async (): Promise<void> => {
    try {
        if (github.context.payload.action !== 'opened') {
            core.info('You can only run this action on the pull request opened event.')
            core.setOutput('not-merged', true)
            return
        }

        // @ts-ignore
        const pr_title: string = github.context.payload.pull_request.title
        const search_for = core.getInput('title-contains') || 'automerge'

        if (!pr_title.includes(search_for)) {
            core.info(`The PR title "${pr_title}" does not include "${search_for}", do not automerge.`)
            core.setOutput('not-merged', true)
            return
        }

        core.info(`"${search_for}" found in the PR title! Automerging pull request.`)

        const token = core.getInput('token')
        const octokit = github.getOctokit(token)
        const pull_number = github.context.payload.number
        const owner = github.context.repo.owner
        const repo = github.context.repo.repo

        await octokit.rest.pulls.merge({
            owner: owner,
            repo: repo,
            pull_number: pull_number
        })

        core.info(`PR #${pull_number} merged successfully.`)
        core.setOutput('auto-merged', true)
    } catch (error) {
        core.setFailed(`Action failed: ${error}`)
    }
}

run()

export default run
