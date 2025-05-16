import { Logger } from '@aws-lambda-powertools/logger'
import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware'
import { SendEmailCommand, SESClient } from '@aws-sdk/client-ses'
import middy from '@middy/core'
import errorLogger from '@middy/error-logger'
import httpCors from '@middy/http-cors'
import httpErrorHandler from '@middy/http-error-handler'
import httpHeaderNormalizer from '@middy/http-header-normalizer'
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { BadRequest } from 'http-errors'
import { getMandatoryEnv } from '../utils/getMandatoryEnv'

const logger = new Logger({ serviceName: 'emailBackend' })
const CLIENT_EMAIL = getMandatoryEnv('CLIENT_EMAIL')
const MAIL_FROM = getMandatoryEnv('MAIL_FROM')
const ALLOWED_ORIGIN = getMandatoryEnv('ALLOWED_ORIGIN')
const sesClient = new SESClient()

const sendEmail = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  if (!event.body) {
    throw new BadRequest('Body is missing')
  }
  const body = JSON.parse(event.body)
  if (!body.from) {
    throw new BadRequest('Field from is missing')
  }
  if (!body.text) {
    throw new BadRequest('Field text is missing')
  }
  if (body.text.length > 1000) {
    throw new BadRequest('Field text is too long')
  }
  const command = new SendEmailCommand({
    Destination: {
      ToAddresses: [CLIENT_EMAIL],
    },
    Source: MAIL_FROM,
    Message: {
      Subject: {
        Data: 'Neue Kontaktanfrage',
        Charset: 'utf-8',
      },
      Body: {
        Html: {
          Data: `
                    <h2>Neue Kontaktanfrage</h2>
                    <h5>Von</h5>
                    <p>${body.from}</p>
                    <h5>Anfrage:</h5>
                    <p>${body.text}</p>
                `,
          Charset: 'utf-8',
        },
      },
    },
  })
  await sesClient.send(command)
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Sent' }),
  }
}

export const handler = middy(sendEmail)
  .use(injectLambdaContext(logger, { logEvent: false }))
  .use(httpErrorHandler())
  .use(errorLogger())
  .use(httpHeaderNormalizer())
  .use(httpCors({
    credentials: true,
    headers: '*',
    origins: [ALLOWED_ORIGIN],
    methods: '*',
  }))