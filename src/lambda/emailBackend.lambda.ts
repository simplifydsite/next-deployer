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
import { isEmail } from '../utils/isEmail'

const logger = new Logger({ serviceName: 'emailBackend' })
const CLIENT_EMAIL = getMandatoryEnv('CLIENT_EMAIL')
const MAIL_FROM = getMandatoryEnv('MAIL_FROM')
const MAIL_FROM_DISPLAY_NAME = getMandatoryEnv('MAIL_FROM_DISPLAY_NAME')
const ALLOWED_ORIGIN = getMandatoryEnv('ALLOWED_ORIGIN')
const sesClient = new SESClient()

const sendEmail = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  if (!event.body) {
    throw new BadRequest('Body is missing')
  }
  const body = JSON.parse(event.body) as { fromName: string; fromEmail: string; text: string }
  if (!body.fromName) {
    throw new BadRequest('Field fromName is missing')
  }
  if (!body.fromEmail) {
    throw new BadRequest('Field fromEmail is missing')
  }
  if (!isEmail(body.fromEmail)) {
    throw new BadRequest('Field fromEmail is not a valid email')
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
    Source: `${MAIL_FROM_DISPLAY_NAME} <${MAIL_FROM}>`,
    ReplyToAddresses: [body.fromEmail],
    Message: {
      Subject: {
        Data: 'Neue Kontaktanfrage',
        Charset: 'utf-8',
      },
      Body: {
        Html: {
          Data: `
                    <h2>Neue Kontaktanfrage</h2>
                    <h3>Von</h3>
                    <p>${body.fromName} - ${body.fromEmail}</p>
                    <h3>Anfrage:</h3>
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