import { readFileSync } from 'node:fs';
import { RepoFilesActionType } from './getRepoFiles';
import { requestGraphQL } from './request';

/**
 * Contains the parsed or generated commit message.
 */
export type CommitMessageType = {
  default?: boolean;
  headline: string;
  body?: string;
};

/**
 * Contains the path of the file to be committed.
 */
type CommitFileChangeType = {
  path: string;
  contents?: string;
};

/**
 * Contains the added/modified and deleted files to be consumed directly by the
 *  GraphQL query.
 */
type CommitFileChangesType = {
  additions?: CommitFileChangeType[];
  deletions?: CommitFileChangeType[];
};

/**
 * Contains the commit information required by the GraphQL commit query.
 */
type CreateCommitInputType = {
  branch: {
    branchName: string;
    repositoryNameWithOwner: string;
  };
  message: CommitMessageType;
  fileChanges: CommitFileChangesType;
  expectedHeadOid: string;
};

/**
 * The structure of the GraphQL commit response.
 */
export type CreateCommitResponseType = {
  data: {
    createCommitOnBranch: {
      commit: {
        url: string;
      };
    };
  } | null;

  errors?: {
    type: string;
    path: string[];
    locations: {
      line: number;
      column: number;
    }[];
    message: string;
  }[];
};

/**
 * Submit the commit request.
 *
 * @param token secret token to be used to make the request
 * @param owner repository owner
 * @param repo name of the repository
 * @param branch name of the target repository branch
 * @param message commit message
 * @param fileActions files to be added/modified and/or deleted
 * @returns response from graphql commit request
 */
export async function createCommit(
  token: string,
  owner: string,
  repo: string,
  branch: string,
  message: CommitMessageType,
  fileActions: RepoFilesActionType,
): Promise<CreateCommitResponseType> {
  const query = `mutation ($input: CreateCommitOnBranchInput!) {
    createCommitOnBranch(input: $input) {
      commit {
        url
      }
    }
  }`;

  const fileChanges: CommitFileChangesType = {};
  if (
    fileActions.createFiles !== undefined ||
    fileActions.modifyFiles !== undefined
  ) {
    fileChanges.additions = new Array<CommitFileChangeType>();
  }

  // Populate the additions array. 'createFiles' and 'modifyFiles' are only
  //  separate here to generate the default commit message. The GraphQL API
  //  request handles new and modified files identically.
  if (fileActions.createFiles !== undefined) {
    for (const file of fileActions.createFiles) {
      (fileChanges.additions as CommitFileChangeType[]).push({
        path: file,
        contents: readFileSync(file).toString('base64'),
      });
    }
  }

  if (fileActions.modifyFiles !== undefined) {
    for (const file of fileActions.modifyFiles) {
      (fileChanges.additions as CommitFileChangeType[]).push({
        path: file,
        contents: readFileSync(file).toString('base64'),
      });
    }
  }

  if (fileActions.deleteFiles !== undefined) {
    fileChanges.deletions = new Array<CommitFileChangeType>();
    for (const file of fileActions.deleteFiles) {
      (fileChanges.deletions as CommitFileChangeType[]).push({
        path: file,
      });
    }
  }

  const input: CreateCommitInputType = {
    branch: {
      repositoryNameWithOwner: `${owner}/${repo}`,
      branchName: branch,
    },
    message: {
      headline: message.headline,
      body: message.body,
    },
    expectedHeadOid: process.env.GITHUB_SHA,
    fileChanges: fileChanges,
  };

  const data = {
    query: query,
    variables: JSON.stringify({
      input: input,
    }),
  };

  const execRequest = await requestGraphQL<CreateCommitResponseType>(
    token,
    data,
  );

  if (execRequest.errors !== undefined) {
    const messages = new Array<string>();
    for (const error of execRequest.errors) {
      messages.push(error.message);
    }
    throw new Error(
      `error(s) processing the commit: ${JSON.stringify(messages)}`,
    );
  }

  return execRequest;
}
