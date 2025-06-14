import { CfnOutput, Duration, RemovalPolicy, Stack } from 'aws-cdk-lib'
import { Cors, CorsOptions, EndpointType, LambdaIntegration, RestApi } from 'aws-cdk-lib/aws-apigateway'
import { DnsValidatedCertificate } from 'aws-cdk-lib/aws-certificatemanager'
import {
  AllowedMethods,
  CachePolicy,
  Distribution,
  HttpVersion,
  OriginRequestPolicy,
  PriceClass,
  SecurityPolicyProtocol,
  ViewerProtocolPolicy,
} from 'aws-cdk-lib/aws-cloudfront'
import { RestApiOrigin } from 'aws-cdk-lib/aws-cloudfront-origins'
import { AttributeType, BillingMode, Table, TableEncryption } from 'aws-cdk-lib/aws-dynamodb'
import { Architecture, LayerVersion } from 'aws-cdk-lib/aws-lambda'
import { ARecord, HostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53'
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets'
import { BlockPublicAccess, Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3'
import { Secret } from 'aws-cdk-lib/aws-secretsmanager'
import { StringParameter } from 'aws-cdk-lib/aws-ssm'
import { Construct } from 'constructs'
import { EmailBackendFunction } from '../lambda/emailBackend-function'
import { isEmail } from '../utils/isEmail'

export type ContactBackendThrottlingProps = {
  rateLimit: number;
  window: 'seconds' | 'minutes' | 'hours';
}

export type ContactBackendProps = {
  mailFrom: string;
  mailTo: string;
  mailCc?: string;
  mailBcc?: string;
  mailFromDisplayName: string;
  baseDomain: string;
  cname?: string;
  throttling?: ContactBackendThrottlingProps;
  mailTemplateKey?: string;
  gmailSecretArn: string;
}

export class ContactBackend extends Construct {
  private throttlingTable: Table | undefined

  constructor(scope: Construct, id: string, props: ContactBackendProps) {
    super(scope, id)

    const {
      mailFrom,
      mailTo,
      mailCc,
      mailBcc,
      mailFromDisplayName,
      baseDomain,
      cname,
      throttling,
      mailTemplateKey,
      gmailSecretArn,
    } = props

    this.addThrottlingValidation(throttling)
    this.addEmailValidation(props)

    const stackName = Stack.of(this).stackName
    const fullDomain = cname ? `contact.${cname}.${baseDomain}` : `contact.${baseDomain}`
    const corsOrigin = cname ? `https://${cname}.${baseDomain}` : `https://${baseDomain}`

    let mailTemplateBucket: Bucket | undefined
    if (mailTemplateKey) {
      mailTemplateBucket = new Bucket(this, 'MailTemplateBucket', {
        bucketName: `${stackName.toLowerCase()}.mail.templates`,
        encryption: BucketEncryption.S3_MANAGED,
        removalPolicy: RemovalPolicy.DESTROY,
        autoDeleteObjects: true,
        versioned: false,
        blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      })
    }

    if (throttling) {
      this.throttlingTable = new Table(this, 'ThrottlingTable', {
        billingMode: BillingMode.PAY_PER_REQUEST,
        encryption: TableEncryption.AWS_MANAGED,
        removalPolicy: RemovalPolicy.DESTROY,
        partitionKey: { name: 'key', type: AttributeType.STRING },
        sortKey: { name: 'eventTime', type: AttributeType.STRING },
        timeToLiveAttribute: 'ttl',
      })
    }

    let powertoolsLayer = LayerVersion.fromLayerVersionArn(
      this,
      'PowertoolsLayer',
      StringParameter.valueForStringParameter(this, '/aws/service/powertools/typescript/generic/all/latest'),
    )
    const lambda = new EmailBackendFunction(this, 'EmailBackend', {
      description: `${stackName} Contact Backend`,
      architecture: Architecture.ARM_64,
      memorySize: 512,
      timeout: Duration.seconds(5),
      environment: {
        MAIL_TO: mailTo,
        MAIL_CC: mailCc || '',
        MAIL_BCC: mailBcc || '',
        MAIL_FROM: mailFrom,
        MAIL_FROM_DISPLAY_NAME: mailFromDisplayName,
        MAIL_TEMPLATE_BUCKET: mailTemplateBucket?.bucketName || '',
        MAIL_TEMPLATE_KEY: mailTemplateKey || '',
        GMAIL_SECRET_ARN: gmailSecretArn,
        ALLOWED_ORIGIN: corsOrigin,
        ...(throttling && {
          THROTTLING_TABLE_NAME: this.throttlingTable!.tableName,
          THROTTLING_RATE_LIMIT: throttling.rateLimit.toString(),
          THROTTLING_WINDOW: throttling.window,
        }),
      },
      layers: [powertoolsLayer],
    })
    this.throttlingTable?.grantReadWriteData(lambda)
    mailTemplateBucket?.grantRead(lambda)

    const gmailSecret = Secret.fromSecretCompleteArn(this, 'GmailSecret', gmailSecretArn)
    gmailSecret.grantRead(lambda)

    const corsOptions: CorsOptions = {
      allowCredentials: true,
      allowOrigins: [`https://${fullDomain}`],
      allowHeaders: ['*'],
      allowMethods: Cors.ALL_METHODS,
    }

    const api = new RestApi(this, 'ApiGateway', {
      description: `${stackName} Contact Backend`,
      restApiName: `${stackName}ContactBackend`,
      endpointTypes: [EndpointType.REGIONAL],
      defaultCorsPreflightOptions: corsOptions,
    })

    api.root.addMethod('POST', new LambdaIntegration(lambda))

    const zone = HostedZone.fromLookup(this, 'Zone', { domainName: baseDomain })

    const certificate = new DnsValidatedCertificate(this, 'Certificate', {
      domainName: fullDomain,
      region: 'us-east-1',
      hostedZone: zone,
    })

    const distribution = new Distribution(this, 'Distribution', {
      comment: `${stackName} Contact Backend`,
      defaultBehavior: {
        origin: new RestApiOrigin(api),
        cachePolicy: CachePolicy.CACHING_DISABLED,
        allowedMethods: AllowedMethods.ALLOW_ALL,
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        originRequestPolicy: OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        compress: false,
      },
      httpVersion: HttpVersion.HTTP2_AND_3,
      priceClass: PriceClass.PRICE_CLASS_100,
      minimumProtocolVersion: SecurityPolicyProtocol.TLS_V1_2_2021,
      domainNames: [fullDomain],
      certificate,
    })

    new ARecord(this, 'CloudFrontRecord', {
      zone,
      target: RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
      recordName: cname ? `contact.${cname}` : 'contact',
    })

    if (mailTemplateBucket) {
      new CfnOutput(this, 'MailTemplateBucketName', {
        description: 'ContactBackend Mail template bucket name',
        key: 'ContactBackendMailTemplateBucketName',
        value: mailTemplateBucket.bucketName,
      })
    }

    new CfnOutput(this, 'ApiUrl', {
      description: 'ImportAdapter API Url',
      key: 'ContactBackendUrl',
      value: `https://${fullDomain}`,
    })
  }

  addThrottlingValidation = (throttling?: ContactBackendThrottlingProps) => {
    if (throttling) {
      this.node.addValidation({
        validate(): string[] {
          const errors: string[] = []
          if (throttling.rateLimit < 1 || throttling.rateLimit > 20) {
            errors.push('throttling.rateLimit must be between 1 and 20')
          }
          if (throttling.window !== 'seconds' && throttling.window !== 'minutes' && throttling.window !== 'hours') {
            errors.push('throttling.window must be either "seconds", "minutes" or "hours"')
          }
          return errors
        },
      })
    }
  }

  private addEmailValidation = (props: ContactBackendProps) => {
    this.node.addValidation({
      validate(): string[] {
        const errors: string[] = []
        if (!props.mailTo) {
          errors.push('Property mailTo is missing. Either remove all mail props or add the necessary ones')
        }
        if (props.mailTo) {
          for (const mailTo of props.mailTo.split(',').map(m => m.trim())) {
            if (!isEmail(mailTo)) {
              errors.push(`Property mailTo contains invalid email ${mailTo}`)
            }
          }
        }
        if (props.mailCc) {
          for (const mailCc of props.mailCc.split(',').map(m => m.trim())) {
            if (!isEmail(mailCc)) {
              errors.push(`Property mailCc contains invalid email ${mailCc}`)
            }
          }
        }
        if (props.mailBcc) {
          for (const mailBcc of props.mailBcc.split(',').map(m => m.trim())) {
            if (!isEmail(mailBcc)) {
              errors.push(`Property mailBcc contains invalid email ${mailBcc}`)
            }
          }
        }
        return errors
      },
    })
  }
}