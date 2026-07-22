import type {
  Subscription,
  SubscriptionStore,
} from "@okxweb3/app-x402-core/subscription";
import { createClient } from "redis";

type RedisClient = ReturnType<typeof createClient>;

const INDEX_KEY = "deltazero:subscriptions";

export class RedisSubscriptionStore implements SubscriptionStore {
  constructor(private readonly redis: RedisClient) {}

  private key(subId: string): string {
    return `deltazero:subscription:${subId}`;
  }

  async get(subId: string): Promise<Subscription | null> {
    const value = await this.redis.get(this.key(subId));
    return value ? (JSON.parse(value) as Subscription) : null;
  }

  async put(subscription: Subscription): Promise<void> {
    await this.redis
      .multi()
      .set(this.key(subscription.subId), JSON.stringify(subscription))
      .sAdd(INDEX_KEY, subscription.subId)
      .exec();
  }

  async delete(subId: string): Promise<void> {
    await this.redis.multi().del(this.key(subId)).sRem(INDEX_KEY, subId).exec();
  }

  async list(): Promise<Subscription[]> {
    const ids = await this.redis.sMembers(INDEX_KEY);
    const subscriptions = await Promise.all(ids.map((id) => this.get(id)));
    return subscriptions.filter((value): value is Subscription => value !== null);
  }
}
