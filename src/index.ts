#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib'
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
const clientEmail = process.env.CLIENT_EMAIL
new NextJsHostingStack(app, stackName, {
  staticAssetsBucketName: s3Bucket,
  domainName,
  cname,
  deploymentUsername: `${stackName}Deployment`,
  env: { region, account },
  contactBackend: mailFromDomain && clientEmail ? {
    mailFromDomain,
    clientEmail,
  } : undefined,
})