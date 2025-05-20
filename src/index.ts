#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib'
import { ContactBackendProps } from './constructs/ContactBackend'
import { NextJsHostingStack } from './stacks/NextJsHostingStack'
import { getMandatoryEnv } from './utils/getMandatoryEnv'

const app = new cdk.App()
const stackName = getMandatoryEnv('STACK_NAME')
const s3Bucket = getMandatoryEnv('S3_BUCKET')
const domainName = getMandatoryEnv('DOMAIN_NAME')
const cname = process.env.CNAME || undefined
const region = getMandatoryEnv('AWS_REGION')
const account = getMandatoryEnv('AWS_ACCOUNT')
const mailFromDomain = process.env.MAIL_FROM_DOMAIN
const mailFromDisplayName = process.env.MAIL_FROM_DISPLAY_NAME
const mailTo = process.env.MAIL_TO
const mailCc = process.env.MAIL_CC
const mailBcc = process.env.MAIL_BCC
const mailTemplateKey = process.env.MAIL_TEMPLATE_KEY
const throttlingRateLimit = process.env.THROTTLING_RATE_LIMIT
const throttlingWindow = process.env.THROTTLING_WINDOW

let contactBackendProps: ContactBackendProps | undefined = undefined
if (mailFromDomain || mailFromDisplayName || mailTo || mailCc || mailBcc) {
  if (!mailFromDomain || !mailFromDisplayName || !mailTo) {
    throw new Error('Either specify all mail properties or none.')
  } else {
    contactBackendProps = {
      mailFromDomain,
      mailFromDisplayName,
      mailTo,
      mailCc,
      mailBcc,
      mailTemplateKey,
      baseDomain: domainName,
      ...(throttlingRateLimit && throttlingWindow && {
        throttling: {
          rateLimit: Number(throttlingRateLimit),
          window: throttlingWindow as 'seconds' | 'minutes' | 'hours',
        },
      }),
    }
  }
}

new NextJsHostingStack(app, stackName, {
  staticAssetsBucketName: s3Bucket,
  domainName,
  cname,
  deploymentUsername: `${stackName}Deployment`,
  env: { region, account },
  contactBackend: contactBackendProps,
})