import { Stack, StackProps } from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { CloudfrontHostedS3Bucket } from '../constructs/CloudfrontHostedS3Bucket'

export type NextJsHostingStackProps = {
  /**
   * Unique bucket name to store the static assets in
   */
  staticAssetsBucketName: string;
  /**
   * Base domain name for the hosted zone
   */
  domainName: string;
  /**
   * Cname of the domain to use
   *
   * @default: use domainName only
   */
  cname?: string;
  /**
   * Deployment username
   */
  deploymentUsername: string;
} & StackProps

export class NextJsHostingStack extends Stack {
  constructor(scope: Construct, id: string, props: NextJsHostingStackProps) {
    super(scope, id, props)

    const {
      staticAssetsBucketName,
      deploymentUsername,
      domainName,
      cname,
    } = props

    new CloudfrontHostedS3Bucket(this, 'HostedBucket', {
      bucketName: staticAssetsBucketName,
      websiteIndexDocument: 'index.html',
      deploymentUsername,
      domainName,
      cname,
    })
  }
}