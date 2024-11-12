import { debug, getInput, setSecret } from '@actions/core';
import { CommitMessageType } from './createCommit';
import { existsSync, readFileSync } from 'fs';
import { globSync } from 'glob';

/**
 * Contains the owner and repository of the target branch
 */
export type RepositoryType = {
  owner: string;
  repository: string;
};

/**
 * Get the target branch for the specified input or the GITHUB_REF_NAME
 *  environment variable
 * @returns name of the target branch
 */
export function getInputBranch(): string {
  // load both the branch from action input and the environment
  const input: string = getInput('branch');
  const env: string = process.env.GITHUB_REF_NAME;

  // if the action input and environment do not contain the name of the target
  //  branch, throw an error
  if (input === '' && env === '') {
    throw new Error(
      /* eslint-disable quotes */
      "branch could not be determined; input 'branch' not specified " +
        "and 'env.GITHUB_REF_NAME' was empty",
      /* eslint-enable */
    );
  }

  let out: string;
  if (input !== '') {
    // if the input branch is specified, return it. the target branch specified
    //  by the action input takes precedence over the checked out branch defined
    //  in the environment
    out = input;
    debug(`input 'branch' set from action input: ${out}`);
    return out;
  }

  // if no target branch is specified by the action input, return the checked
  //  out branch defined in the environment
  out = env;
  debug(`input 'branch' set from 'env.GITHUB_REV_NAME': ${out}`);
  return out;
}

/**
 * Get the commit message from the action input 'message' or generate a default
 *  message
 *
 * @returns provided or generated commit message
 *
 * @throws error if both 'message' and 'message_file' inputs are defined
 * @throws error if 'message' is empty
 * @throws error if trimmed 'message' or 'message_file' contain no information
 */
export function getInputCommitMessage(): CommitMessageType {
  // load commit message from both 'message' and 'message_file' inputs
  const inputMessage: string = getInput('message');
  const inputMessageFile: string = getInput('message_file');

  // if both 'message' and 'message_file' inputs are defined, throw and error
  //  stating that this configuration is unsupported
  if (inputMessage !== '' && inputMessageFile !== '') {
    // eslint-disable-next-line quotes
    throw new Error("both 'message' and 'message_file' cannot be specified");
  }

  // if both 'message' and 'message_file' are empty, generate a default message
  if (inputMessage === '' && inputMessageFile === '') {
    // return base of default commit message
    debug('generating generic commit message');
    return {
      default: true,
      headline: 'committed files',
    };
  }
  if (inputMessage !== '') {
    // compile input message as array of lines
    const lines: string[] = inputMessage.trim().split(/\n/g);
    // consume preceding empty lines
    for (const line of lines) {
      if (line.trim() === '') {
        lines.shift();
        continue;
      }
      break;
    }
    if (lines.length === 0) {
      // throw error if no non-empty lines remain in message
      throw new Error('commit message is empty');
    }

    // consume the first line as the commit headline/title
    const out: CommitMessageType = {
      headline: (lines.shift() as string).trim(),
    };

    // if any lines remain, join them into the commit message body
    const body = lines.join('\n').trim();
    if (body !== '') {
      out.body = body;
    }

    debug(`commit message set from input 'message': ${JSON.stringify(out)}`);
    return out;
  }
  // load commit message from file
  if (!existsSync(inputMessageFile)) {
    throw new Error(
      `input 'message_file' '${inputMessageFile}' does not exist`,
    );
  }

  // load file as array or lines
  const lines: string[] = readFileSync(inputMessageFile, 'utf-8').split(
    /\r?\n/g,
  );

  // consume any preceding empty lines
  for (const line of lines) {
    if (line.trim() === '') {
      lines.shift();
      continue;
    }
    break;
  }

  if (lines.length === 0) {
    // throw error if no non-empty lines remain in message
    throw new Error('commit message is empty');
  }

  // consume the first line as the commit headline/title
  const out: CommitMessageType = {
    headline: (lines.shift() as string).trim(),
  };

  // rebuild and trim the remaining text as the commit message body
  const body: string = lines.join('\n').trim();
  if (body !== '') {
    out.body = body;
  }

  debug(`commit message set from input 'message_file': ${JSON.stringify(out)}`);
  return out;
}

/**
 * Get files listed to be deleted from action input 'delete_files'
 *
 * @returns array of file paths relative to the working directory
 *
 * @throws error if listed file is not found
 */
