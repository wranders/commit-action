import { debug, info, setFailed } from '@actions/core';
import { existsSync } from 'fs';
import {
  CommitMessageType,
  CreateCommitResponseType,
  createCommit,
} from './createCommit';
import { RepoFilesActionType, getRepoFiles } from './getRepoFiles';
import {
  RepositoryType,
  getInputBranch,
  getInputCommitMessage,
  getInputDeleteFiles,
  getInputFiles,
  getInputRepository,
  getInputToken,
} from './input';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface ProcessEnv {
      GITHUB_GRAPHQL_URL: string;
      GITHUB_REF_NAME: string;
      GITHUB_REPOSITORY: string;
      GITHUB_SHA: string;
      GITHUB_TOKEN: string;
    }
  }
}

/**
 * Check if a created or modified file exists
 *
 * @param files array of files relative to the current working directory
 *
 * @throws error if file does not exist
 */
function checkFilesExist(files: string[]) {
  for (const file of files) {
    if (!existsSync(file)) {
      throw new Error(`create/modify file '${file}' does not exist`);
    }
  }
}

/**
 * Generate the commit message body from arrays of files organized by the action
 *  being taken.
 *
 * @param files object containing separate arrays of files to commit, modify,
 *  and delete
 *
 * @returns string of the commit message body
 */
function generateDefaultCommitMessageBody(files: RepoFilesActionType): string {
  const out: string[] = new Array<string>();
  if (files.createFiles !== undefined) {
    for (const file of files.createFiles) {
      out.push(`created  '${file}'`);
    }
  }
  if (files.modifyFiles !== undefined) {
    for (const file of files.modifyFiles) {
      out.push(`modified '${file}'`);
    }
  }
  if (files.deleteFiles !== undefined) {
    for (const file of files.deleteFiles) {
      out.push(`deleted  '${file}'`);
    }
  }
  return out.join('\n');
}

/**
 * Execute the action
 */
async function main(): Promise<void> {
  try {
    const branch: string = getInputBranch();
    const deleteFiles: string[] = getInputDeleteFiles();
    const files: string[] = getInputFiles();
    const message: CommitMessageType = getInputCommitMessage();
    const repository: RepositoryType = getInputRepository();
    const token: string = getInputToken();

    checkFilesExist(files);

    const repoFilesAction: RepoFilesActionType = await getRepoFiles(
      token,
      repository.owner,
      repository.repository,
      branch,
      files,
      deleteFiles,
    );
    debug(`query response ${JSON.stringify(repoFilesAction)}`);

    if (message.default) {
      message.body = generateDefaultCommitMessageBody(repoFilesAction);
      debug(`default commit message body set: '${message.body}'`);
    }

    const resp: CreateCommitResponseType = await createCommit(
      token,
      repository.owner,
      repository.repository,
      branch,
      message,
      repoFilesAction,
    );
    debug(`commit response: ${JSON.stringify(resp)}`);
    if (resp.data != null)
      info(`commit success: ${resp.data.createCommitOnBranch.commit.url}`);
  } catch (e) {
    if (e instanceof Error) setFailed(e.message);
  }
}

main();
