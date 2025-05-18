import { Logger } from '@aws-lambda-powertools/logger'
import { DynamoDBClient, PutItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb'
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb'
import { addDays, subHours, subMinutes, subSeconds } from 'date-fns'

export type ThrottlingServiceProps = {
  tableName: string;
  rateLimit: number;
  window: 'seconds' | 'minutes' | 'hours';
}

export class ThrottlingService {
  private readonly logger = new Logger({ serviceName: 'ThrottlingService' })
  private readonly dynamodb = new DynamoDBClient()
  private readonly tableName: string
  private readonly rateLimit: number
  private readonly window: 'seconds' | 'minutes' | 'hours'

  constructor({ tableName, rateLimit, window }: ThrottlingServiceProps) {
    this.tableName = tableName
    this.rateLimit = rateLimit
    this.window = window
  }

  checkAllowed = async (onUnallowed: () => void): Promise<void> => {
    const windowStart = this.calculateWindowStart()
    const response = await this.dynamodb.send(new QueryCommand({
      TableName: this.tableName,
      Limit: this.rateLimit,
      KeyConditionExpression: '#key = :key',
      ExpressionAttributeNames: {
        '#key': 'key',
      },
      ExpressionAttributeValues: {
        ':key': marshall('event'),
      },
      ScanIndexForward: false,
    }))
    if (!response.Items) {
      await this.storeEvent()
      return
    }
    if (response.Items?.length < this.rateLimit) {
      await this.storeEvent()
      return
    }
    const checkedEventTime = unmarshall(response.Items.pop()!).eventTime
    if (checkedEventTime > windowStart) {
      this.logger.warn(`Rate limit reached. Window start: ${windowStart}.`)
      onUnallowed()
      return
    }
    await this.storeEvent()
  }

  private storeEvent = async () => {
    await this.dynamodb.send(new PutItemCommand({
      TableName: this.tableName,
      Item: marshall({
        key: 'event',
        eventTime: new Date().toISOString(),
        ttl: Math.floor(addDays(new Date(), 1).getTime() / 1000),
      }),
    }))
    this.logger.info('Throttling event stored.')
  }

  private calculateWindowStart = () => {
    switch (this.window) {
      case 'seconds':
        return subSeconds(new Date(), 1).toISOString()
      case 'minutes':
        return subMinutes(new Date(), 1).toISOString()
      case 'hours':
        return subHours(new Date(), 1).toISOString()
    }
  }
}