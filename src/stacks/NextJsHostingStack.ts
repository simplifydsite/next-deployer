import { Stack, StackProps } from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { CloudfrontHostedS3Bucket } from '../constructs/CloudfrontHostedS3Bucket'
import { ContactBackend, ContactBackendThrottlingProps } from '../constructs/ContactBackend'

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
   * Email addresses to send mail to.
   * Comma separated.
   */
  readonly mailTo: string;
  /**
   * Email addresses to send mail to in cc.
   * Comma separated.
   */
  readonly mailCc?: string;
  /**
   * Email addresses to send mail to in bcc.
   * Comma separated.
   */
  readonly mailBcc?: string;
  /**
   * Throttling props
   */
  readonly throttling?: ContactBackendThrottlingProps;
  /**
   * S3 file key for the MJML template for the email
   *
   * @default: use default template
   */
  readonly mailTemplateKey?: string;
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
        mailTo: contactBackend.mailTo,
        mailCc: contactBackend.mailCc,
        mailBcc: contactBackend.mailBcc,
        mailTemplateKey: contactBackend.mailTemplateKey,
        mailFromDisplayName: contactBackend.mailFromDisplayName,
        mailFromDomain: contactBackend.mailFromDomain,
        throttling: contactBackend.throttling,
        cname,
      })
    }
  }
}