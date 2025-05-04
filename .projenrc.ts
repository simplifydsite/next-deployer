import { awscdk } from 'projen';
const project = new awscdk.AwsCdkConstructLibrary({
  author: 'd4ndel1on',
  authorAddress: 'stefan@fancynetwork.net',
  cdkVersion: '2.1.0',
  defaultReleaseBranch: 'main',
  jsiiVersion: '~5.8.0',
  name: 'next-deployer',
  projenrcTs: true,
  repositoryUrl: 'https://github.com/stefan/next-deployer.git',

  // deps: [],                /* Runtime dependencies of this module. */
  // description: undefined,  /* The description is just a string that helps people understand the purpose of the package. */
  // devDeps: [],             /* Build dependencies for this module. */
  // packageName: undefined,  /* The "name" in package.json. */
});
project.synth();