# next deployer

## Setup

### Add `.env.<environment> files`

Add a file for each environment you want to have.

Parameters:
* STACK_NAME
  * Cloudformation Stack name
  * Needs to be unique in each aws account
* S3_BUCKET
  * AWS S3 Bucket name 
  * Needs to be globally unique
* DOMAIN_NAME
  * Base domain name
  * HostedZone needs to exist in the AWS Account already
* CNAME [optional]
  * CNAME on top of the domain name
* AWS_REGION
  * AWS Region
  * e.g. eu-central-1 for Frankfurt or eu-west-1 for Dublin
* AWS_ACCOUNT
  * AWS Account id
* MAIL_FROM_DOMAIN [optional]
  * Add to deploy a contact backend
  * Domain where the email is sent from
* CLIENT_EMAIL
  * Add to deploy a contact backend
  * Email of the client

Example:

`.env.prod`
```
STACK_NAME=MyAwesomeAwsCloudformationStackName
S3_BUCKET=my.awesome.s3.bucket.name
DOMAIN_NAME=my-awesome-domain.de
CNAME=my-awesome-project
AWS_REGION=eu-central-1
AWS_ACCOUNT=XXXXXXXXXXXX
MAIL_FROM_DOMAIN=my-awesome-mail-domain.de
CLIENT_EMAIL=my-customer@my-customer-domain.de
```

This makes sure that credentials are not committed to git.

### deploy infrastructure
```bash
 npx -p @d4ndel1on/next-deployer next-deploy-infrastructure <env> <aws-profile>
```

### deploy frontend
```bash
 npx -p @d4ndel1on/next-deployer next-deploy <env>
```

### add github workflow [optional]

Add a github workflow to deploy the code to AWS
```bash
 npx -p @d4ndel1on/next-deployer add-workflow
```