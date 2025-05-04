import { App } from 'aws-cdk-lib'
import { Template } from 'aws-cdk-lib/assertions'
import { NextJsHostingStack } from '../lib/stacks/NextJsHostingStack'

describe('Integration', () => {
  test('Stack', () => {
    const app = new App()
    new NextJsHostingStack(app, 'Stack', {
      stackName: 'NextJsApp',
      domainName: 's0na.de',
      cname: 'app',
      staticAssetsBucketName: 'static.assets',
      deploymentUsername: 'user',
      env: {
        account: '000000000',
        region: 'eu-central-1',
      },
    })

    Template.fromJSON(app)
  })
})
