# next deployer

## Setup

### extend .gitignore

Add following lines to the `.gitignore`:

```
cdk.out
``` 

This makes sure, that credentials are not committed to git.

### install dependencies

```bash
npm i cdk tsx
```

### deploy infrastructure
```bash
 npx -p @d4ndel1on/next-deployer next-deploy-infrastructure <env> <aws-profile>
```

### deploy frontend
```bash
 npx -p @d4ndel1on/next-deployer next-deploy <env>
```