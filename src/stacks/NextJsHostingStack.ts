import { Stack, StackProps } from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { CloudfrontHostedS3Bucket } from '../constructs/CloudfrontHostedS3Bucket'
import { ContactBackend } from '../constructs/ContactBackend'

export type NextJsHostingContactBackendProps = {
  /**
   * Base domain where the email should be sent from
   */
  readonly mailFromDomain: string;
  /**
   * Mail from display name
   */
  readonly mailFromDisplayName: string;
  /**
   * Email address of the client.
   */
  readonly clientEmail: string;
}

export type NextJsHostingStackProps = {
  /**
   * Unique bucket name to store the static assets in
   */
  readonly staticAssetsBucketName: string;
  /**
   * Base domain name for the hosted zone
   */
  readonly domainName: string;
  /**
   * Cname of the domain to use
   *
   * @default: use domainName only
   */
  readonly cname?: string;
  /**
   * Deployment username
   */
  readonly deploymentUsername: string;
  /**
   * Contact backend props
   */
  readonly contactBackend?: NextJsHostingContactBackendProps;
} & StackProps

export class NextJsHostingStack extends Stack {
  constructor(scope: Construct, id: string, props: NextJsHostingStackProps) {
    super(scope, id, props)

    const {
      staticAssetsBucketName,
      deploymentUsername,
      domainName,
      cname,
      contactBackend,
    } = props

    new CloudfrontHostedS3Bucket(this, 'HostedBucket', {
      bucketName: staticAssetsBucketName,
      deploymentUsername,
      domainName,
      cname,
    })

    if (contactBackend) {
      new ContactBackend(this, 'ContactBackend', {
        baseDomain: domainName,
        clientEmail: contactBackend.clientEmail,
        mailFromDisplayName: contactBackend.mailFromDisplayName,
        mailFromDomain: contactBackend.mailFromDomain,
      })
    }
  }
}