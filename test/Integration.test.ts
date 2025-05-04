import { Template } from 'aws-cdk-lib/assertions'
import { buildNextJsHosting } from '../src'

describe('Integration', () => {
  test('Stack', () => {
    const { app } = buildNextJsHosting({
      stackName: 'NextJsApp',
      account: '0000000000',
      domainName: 's0na.de',
      cname: 'app',
      staticAssetsBucketName: 'static.assets',
    })

    expect(Template.fromJSON(app)).toMatchSnapshot()
  })
})
