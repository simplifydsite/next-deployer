import { Logger } from '@aws-lambda-powertools/logger'
import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware'
import { SendEmailCommand, SESClient } from '@aws-sdk/client-ses'
import middy from '@middy/core'
import errorLogger from '@middy/error-logger'
import httpCors from '@middy/http-cors'
import httpErrorHandler from '@middy/http-error-handler'
import httpHeaderNormalizer from '@middy/http-header-normalizer'
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { BadRequest, TooManyRequests } from 'http-errors'
import { getMandatoryEnv } from '../utils/getMandatoryEnv'
import { isEmail } from '../utils/isEmail'
import { ThrottlingService } from './throttling/ThrottlingService'

const logger = new Logger({ serviceName: 'emailBackend' })
const CLIENT_EMAIL = getMandatoryEnv('CLIENT_EMAIL')
const MAIL_FROM = getMandatoryEnv('MAIL_FROM')
const MAIL_FROM_DISPLAY_NAME = getMandatoryEnv('MAIL_FROM_DISPLAY_NAME')
const ALLOWED_ORIGIN = getMandatoryEnv('ALLOWED_ORIGIN')
const THROTTLING_TABLE_NAME = process.env.THROTTLING_TABLE_NAME
const THROTTLING_RATE_LIMIT = process.env.THROTTLING_RATE_LIMIT
const THROTTLING_WINDOW = process.env.THROTTLING_WINDOW
const sesClient = new SESClient()
const throttlingService = (THROTTLING_TABLE_NAME && THROTTLING_RATE_LIMIT && THROTTLING_WINDOW) ?
  new ThrottlingService({
    tableName: THROTTLING_TABLE_NAME,
    rateLimit: Number(THROTTLING_RATE_LIMIT),
    window: THROTTLING_WINDOW as 'seconds' | 'minutes' | 'hours',
  })
  : undefined

const sendEmail = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  if (!event.body) {
    throw new BadRequest(JSON.stringify({ error: 'Body is missing' }))
  }
  const body = JSON.parse(event.body) as { fromName: string; fromEmail: string; text: string }
  if (!body.fromName) {
    throw new BadRequest(JSON.stringify({ error: 'Field fromName is missing' }))
  }
  if (!body.fromEmail) {
    throw new BadRequest(JSON.stringify({ error: 'Field fromEmail is missing' }))
  }
  if (!isEmail(body.fromEmail)) {
    throw new BadRequest(JSON.stringify({ error: 'Field fromEmail is not a valid email' }))
  }
  if (!body.text) {
    throw new BadRequest(JSON.stringify({ error: 'Field text is missing' }))
  }
  if (body.text.length > 1000) {
    throw new BadRequest(JSON.stringify({ error: 'Field text is too long' }))
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
  await throttlingService?.checkAllowed(() => {
    throw new TooManyRequests(JSON.stringify({ error: 'Too many requests. Please try again later.' }))
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