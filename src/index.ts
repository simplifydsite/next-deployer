#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib'
import { NextJsHostingStack } from './stacks/NextJsHostingStack'


export type BuildNextJsHostingProps = {
  /**
   * AWS Account ID to be deployed to
   */
  account: string;
  /**
   * Region in which the app should be deployed
   *
   * Default: eu-central-1 (Frankfurt)
   */
  region?: string;
  /**
   * Name of the Cloudformation stack
   */
  stackName: string;
  /**
   * Unique bucket name to store the static assets in
   *
   * Default: auto-generated
   */
  staticAssetsBucketName?: string;
  /**
   * Base domain name for the hosted zone
   */
  domainName: string;
  /**
   * Cname of the domain to use
   *
   * Default: use domainName only
   */
  cname?: string;
}

/**
 * Build a Nextjs hosting
 */
const buildNextJsHosting = (
  {
    staticAssetsBucketName,
    stackName,
    account,
    cname,
    domainName,
    region = 'eu-central-1',
  }: BuildNextJsHostingProps) => {
  const app = new cdk.App()
  const nextJsHosting = new NextJsHostingStack(app, stackName, {
    staticAssetsBucketName: staticAssetsBucketName || `${stackName.toLowerCase()}.static.assets`,
    domainName,
    cname,
    deploymentUsername: `${stackName}Deployment`,
    env: { region, account },
  })

  return { app, nextJsHosting }
}

export { buildNextJsHosting }
