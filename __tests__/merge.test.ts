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

describe('Time-window enforcement (Mon–Fri 08:30-16:00 NL)', () => {
    /** Helper: set the mocked system clock */
    const setMockTime = (iso: string) => {
        jest.useFakeTimers().setSystemTime(new Date(iso));
    };

    /** Helper: common input / octokit stubs so we can focus on the window */
    const primeHappyInputs = () => {
        // mock core.getInput
        (core.getInput as jest.Mock).mockImplementation((name: string) => {
            if (name === 'token')          return 'fake-token';
            if (name === 'pull_number')    return '999';
            if (name === 'title-contains') return 'automerge';
            return '';
        });

        // repo context
        (github.context as any).repo = { owner: 'owner', repo: 'repo' };

        // octokit stub: title always contains "automerge"
        (github.getOctokit as jest.Mock).mockReturnValue({
            rest: {
                pulls: {
                    get:   jest.fn().mockResolvedValue({ data: { title: '[automerge] test' } }),
                    merge: jest.fn().mockResolvedValue({ data: {} }),
                },
            },
        });
    };

    afterEach(() => {
        jest.useRealTimers();      // restore real clock
        jest.clearAllMocks();      // reset mocks for next test
    });

    it('skips on a Saturday (within hours but weekend)', async () => {
        setMockTime('2025-05-31T09:00:00+02:00'); // Sat 09:00 NL
        primeHappyInputs();

        await run();

        expect(core.setOutput).toHaveBeenCalledWith('not-merged', true);
        expect(core.info).toHaveBeenCalledWith(
            'Current time is outside the allowed window or it is a weekend, do not automerge.'
        );
    });

    it('skips before 08:30 on a Monday', async () => {
        setMockTime('2025-06-02T07:59:00+02:00'); // Mon 07:59 NL
        primeHappyInputs();

        await run();

        expect(core.setOutput).toHaveBeenCalledWith('not-merged', true);
    });

    it('skips exactly at 16:00 on a Monday (end is exclusive)', async () => {
        setMockTime('2025-06-02T16:00:00+02:00'); // Mon 16:00 NL
        primeHappyInputs();

        await run();

        expect(core.setOutput).toHaveBeenCalledWith('not-merged', true);
    });

    it('merges at 10:00 on a Wednesday (inside window)', async () => {
        setMockTime('2025-06-04T10:00:00+02:00'); // Wed 10:00 NL
        primeHappyInputs();

        await run();

        expect(core.info).toHaveBeenCalledWith(
            '"automerge" found in the PR title! Automerging pull request.'
        );
        expect(core.setOutput).toHaveBeenCalledWith('auto-merged', true);
    });
});
