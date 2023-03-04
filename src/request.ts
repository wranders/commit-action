import { ClientRequest } from 'http';
import { RequestOptions, request } from 'https';
import { format } from 'util';

/**
 * GraphQL API request structure. Variables are used to submit the commit
 */
type GraphQLDataType = {
  query: string;
  variables?: string;
};

/**
 * Make a request to the Github GraphQL API
 * @param token secret token to authenticate to the graphql api
 * @param data graphql request body
 * @returns unmarshalled graphql api response
 */
export async function requestGraphQL<T>(
  token: string,
  data: GraphQLDataType,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const dataString = JSON.stringify(data);

    const graphqlUrl = new URL(process.env.GITHUB_GRAPHQL_URL);

    const reqOpts: RequestOptions = {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: format('bearer %s', token),
        'User-Agent': 'wranders/commit-action',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(dataString),
      },
      host: graphqlUrl.hostname,
      path: graphqlUrl.pathname,
      method: 'POST',
    };

    let responseBody = '';

    const req: ClientRequest = request(reqOpts, (response) => {
      response.setEncoding('utf-8');

      response.on('data', (chunk) => {
        responseBody += chunk;
      });

      response.on('end', () => {
        resolve(JSON.parse(responseBody));
      });

      response.on('error', (err) => {
        reject(err);
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.on('timeout', () => {
      req.destroy();
    });

    req.write(dataString);

    req.end();
  });
}
