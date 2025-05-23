# next deployer

## Setup

### Add `.env.<environment>` files

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
* MAIL_FROM_DISPLAY_NAME [optional]
    * Add to deploy a contact backend
    * Display name for the email
* MAIL_TO [optional]
    * Add to deploy a contact backend
    * Email addresses to send to (comma separated)
* MAIL_CC [optional]
    * Email addresses to send to in cc (comma separated)
* MAIL_BCC [optional]
    * Email addresses to send to in bcc (comma separated)

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
MAIL_FROM_DISPLAY_NAME=My Customer
MAIL_TO=my-customer@my-customer-domain.de,my-other-customer@test.de
MAIL_CC=my-other-customer3@my-customer-domain.de
MAIL_BCC=my-customer2@my-customer-domain.de,my-other-customer2@test.de
```

This makes sure that credentials are not committed to git.

### add dependency

```bash
npm install --save-dev @simplifyd/next-deployer tsx
```

### deploy infrastructure

```bash
 npx -p @simplifyd/next-deployer next-deploy-infrastructure <env> <aws-profile>
```

### deploy frontend

```bash
 npx -p @simplifyd/next-deployer next-deploy <env>
```

### add github workflows [optional]

Add a github workflow to deploy the code to AWS

```bash
 npx -p @simplifyd/next-deployer add-workflows
```

Will automatically deploy pushes to main to production and pull requests with a label called `test` to dev.

### Add contact backend for email sending

If `MAIL_FROM_DOMAIN`, `MAIL_FROM_DISPLAY_NAME`, `MAIL_TO` environment variables are set, the backend will be created

```
MAIL_FROM_DOMAIN=my-awesome-mail-domain.de
MAIL_FROM_DISPLAY_NAME=My Customer
MAIL_TO=my-customer@my-customer-domain.de,support@customer-domain.de
MAIL_CC=my-other-customer@my-customer-domain.de
MAIL_BCC=my-bcc-customer@my-customer-domain.de
```

The backend is accessible via the url with a prefix of `contact`

Example access:

```typescript
await fetch(`https://contact.${fullDomain}`, {
  method: 'POST',
  body: JSON.stringiyfy({
    fromName: 'Stefan',
    fromEmail: 'my-email@gmail.com',
    text: 'My awesome message from the client',
  })
})
```

#### Add contact backend throttling

If all 2 environment variables are set, the backend will be throttled

```
THROTTLING_RATE_LIMIT=2
THROTTLING_WINDOW=seconds
```

* `THROTTLING_RATE_LIMIT` needs to be between 1 and 20
* `THROTTLING_WINDOW` can be either `seconds`, `minutes` or `hours`

#### Email theming

To theme your email, mjml can be used.
Set the environment variable `MAIL_TEMPLATE_MJML` to the path to the template

```
MAIL_TEMPLATE_MJML=resources/mail/contact_mail.mjml
```

Following variables can be used to be replaced:

* `{{date}}`: contains the current date
* `{{fromEmail}}`: contains the email of the contact
* `{{fromName}}`: contains the name of the contact
* `{{text}}`: contains the contact text