import { CfnOutput, Duration, RemovalPolicy } from 'aws-cdk-lib'
import { DnsValidatedCertificate } from 'aws-cdk-lib/aws-certificatemanager'
import {
  CacheHeaderBehavior,
  CachePolicy,
  Distribution,
  HttpVersion,
  PriceClass,
  ViewerProtocolPolicy,
} from 'aws-cdk-lib/aws-cloudfront'
import { S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins'
import { AccessKey, User } from 'aws-cdk-lib/aws-iam'
import { ARecord, PublicHostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53'
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets'
import { BlockPublicAccess, Bucket, BucketEncryption, HttpMethods } from 'aws-cdk-lib/aws-s3'
import { Construct } from 'constructs'

export interface CloudfrontHostedS3BucketProps {
  /**
   * Name of the bucket
   */
  readonly bucketName: string;
  /**
   * Domain name where the bucket should be hosted
   */
  readonly domainName: string;
  /**
   * Cname added to the domain
   *
   * @default domainName only
   */
  readonly cname?: string;
  /**
   * Username of the deployment user
   *
   * @default no deployment user is created
   */
  readonly deploymentUsername?: string;
  /**
   * Removal policy of the bucket
   *
   * @default `RemovalPolicy.DESTROY`
   */
  readonly bucketRemovalPolicy?: RemovalPolicy;
  /**
   * Website index document
   *
   * @default index.html
   */
  readonly websiteIndexDocument?: string;
}

export class CloudfrontHostedS3Bucket extends Construct {
  readonly distribution: Distribution
  readonly bucket: Bucket
  readonly accessKey?: AccessKey
  readonly url: string

  constructor(scope: Construct, id: string, props: CloudfrontHostedS3BucketProps) {
    super(scope, id)

    const {
      bucketName,
      domainName,
      cname,
      deploymentUsername,
      websiteIndexDocument = 'index.html',
    } = props

    const fullDomain = cname ? `${cname}.${domainName}` : domainName
    this.url = `https://${fullDomain}`

    const zone = PublicHostedZone.fromLookup(this, 'Zone', { domainName })

    const certificate = new DnsValidatedCertificate(this, 'Certificate', {
      hostedZone: zone,
      domainName: fullDomain,
      region: 'us-east-1',
    })

    this.bucket = new Bucket(this, 'Bucket', {
      websiteIndexDocument: websiteIndexDocument,
      websiteErrorDocument: websiteIndexDocument,
      bucketName,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      removalPolicy: RemovalPolicy.DESTROY,
      versioned: false,
      lifecycleRules: [
        {
          abortIncompleteMultipartUploadAfter: Duration.days(1),
          id: 'AbortIncompleteMultipartUploadAfter',
        },
      ],
      cors: [
        {
          allowedMethods: [HttpMethods.GET, HttpMethods.HEAD],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
          maxAge: 300,
        },
      ],
    })

    this.distribution = new Distribution(this, 'Distribution', {
      priceClass: PriceClass.PRICE_CLASS_100,
      comment: id,
      httpVersion: HttpVersion.HTTP2_AND_3,
      defaultBehavior: {
        origin: S3BucketOrigin.withOriginAccessControl(this.bucket),
        cachePolicy: new CachePolicy(this, 'CachePolicy', {
          comment: `Cache ${id} Bucket`,
          minTtl: Duration.days(30),
          defaultTtl: Duration.days(30),
          maxTtl: Duration.days(30),
          headerBehavior: CacheHeaderBehavior.none(),
        }),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        compress: true,
      },
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: websiteIndexDocument,
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: websiteIndexDocument,
        },
      ],
      enableIpv6: true,
      domainNames: [`${fullDomain}`],
      certificate,
    })

    new ARecord(this, 'ARecord', {
      zone,
      recordName: cname,
      target: RecordTarget.fromAlias(new CloudFrontTarget(this.distribution)),
      ttl: Duration.days(1),
    })

    if (deploymentUsername) {
      const user = new User(this, 'DeploymentUser', {
        userName: deploymentUsername,
      })
      this.accessKey = new AccessKey(this, 'DeploymentAccessKey', { user })
      this.bucket.grantReadWrite(user)
      this.distribution.grantCreateInvalidation(user)
      new CfnOutput(this, 'AccessKeyId', {
        key: 'AccessKeyId',
        value: this.accessKey.accessKeyId,
      })
      new CfnOutput(this, 'SecretKey', {
        key: 'SecretKey',
        value: this.accessKey.secretAccessKey.unsafeUnwrap(),
      })
    }
  }
}