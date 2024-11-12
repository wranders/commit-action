import { readFileSync } from 'fs';
import { RepoFilesActionType } from './getRepoFiles';
import { requestGraphQL } from './request';

/**
 * Contains the parsed or generated commit message
 */
export type CommitMessageType = {
  // true if the commit message is generated, false if the message is provided
  default?: boolean;

  // title of the commit message
  headline: string;

  // an optional body of the commit message containing commit details
  body?: string;
};

/**
 * Contains the path of the file to be commited.
 */
type CommitFileChangeType = {
  // path the the file being commited relative to the working directory
  path: string;

  // contents of files being added or modified
  contents?: string;
};

/**
 * Contains the added/modified and deleted files. Consumed directly by the
 *  GraphQL query.
 */
type CommitFileChangesType = {
  // files being added or modified
  additions?: CommitFileChangeType[];

  // files being deleted
  deletions?: CommitFileChangeType[];
};

/**
 * Contains the commit information required by the GraphQL commit query.
 */
type CreateCommitInputType = {
  // branch the commit will be inserted into
  branch: {
    // the name of the branch the commit will be inserted into
    branchName: string;

    // the repository the commit will be inserted into. formatted as
    //  OWNER/REPOSITORY
    repositoryNameWithOwner: string;
  };

  // the commit message
  message: CommitMessageType;

  // list of changes that are defined by this commit
  fileChanges: CommitFileChangesType;

  // the HEAD OID/SHA the commit changes will be made against
  expectedHeadOid: string;
};

/**
 * The structure of the GraphQL commit response
 */
export type CreateCommitResponseType = {
  // contains the returned data from the GraphQL commit request. will be null
  //  if response contains errors.
  data: {
    createCommitOnBranch: {
      commit: {
        // direct url to the commit OID/SHA
        url: string;
      };
    };
  } | null;

  // any errors returned by the GraphQL commit request. will be undefined if no
  //  errors were returned.
  errors?: {
    type: string;
    path: string[];
    locations: {
      line: number;
      column: number;
    }[];
    // message describing the error
    message: string;
  }[];
};

/**
 * Submit the commit request
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
  // query to send to the graphql api. expects input variables.
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
    // if the commit contains additions or modifications, initialize the
    //  expected additions array.
    fileChanges.additions = new Array<CommitFileChangeType>();
  }

  // populate the additions array. create and modify are only separate for
  //  purposes of generating the default commit message. new and modified files
  //  are handled by the graphql request identically.
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
    // if any files are to be deleted, initialize the deletions array and
    //  populate it
    fileChanges.deletions = new Array<CommitFileChangeType>();
    for (const file of fileActions.deleteFiles) {
      (fileChanges.deletions as CommitFileChangeType[]).push({
        path: file,
      });
    }
  }

  // construct the input variables that will be consumed by the graphql api
  //  request.
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

  // construct the query data from the query statement and input variables
  const data = {
    query: query,
    variables: JSON.stringify({
      input: input,
    }),
  };

  // execute the request
  const execRequest = await requestGraphQL<CreateCommitResponseType>(
    token,
    data,
  );

  // if any errors are returned by the graphql api request, collect the messages
  //  into the response type and throw an error containing an array of error
  //  messages. this is encountered if the branch does not exist, or the HEAD
  //  OID is not the HEAD of the target branch.
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
