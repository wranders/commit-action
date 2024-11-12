import { debug, info } from '@actions/core';
import { requestGraphQL } from './request';

/**
 * Input files. Value is the base58-encoded file name
 */
type InputFilesType = {
  [key: string]: string;
};

/**
 * Stores each file path in its respective action category
 */
export type RepoFilesActionType = {
  createFiles?: string[];
  modifyFiles?: string[];
  deleteFiles?: string[];
};

/**
 * The structure of the GraphQL repository files response
 */
type RepoFilesQueryResponseType = {
  data: {
    repository: {
      ref: {
        target: {
          [key: string]: {
            type: string;
          } | null;
        };
      };
    };
  };
};

/**
 * Base58-encode the input. This is used to encode the file names for unique
 *  entry keys in the GraphQL API repository files request.
 *
 * @param input string or character bytes array
 *
 * @returns base58-encoded string
 */
function base58Encode(input: string | Uint8Array): string {
  const B58ALPHANUM =
    '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

  if (input.length === 0) return '';

  if (typeof input === 'string')
    input = new Uint8Array(input.split('').map((c) => c.charCodeAt(0)));

  let hex = '';
  for (const c of input) {
    hex += c.toString(16).padStart(2, '0');
  }

  let x = BigInt('0x' + hex);

  const output: string[] = [];
  while (x > 0) {
    const mod = Number(x % 58n);
    x = x / 58n;
    output.push(B58ALPHANUM[mod]);
  }

  for (let i = 0; input[i] === 0; i++) output.push(B58ALPHANUM[0]);

  return output.reverse().join('');
}

/**
 * Get file status in target branch from GraphQL API
 *
 * @param token secret to authenticate to the Github GraphQL API
 * @param owner repository owner
 * @param repo repository name
 * @param branch target branch
 * @param inputCreateModifyFiles files that will be created or modified
 * @param inputDeleteFiles files that will be deleted from the target branch
 * @returns files organized by when their committed result will be
 */
export async function getRepoFiles(
  token: string,
  owner: string,
  repo: string,
  branch: string,
  inputCreateModifyFiles: string[],
  inputDeleteFiles: string[],
): Promise<RepoFilesActionType> {
  // compile all specified files and base58-encode their file names
  const inputFilesCreateModify: InputFilesType = {};
  for (const file of inputCreateModifyFiles) {
    inputFilesCreateModify[file] = `_${base58Encode(file)}`;
  }
  const inputFilesDelete: InputFilesType = {};
  for (const file of inputDeleteFiles) {
    inputFilesDelete[file] = `_${base58Encode(file)}`;
  }

  // construct graphql query entries for all specified files
  const queries: string[] = new Array<string>();
  Object.keys(inputFilesCreateModify).map((file: string) => {
    queries.push(`${inputFilesCreateModify[file]}:file(path:"${file}"){type}`);
  });
  Object.keys(inputFilesDelete).map((file: string) => {
    queries.push(`${inputFilesDelete[file]}:file(path:"${file}"){type}`);
  });
  const query: string = queries.join(',');

  // build graphql request query
  const data = `{
    repository(owner:"${owner}", name:"${repo}") {
      ref(qualifiedName: "refs/heads/${branch}") {
        target{... on Commit{
          ${query}
        }}
      }
    }
  }`;
  debug(`request data: ${JSON.stringify(data)}`);

  // execute the reques
  const request = await requestGraphQL<RepoFilesQueryResponseType>(token, {
    query: data,
  });
  debug(`request result: ${JSON.stringify(request)}`);

  // organize files base on information returned from the api request.
  // created files will not exist in the target branch, so will be 'null' in the
  //  response
  // modified files will exist in the target branch, so will have an object in
  //  the response
  // deleted files that exist in the target branch will not be null in the
  //  response. deleted files that do not exist in the target branch will be
  //  null and not added to the output.
  const createFiles: string[] = new Array<string>();
  const modifyFiles: string[] = new Array<string>();
  const deleteFiles: string[] = new Array<string>();
  Object.keys(inputFilesCreateModify).map((file: string) => {
    const fileResult =
      request.data.repository.ref.target[inputFilesCreateModify[file]];
    if (fileResult != null) modifyFiles.push(file);
    if (fileResult == null) createFiles.push(file);
  });

  if (inputDeleteFiles.length !== 0) {
    Object.keys(inputFilesDelete).map((file: string) => {
      const fileResult =
        request.data.repository.ref.target[inputFilesDelete[file]];
      if (fileResult != null) deleteFiles.push(file);
      if (fileResult == null)
        info(`input 'delete_file' not found in remote: ${file}; ignoring`);
    });
  }

  return {
    createFiles: createFiles.length !== 0 ? createFiles : undefined,
    modifyFiles: modifyFiles.length !== 0 ? modifyFiles : undefined,
    deleteFiles: deleteFiles.length !== 0 ? deleteFiles : undefined,
  };
}
