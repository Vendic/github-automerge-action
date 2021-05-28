// Mocking the github context https://github.com/actions/toolkit/blob/master/docs/github-package.md#mocking-the-github-context

import * as github from '@actions/github'
import * as core from '@actions/core'
import run from '../merge'
import path from "path";
import * as fs from "fs";
import {WebhookPayload} from "@actions/github/lib/interfaces";
import nock from "nock";

describe('Test happy path', () => {
    it('does a call to the Github REST API', async () => {
        // Mocks
        const infoMock = jest.spyOn(core, 'info')
        const setOutputMock = jest.spyOn(core, 'setOutput')
        nock('https://api.github.com')
            .persist()
            .put('/repos/foo/bar/pulls/2/merge')
            .reply(200)

        await run()

        // Assertions
        expect(infoMock).toHaveBeenCalledWith('PR #2 merged successfully.')
        expect(setOutputMock).toHaveBeenCalledWith('auto-merged', true)
    })
})

describe('Test correct string is not included in the PR title', () => {
    it('does no calls to the Github REST API, but just ends the function', async () => {
        // Mocks
        const infoMock = jest.spyOn(core, 'info')
        const setOutputMock = jest.spyOn(core, 'setOutput')
        // Override PR title do it doens't include the automege
        // @ts-ignore
        github.context.payload.pull_request.title = 'ABC-123 Your pull request'

        await run()

        // Assertions
        expect(infoMock).toHaveBeenCalledWith('The PR title "ABC-123 Your pull request" does not include "automerge", do not automerge.')
        expect(setOutputMock).toHaveBeenCalledWith('not-merged', true)
    })
})

describe('Test that the action only works for pull request opened', () => {
    it('does no calls to the Github REST API, but just ends the function', async () => {
        // Mocks
        const infoMock = jest.spyOn(core, 'info')
        const setOutputMock = jest.spyOn(core, 'setOutput')
        // Override PR title do it doens't include the automege
        // @ts-ignore
        github.context.payload.action = 'closed'

        await run()

        // Assertions
        expect(infoMock).toHaveBeenCalledWith('You can only run this action on the pull request opened event.')
        expect(setOutputMock).toHaveBeenCalledWith('not-merged', true)
    })
})



beforeEach(() => {
    jest.resetModules()
    process.env['INPUT_TOKEN'] = 'xyz'
    process.env['GITHUB_REPOSITORY'] = 'foo/bar';
    const payloadPath = path.join(__dirname, 'payload.json');
    const payload = JSON.parse(fs.readFileSync(payloadPath, 'utf8'))
    github.context.payload = payload as WebhookPayload
})

afterEach(() => {
    delete process.env['GITHUB_REPOSITORY']
    delete process.env['INPUT_TOKEN']
})
