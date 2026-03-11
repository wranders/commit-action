import { debug, getInput, setSecret } from '@actions/core';
import { CommitMessageType } from './createCommit';
import { existsSync, readFileSync } from 'node:fs';
import { globSync } from 'glob';

/**
 * Contains the owner and repository of the target branch.
 */
export type RepositoryType = {
  owner: string;
  repository: string;
};

/**
 * Get the target branch from the Action's 'branch' parameter or the
 *  GITHUB_REF_NAME environment variable.
 *
 * @returns name of the target branch
 */
export function getInputBranch(): string {
  const input: string = getInput('branch');
  const env: string = process.env.GITHUB_REF_NAME;

  if (input === '' && env === '') {
    throw new Error(
      /* eslint-disable quotes */
      "branch could not be determined; input 'branch' not specified " +
        "and 'env.GITHUB_REF_NAME' was empty",
      /* eslint-enable */
    );
  }

  let out: string;
  let inputSource: string;
  if (input !== '') {
    out = input;
    inputSource = 'action input';
  } else {
    out = env;
    // eslint-disable-next-line quotes
    inputSource = "'env.GITHUB_REV_NAME'";
  }

  debug(`input 'branch' set from ${inputSource}: ${out}`);
  return out;
}

/**
 * Get the commit message from the Action's input 'message' or 'message_file'
 *  parameters. Otherwise, generate a default.
 *
 * @returns provided or generated commit message
 *
 * @throws error if both 'message' and 'message_file' inputs are defined
 * @throws error if 'message' is empty
 * @throws error if trimmed 'message' or 'message_file' contain no information
 */
export function getInputCommitMessage(): CommitMessageType {
  const inputMessage: string = getInput('message');
  const inputMessageFile: string = getInput('message_file');

  if (inputMessage !== '' && inputMessageFile !== '') {
    // eslint-disable-next-line quotes
    throw new Error("both 'message' and 'message_file' cannot be specified");
  }

  if (inputMessage === '' && inputMessageFile === '') {
    debug('generating generic commit message');
    return {
      default: true,
      headline: 'committed files',
    };
  }
  if (inputMessage !== '') {
    const lines: string[] = inputMessage.trim().split(/\n/g);
    for (const line of lines) {
      if (line.trim() === '') {
        lines.shift();
        continue;
      }
      break;
    }
    if (lines.length === 0) {
      throw new Error('commit message is empty');
    }

    const out: CommitMessageType = {
      headline: (lines.shift() as string).trim(),
    };

    const body = lines.join('\n').trim();
    if (body !== '') {
      out.body = body;
    }

    debug(`commit message set from input 'message': ${JSON.stringify(out)}`);
    return out;
  }
  if (!existsSync(inputMessageFile)) {
    throw new Error(
      `input 'message_file' '${inputMessageFile}' does not exist`,
    );
  }

  const lines: string[] = readFileSync(inputMessageFile, 'utf-8').split(
    /\r?\n/g,
  );

  for (const line of lines) {
    if (line.trim() === '') {
      lines.shift();
      continue;
    }
    break;
  }

  if (lines.length === 0) {
    throw new Error('commit message is empty');
  }

  const out: CommitMessageType = {
    headline: (lines.shift() as string).trim(),
  };

  const body: string = lines.join('\n').trim();
  if (body !== '') {
    out.body = body;
  }

  debug(`commit message set from input 'message_file': ${JSON.stringify(out)}`);
  return out;
}

/**
 * Get files slated for deletion from the Action's 'delete_files' parameter.
 *
 * @returns array of file paths relative to the working directory
 *
 * @throws error if listed file is not found
 */
export function getInputDeleteFiles(): string[] {
  const input: string = getInput('delete_files');

  const out: string[] = new Array<string>();

  if (input === '') {
    return out;
  }

  const inputLines = input.split(/\n/g).filter((line) => line.trim() !== '');

  for (const line of inputLines) {
    const checkGlob: string[] = globSync(line);

    if (checkGlob.length === 0) {
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
 * Get files to be added or modified from the Action's 'files' parameter.
 *
 * @returns array of file paths relative to the working directory
 *
 * @throws error if listed file is not found
 */
export function getInputFiles(): string[] {
  const input: string[] = getInput('files', { required: true })
    .split(/\n/g)
    .filter((line) => line.trim() !== '');

  const out: string[] = new Array<string>();

  for (const line of input) {
    const checkGlob: string[] = globSync(line);

    if (checkGlob.length === 0) {
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

  if (out.length === 0) {
    throw new Error(
      `no 'files' could be parsed from input: '${JSON.stringify(input)}'`,
    );
  }

  return out;
}

/**
 * Get the target repository from the Action's 'repository' parameter or from
 *  the GITHUB_REPOSITORY environment variable
 *
 * @returns object containing the repository owner and repository name
 *
 * @throws error if action input and environment variable are both empty
 * @throws error if action input could not be parsed
 * @throws error if environment variable could not be parsed
 */
export function getInputRepository(): RepositoryType {
  const input: string = getInput('repository');
  const env: string = process.env.GITHUB_REPOSITORY;

  if (input === '' && env === '') {
    throw new Error(
      /* eslint-disable quotes */
      "repository could not be determined; input 'repository' not specified " +
        "and 'env.GITHUB_REPOSITORY' was empty",
      /* eslint-enable */
    );
  }

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
 * Get the secret token used to authenticate to the GitHub API from the Action's
 *  'token' parameter or from the environment variable GITHUB_TOKEN.
 *
 * @returns secret token
 *
 * @throws error if action input and environment variable are both empty
 */
export function getInputToken(): string {
  const input: string = getInput('token');
  const env: string = process.env.GITHUB_TOKEN;

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
