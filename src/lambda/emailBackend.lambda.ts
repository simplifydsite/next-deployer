import { Logger } from '@aws-lambda-powertools/logger'
import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware'
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager'
import middy from '@middy/core'
import errorLogger from '@middy/error-logger'
import httpCors from '@middy/http-cors'
import httpErrorHandler from '@middy/http-error-handler'
import httpHeaderNormalizer from '@middy/http-header-normalizer'
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { format } from 'date-fns'
import { google } from 'googleapis'
import { gmail } from 'googleapis/build/src/apis/gmail'
import { BadRequest, InternalServerError, TooManyRequests } from 'http-errors'
import { getMandatoryEnv } from '../utils/getMandatoryEnv'
import { isEmail } from '../utils/isEmail'
import { ThrottlingService } from './throttling/ThrottlingService'
import { createEmailRaw } from '../utils/createEmailRaw'
import { GmailCredentials } from './types/GmailCredentials'

const logger = new Logger({ serviceName: 'emailBackend' })
const MAIL_TO = getMandatoryEnv('MAIL_TO')
const MAIL_CC = process.env.MAIL_CC
const MAIL_BCC = process.env.MAIL_BCC
const MAIL_FROM = getMandatoryEnv('MAIL_FROM')
const MAIL_FROM_DISPLAY_NAME = getMandatoryEnv('MAIL_FROM_DISPLAY_NAME')
const ALLOWED_ORIGIN = getMandatoryEnv('ALLOWED_ORIGIN')
const THROTTLING_TABLE_NAME = process.env.THROTTLING_TABLE_NAME
const THROTTLING_RATE_LIMIT = process.env.THROTTLING_RATE_LIMIT
const THROTTLING_WINDOW = process.env.THROTTLING_WINDOW
const MAIL_TEMPLATE_BUCKET = process.env.MAIL_TEMPLATE_BUCKET
const MAIL_TEMPLATE_KEY = process.env.MAIL_TEMPLATE_KEY
const GMAIL_SECRET_ARN = process.env.GMAIL_SECRET_ARN
const s3Client = new S3Client()
const secretsManagerClient = new SecretsManagerClient()
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

  let mailTemplate: string
  if (MAIL_TEMPLATE_BUCKET && MAIL_TEMPLATE_KEY) {
    const response = await s3Client.send(new GetObjectCommand({
      Bucket: MAIL_TEMPLATE_BUCKET,
      Key: MAIL_TEMPLATE_KEY,
    }))
    if (!response.Body) {
      throw new InternalServerError(JSON.stringify({ error: 'Mail template not found.' }))
    }
    mailTemplate = (await response.Body.transformToString())
      .replace(new RegExp('{{fromName}}', 'g'), body.fromName)
      .replace(new RegExp('{{fromEmail}}', 'g'), body.fromEmail)
      .replace(new RegExp('{{text}}', 'g'), body.text)
      .replace(new RegExp('{{date}}', 'g'), format(new Date(), 'dd.MM.yyyy'))
  } else {
    mailTemplate = `
                    <h2>Neue Kontaktanfrage</h2>
                    <h3>Von</h3>
                    <p>${body.fromName} - ${body.fromEmail}</p>
                    <h3>Anfrage:</h3>
                    <p>${body.text}</p>
                `
  }

  const mailTo = MAIL_TO.split(',').map(m => m.trim())
  const mailCc = MAIL_CC ? MAIL_CC.split(',').map(m => m.trim()) : []
  const mailBcc = MAIL_BCC ? MAIL_BCC.split(',').map(m => m.trim()) : []

  await throttlingService?.checkAllowed(() => {
    throw new TooManyRequests(JSON.stringify({ error: 'Too many requests. Please try again later.' }))
  })
  const gmailSecretResponse = await secretsManagerClient.send(new GetSecretValueCommand({
    SecretId: GMAIL_SECRET_ARN,
  }))
  const gmailSecret = JSON.parse(gmailSecretResponse.SecretString!) as GmailCredentials
  const auth = new google.auth.JWT({
    email: gmailSecret.client_email,
    key: gmailSecret.private_key,
    scopes: 'https://www.googleapis.com/auth/gmail.send',
    subject: MAIL_FROM,
  })
  const gmailClient = gmail({
    version: 'v1',
    auth,
  })
  const email = createEmailRaw({
    to: mailTo,
    cc: mailCc,
    bcc: mailBcc,
    htmlBody: mailTemplate,
    subject: 'Neue Kontaktanfrage',
    from: MAIL_FROM,
    fromDisplayName: MAIL_FROM_DISPLAY_NAME,
  })
  await gmailClient.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: email,
    },
  })
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