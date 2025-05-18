import { CfnOutput, RemovalPolicy, Stack } from 'aws-cdk-lib'
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
import { PolicyStatement } from 'aws-cdk-lib/aws-iam'
import { LayerVersion } from 'aws-cdk-lib/aws-lambda'
import { ARecord, HostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53'
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets'
import { StringParameter } from 'aws-cdk-lib/aws-ssm'
import { Construct } from 'constructs'
import { EmailBackendFunction } from '../lambda/emailBackend-function'

export type ContactBackendThrottlingProps = {
  rateLimit: number;
  window: 'seconds' | 'minutes' | 'hours';
}

export type ContactBackendProps = {
  clientEmail: string;
  mailFromDomain: string;
  mailFromDisplayName: string;
  baseDomain: string;
  cname?: string;
  throttling?: ContactBackendThrottlingProps;
}

export class ContactBackend extends Construct {
  private throttlingTable: Table | undefined

  constructor(scope: Construct, id: string, props: ContactBackendProps) {
    super(scope, id)

    const {
      clientEmail,
      mailFromDomain,
      mailFromDisplayName,
      baseDomain,
      cname,
      throttling,
    } = props

    this.addThrottlingValidation(throttling)

    const stackName = Stack.of(this).stackName
    const fullDomain = cname ? `contact.${cname}.${baseDomain}` : `contact.${baseDomain}`

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
      environment: {
        CLIENT_EMAIL: clientEmail,
        MAIL_FROM: `contact@${mailFromDomain}`,
        MAIL_FROM_DISPLAY_NAME: mailFromDisplayName,
        ALLOWED_ORIGIN: `https://${fullDomain}`,
        ...(throttling && {
          THROTTLING_TABLE_NAME: this.throttlingTable!.tableName,
          THROTTLING_RATE_LIMIT: throttling.rateLimit.toString(),
          THROTTLING_WINDOW: throttling.window,
        }),
      },
      layers: [powertoolsLayer],
    })
    lambda.addToRolePolicy(new PolicyStatement({
      actions: ['ses:SendEmail'],
      resources: ['*'],
    }))
    this.throttlingTable?.grantReadWriteData(lambda)

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
}