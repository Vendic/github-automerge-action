import * as core from '@actions/core'
import * as github from '@actions/github'

const TIMEZONE = 'Europe/Amsterdam';
const WINDOW_START = {hour: 8, minute: 30};
const WINDOW_END = {hour: 16, minute: 0};
/* ------------------------------------------------------------------ */

const isWeekday = (date: Date): boolean => {
    // 0 = Sun, 6 = Sat  (but in Amsterdam time)
    const weekday = new Intl.DateTimeFormat('en-GB', {
        timeZone: TIMEZONE,
        weekday: 'short',
    }).formatToParts(date).find(p => p.type === 'weekday')!.value;
    return weekday !== 'Sat' && weekday !== 'Sun';
};

const isDuringWindow = (date: Date): boolean => {
    const [h, m] = new Intl.DateTimeFormat('en-GB', {
        timeZone: TIMEZONE,
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
    })
        .format(date)
        .split(':')
        .map(Number);

    const minutesNow = h * 60 + m;
    const minutesStart = WINDOW_START.hour * 60 + WINDOW_START.minute;
    const minutesEnd = WINDOW_END.hour * 60 + WINDOW_END.minute;

    return minutesNow >= minutesStart && minutesNow < minutesEnd;
};


const run = async (): Promise<void> => {
    try {
        const currentDate = new Date()

        // Check if the current date is a weekday and within the specified time window
        if (!isWeekday(currentDate) || !isDuringWindow(currentDate)) {
            core.info('Current time is outside the allowed window or it is a weekend, do not automerge.')
            core.setOutput('not-merged', true)
            return
        }

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
        core.setOutput('not-merged', true)
        core.setFailed(`Action failed: ${error}`)
    }
}

run()

export default run
