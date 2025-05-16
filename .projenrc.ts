import { awscdk } from 'projen'
import { NodePackageManager } from 'projen/lib/javascript'

const project = new awscdk.AwsCdkConstructLibrary({
  author: 'd4ndel1on',
  authorAddress: 'github.overfed135@passmail.net',
  cdkVersion: '2.194.0',
  defaultReleaseBranch: 'main',
  name: '@d4ndel1on/next-deployer',
  projenrcTs: true,
  repositoryUrl: 'https://github.com/d4ndel1on/next-deployer.git',
  eslint: true,
  depsUpgradeOptions: {
    workflow: false,
  },
  packageManager: NodePackageManager.NPM,
  minNodeVersion: '22.15.0',
  npmRegistryUrl: 'https://npm.pkg.github.com',
  bundledDeps: ['humps', 'fs-extra', 'tsx'],
  devDeps: ['@types/humps', '@types/fs-extra', '@types/node', 'esbuild'],
})

project.eslint?.addRules({
  'semi': ['error', 'never'],
  'comma-dangle': ['error', 'always-multiline'],
})

project.tryFindObjectFile('.github/workflows/build.yml')!
  .addOverride('jobs.build.steps.5.with', {
    'retention-days': 5,
  })

project.tryFindObjectFile('.github/workflows/build.yml')!
  .addOverride('jobs.build.steps.8.with', {
    'retention-days': 5,
    'include-hidden-files': 'true',
  })

project.tryFindObjectFile('.github/workflows/release.yml')!
  .addOverride('jobs.release.env', {
    CI: 'true',
    NPM_AUTH_TOKEN: '${{ secrets.PROJEN_GITHUB_TOKEN }}',
  })

project.tryFindObjectFile('.github/workflows/release.yml')!
  .addOverride('jobs.release_npm.env', {
    NPM_AUTH_TOKEN: '${{ secrets.PROJEN_GITHUB_TOKEN }}',
  })

project.tryFindObjectFile('.github/workflows/build.yml')!
  .addOverride('jobs.build.env', {
    NPM_AUTH_TOKEN: '${{secrets.PROJEN_GITHUB_TOKEN}}',
  })

project.tryFindObjectFile('.github/workflows/build.yml')!
  .addOverride('jobs.package-js.env', {
    NPM_AUTH_TOKEN: '${{secrets.PROJEN_GITHUB_TOKEN}}',
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