export function getInputDeleteFiles(): string[] {
  // load files from action input 'delete_files'
  const input: string = getInput('delete_files');

  const out: string[] = new Array<string>();

  if (input === '') {
    // if no files are specified, return and empty array
    return out;
  }

  // split list into lines and remove empty lines
  const inputLines = input.split(/\n/g).filter((line) => line.trim() !== '');

  for (const line of inputLines) {
    // check if entry is glob, returns single entry if single file is found,
    //  multiple files if entry is a glob
    const checkGlob: string[] = globSync(line);

    if (checkGlob.length === 0) {
      // listed file is not found
      throw new Error(`no input 'delete_file' found: ${line}`);
    }

    if (checkGlob.length === 1) {
      out.push(line);
      debug(`tracking input 'delete_file': ${line}`);
      continue;
    }

    debug(`tracking input 'delete_file' glob: ${line}`);
    for (const file of checkGlob) {
      out.push(file);
      debug(`tracking input 'delete_file': ${file}`);
    }
  }

  // if files are listed in the input, but none returned, throw error
  if (out.length === 0) {
    throw new Error(
      `no 'delete_files' could be parsed from input: '${JSON.stringify(
        input,
      )}'`,
    );
  }

  return out;
}

/**
 * Get files listed to be added or modified from action input 'files'
 *
 * @returns array of file paths relative to the working directory
 *
 * @throws error if listed file is not found
 */
export function getInputFiles(): string[] {
  // load files from action input 'files', removing empty lines
  const input: string[] = getInput('files', { required: true })
    .split(/\n/g)
    .filter((line) => line.trim() !== '');

  const out: string[] = new Array<string>();

  for (const line of input) {
    // check if entry is glob, returns single entry if single file is found,
    //  multiple files if entry is a glob
    const checkGlob: string[] = globSync(line);

    if (checkGlob.length === 0) {
      // listed file not found
      throw new Error(`no input 'file' found: ${line}`);
    }

    if (checkGlob.length === 1) {
      out.push(line);
      debug(`tracking input 'file': ${line}`);
      continue;
    }

    debug(`tracking input 'file' glob: '${line}'`);
    for (const file of checkGlob) {
      out.push(file);
      debug(`tracking input 'file': ${file}`);
    }
  }

  // if files are listed in the input, but none returned, throw error
  if (out.length === 0) {
    throw new Error(
      `no 'files' could be parsed from input: '${JSON.stringify(input)}'`,
    );
  }

  return out;
}

/**
 * Get the target repository from action input 'repository', or from the
 *  GITHUB_REPOSITORY environment variable
 *
 * @returns object containing the repository owner and repository name
 *
 * @throws error if action input and environment variable are both empty
 * @throws error if action input could not be parsed
 * @throws error if environment variable could not be parsed
 */
export function getInputRepository(): RepositoryType {
  // load both action input 'repository' and GITHUB_REPOSITORY environment
  //  variable
  const input: string = getInput('repository');
  const env: string = process.env.GITHUB_REPOSITORY;

  // if both action input and environment variable are empty, throw an error
  if (input === '' && env === '') {
    throw new Error(
      /* eslint-disable quotes */
      "repository could not be determined; input 'repository' not specified " +
        "and 'env.GITHUB_REPOSITORY' was empty",
      /* eslint-enable */
    );
  }

  // if action input is provided, split the owner and repository name. if the
  //  input is not the expected OWNER/REPOSITORY format, throw an error
  if (input !== '') {
    const [owner, repo] = input.split('/');
    if (owner === '' || repo === '') {
      throw new Error(
        `input 'repository' could not be parsed: '${input}'; ` +
          // eslint-disable-next-line quotes
          "must be formatted as 'OWNER/REPOSITORY'",
      );
    }

    debug(`input 'repository' set; owner: '${owner}', repository: '${repo}'`);
    return {
      owner: owner,
      repository: repo,
    };
  }

  // if action input is not provided, parse the owner and repository name from
  //  the environment. if the environment variable is set to something
  //  unexpected and the owner and repository name cannot be parsed, throw an
  //  error.
  const [owner, repo] = env.split('/');
  if (owner === '' || repo === '') {
    throw new Error(
      'GITHUB_REPOSITORY environment variable could not be interpreted',
    );
  }

  debug(`input 'repository' set; owner: '${owner}', repository: '${repo}'`);
  return {
    owner: owner,
    repository: repo,
  };
}

/**
 * Get the secret token used to authenticate to the Github API from the action
 *  input 'token', or from the environment variable GITHUB_TOKEN.
 *
 * @returns secret token
 *
 * @throws error if action input and environment variable are both empty
 */
export function getInputToken(): string {
  // load token from both action input 'token' and environment variable
  //  GITHUB_TOKEN
  const input: string = getInput('token');
  const env: string = process.env.GITHUB_TOKEN;

  // if both the action input and environment variable are empty, throw an error
  if (input === '' && env === '') {
    throw new Error(
      // eslint-disable-next-line quotes
      "no token available; must set input 'token' or 'env.GITHUB_TOKEN'",
    );
  }

  let out: string;
  if (input !== '') {
    // eslint-disable-next-line quotes
    debug("input 'token' set from action input");
    out = input;
    setSecret(out);
    return out;
  }

  // eslint-disable-next-line quotes
  debug("input 'token' set from environment variable GITHUB_TOKEN");
  out = env;
  setSecret(out);
  return out;
}
