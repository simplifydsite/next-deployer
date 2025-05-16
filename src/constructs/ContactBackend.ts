import { CfnOutput } from 'aws-cdk-lib'
import { Cors, CorsOptions, EndpointType, LambdaIntegration, RestApi, UsagePlan } from 'aws-cdk-lib/aws-apigateway'
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
import { PolicyStatement } from 'aws-cdk-lib/aws-iam'
import { LayerVersion } from 'aws-cdk-lib/aws-lambda'
import { ARecord, HostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53'
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets'
import { StringParameter } from 'aws-cdk-lib/aws-ssm'
import { Construct } from 'constructs'
import { EmailBackendFunction } from '../lambda/emailBackend-function'

export type ContactBackendProps = {
  clientEmail: string;
  mailFromDomain: string;
  baseDomain: string;
}

export class ContactBackend extends Construct {
  constructor(scope: Construct, id: string, props: ContactBackendProps) {
    super(scope, id)

    const {
      clientEmail,
      mailFromDomain,
      baseDomain,
    } = props

    const fullDomain = `contact.${baseDomain}`

    let powertoolsLayer = LayerVersion.fromLayerVersionArn(
      this,
      'PowertoolsLayer',
      StringParameter.valueForStringParameter(this, '/aws/service/powertools/typescript/generic/all/latest'),
    )
    const lambda = new EmailBackendFunction(this, 'EmailBackend', {
      environment: {
        CLIENT_EMAIL: clientEmail,
        MAIL_FROM: `contact@${mailFromDomain}`,
        ALLOWED_ORIGIN: `https://${fullDomain}`,
      },
      layers: [powertoolsLayer],
    })
    lambda.addToRolePolicy(new PolicyStatement({
      actions: ['ses:SendEmail'],
      resources: ['*'],
    }))

    const corsOptions: CorsOptions = {
      allowCredentials: true,
      allowOrigins: [`https://${fullDomain}`],
      allowHeaders: ['*'],
      allowMethods: Cors.ALL_METHODS,
    }

    const api = new RestApi(this, 'ApiGateway', {
      description: 'Contact Backend',
      restApiName: 'ContactBackend',
      endpointTypes: [EndpointType.REGIONAL],
      defaultCorsPreflightOptions: corsOptions,
      defaultMethodOptions: {
        apiKeyRequired: true,
      },
    })

    api.root
      .addMethod('POST', new LambdaIntegration(lambda))

    const usagePlan = new UsagePlan(this, 'UsagePlan', {
      description: 'Contact usage plan',
    })
    usagePlan.addApiStage({
      api: api,
      stage: api.deploymentStage,
    })

    const zone = HostedZone.fromLookup(this, 'Zone', { domainName: baseDomain })

    const certificate = new DnsValidatedCertificate(this, 'Certificate', {
      domainName: fullDomain,
      region: 'us-east-1',
      hostedZone: zone,
    })

    const distribution = new Distribution(this, 'Distribution', {
      comment: 'Contact Backend Distribution',
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
      recordName: 'contact',
    })

    new CfnOutput(this, 'ApiUrl', {
      description: 'ImportAdapter API Url',
      key: 'ContactBackendUrl',
      value: `https://${fullDomain}`,
    })
  }
}