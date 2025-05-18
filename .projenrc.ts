import { awscdk } from 'projen'
import { LambdaRuntime } from 'projen/lib/awscdk'
import { NodePackageManager, NpmAccess } from 'projen/lib/javascript'

const project = new awscdk.AwsCdkConstructLibrary({
  author: 'd4ndel1on',
  authorAddress: 'github.overfed135@passmail.net',
  cdkVersion: '2.196.0',
  defaultReleaseBranch: 'main',
  name: '@simplifyd/next-deployer',
  projenrcTs: true,
  minMajorVersion: 1,
  repositoryUrl: 'https://github.com/d4ndel1on/next-deployer.git',
  eslint: true,
  depsUpgradeOptions: {
    workflow: false,
  },
  npmAccess: NpmAccess.PUBLIC,
  packageManager: NodePackageManager.NPM,
  minNodeVersion: '22.15.0',
  bundledDeps: [
    '@aws-lambda-powertools/logger',
    '@aws-sdk/client-dynamodb',
    '@aws-sdk/client-ses',
    '@aws-sdk/util-dynamodb',
    '@middy/core',
    '@middy/error-logger',
    '@middy/http-cors',
    '@middy/http-error-handler',
    '@middy/http-header-normalizer',
    '@middy/http-router',
    'aws-lambda',
    'date-fns',
    'fs-extra',
    'http-errors',
    'humps',
  ],
  deps: ['humps', 'fs-extra'],
  devDeps: [
    '@types/humps',
    '@types/fs-extra',
    '@types/node',
    'esbuild',
    '@types/aws-lambda',
    '@types/http-errors',
  ],
  lambdaOptions: {
    runtime: LambdaRuntime.NODEJS_22_X,
    bundlingOptions: {
      externals: ['@aws-sdk/*', '@aws-lambda-powertools/*'],
      sourcemap: true,
    },
  },
})

project.eslint?.addRules({
  '@stylistic/semi': ['error', 'never'],
  '@stylistic/comma-dangle': ['error', 'always-multiline'],
})
project.eslint?.addIgnorePattern('*-function.ts')

project.tryFindObjectFile('.github/workflows/build.yml')!
  .addOverride('jobs.build.steps.5.with', {
    'retention-days': 5,
  })

project.tryFindObjectFile('.github/workflows/build.yml')!
  .addOverride('jobs.build.steps.8.with', {
    'retention-days': 5,
    'include-hidden-files': 'true',
  })

project.addTask('pack', {
  exec: 'rm -rf dist && mkdir -p ~/.releases && npm run build && npm pack --pack-destination ~/.releases',
  description: 'Packs the current release for local development',
})

project.addBins({ 'next-deploy': 'scripts/deploy.sh' })
project.addBins({ 'next-deploy-infrastructure': 'scripts/deploy_infrastructure.sh' })
project.addBins({ 'add-workflow': 'scripts/add_workflow.sh' })

project.npmignore?.removePatterns('/src/')
project.npmignore?.addPatterns('/src/**/*.test.ts')
project.gitignore.addPatterns('/tmp/')

project.synth()