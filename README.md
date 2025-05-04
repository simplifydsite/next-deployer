# next deployer

## Setup

### extend .gitignore

Add `*.out.json` to gitignore. This makes sure, that credentials are not commited to git.

### deploy infrastructure
```bash
 npx -p @d4ndel1on/next-deployer next-deploy-infrastructure <env> <aws-profile>
```

### deploy frontend
```bash
 npx -p @d4ndel1on/next-deployer next-deploy <env>
```