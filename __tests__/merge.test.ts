// __tests__/merge.test.ts
import * as core from '@actions/core';
import * as github from '@actions/github';
import run from '../merge'; // Adjust the import path as needed

jest.mock('@actions/core');
jest.mock('@actions/github');

describe('Auto Merge Action', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        // Reset the mocked context
        (github.context as any).repo = { owner: 'default-owner', repo: 'default-repo' };
        (github.context as any).payload = {};
    });

    it('should not merge when no pull request number is provided', async () => {
        // Mock inputs
        (core.getInput as jest.Mock).mockImplementation((name: string) => {
            if (name === 'token') return 'fake-token';
            return '';
        });

        // Ensure github.context.payload.pull_request is undefined
        (github.context as any).payload.pull_request = undefined;

        const infoMock = core.info as jest.Mock;
        const setOutputMock = core.setOutput as jest.Mock;

        await run();

        expect(infoMock).toHaveBeenCalledWith(
            'No pull request number provided (via context or input), do not automerge.'
        );
        expect(setOutputMock).toHaveBeenCalledWith('not-merged', true);
    });

    it('should not merge when PR title does not contain search string', async () => {
        // Mock inputs
        (core.getInput as jest.Mock).mockImplementation((name: string) => {
            if (name === 'token') return 'fake-token';
            if (name === 'pull_number') return '123';
            if (name === 'title-contains') return 'automerge';
            return '';
        });

        // Set github.context.repo
        (github.context as any).repo = { owner: 'owner', repo: 'repo' };

        const octokitMock = {
            rest: {
                pulls: {
                    get: jest.fn().mockResolvedValue({
                        data: {
                            title: 'Update README',
                        },
                    }),
                },
            },
        };

        (github.getOctokit as jest.Mock).mockReturnValue(octokitMock);

        const infoMock = core.info as jest.Mock;
        const setOutputMock = core.setOutput as jest.Mock;

        await run();

        expect(infoMock).toHaveBeenCalledWith(
            'The PR title "Update README" does not include "automerge", do not automerge.'
        );
        expect(setOutputMock).toHaveBeenCalledWith('not-merged', true);
    });

    it('should merge when PR title contains search string', async () => {
        // Mock inputs
        (core.getInput as jest.Mock).mockImplementation((name: string) => {
            if (name === 'token') return 'fake-token';
            if (name === 'pull_number') return '456';
            if (name === 'title-contains') return 'automerge';
            return '';
        });

        // Set github.context.repo
        (github.context as any).repo = { owner: 'owner', repo: 'repo' };

        const octokitMock = {
            rest: {
                pulls: {
                    get: jest.fn().mockResolvedValue({
                        data: {
                            title: 'Add new feature [automerge]',
                        },
                    }),
                    merge: jest.fn().mockResolvedValue({ data: {} }),
                },
            },
        };

        (github.getOctokit as jest.Mock).mockReturnValue(octokitMock);

        const infoMock = core.info as jest.Mock;
        const setOutputMock = core.setOutput as jest.Mock;

        await run();

        expect(infoMock).toHaveBeenCalledWith(
            '"automerge" found in the PR title! Automerging pull request.'
        );
        expect(octokitMock.rest.pulls.merge).toHaveBeenCalledWith({
            owner: 'owner',
            repo: 'repo',
            pull_number: 456,
        });
        expect(infoMock).toHaveBeenCalledWith('PR #456 merged successfully.');
        expect(setOutputMock).toHaveBeenCalledWith('auto-merged', true);
    });

    it('should handle errors and set action as failed', async () => {
        // Mock inputs
        (core.getInput as jest.Mock).mockImplementation((name: string) => {
            if (name === 'token') return 'fake-token';
            if (name === 'pull_number') return '789';
            if (name === 'title-contains') return 'automerge';
            return '';
        });

        // Set github.context.repo
        (github.context as any).repo = { owner: 'owner', repo: 'repo' };

        const error = new Error('API Error');
        const octokitMock = {
            rest: {
                pulls: {
                    get: jest.fn().mockRejectedValue(error),
                },
            },
        };

        (github.getOctokit as jest.Mock).mockReturnValue(octokitMock);

        const setFailedMock = core.setFailed as jest.Mock;
        const setOutputMock = core.setOutput as jest.Mock;

        await run();

        expect(setOutputMock).toHaveBeenCalledWith('not-merged', true);
        expect(setFailedMock).toHaveBeenCalledWith(`Action failed: ${error}`);
    });
});
