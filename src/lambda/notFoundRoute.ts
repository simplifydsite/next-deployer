import { Route } from '@middy/http-router'
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { NotFound } from 'http-errors'

export const notFoundRoute: Route<APIGatewayProxyEvent, APIGatewayProxyResult> = {
  method: 'ANY',
  path: '/{proxy+}',
  handler: async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    throw new NotFound(JSON.stringify({ error: `${event.requestContext.httpMethod} '${event.path}' not found` }))
  },
}