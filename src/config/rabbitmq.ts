import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';

const EXCHANGE = 'uniwheels.events';

@Injectable()
export class RabbitMQService implements OnModuleInit {
  private readonly logger = new Logger(RabbitMQService.name);
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.ConfirmChannel | null = null;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    await this.connect().catch((err) =>
      this.logger.warn(`RabbitMQ inicial no disponible: ${err.message}`),
    );
  }

  async connect(): Promise<void> {
    const url = this.configService.get<string>('rabbitmq.url') || 'amqp://admin:admin@localhost:5672';
    this.connection = await amqp.connect(url);
    this.channel = await this.connection.createConfirmChannel();
    await this.channel.assertExchange(EXCHANGE, 'topic', { durable: true });
    this.logger.log('[RabbitMQ] Conexión establecida');

    this.connection.on('error', () => {
      this.connection = null;
      this.channel = null;
    });
    this.connection.on('close', () => {
      this.connection = null;
      this.channel = null;
    });
  }

  async publish(routingKey: string, payload: Record<string, unknown>): Promise<void> {
    if (!this.channel) {
      try { await this.connect(); } catch (err) {
        this.logger.warn(`[RabbitMQ] No se pudo reconectar: ${(err as Error).message}`);
        return;
      }
    }
    try {
      // NestJS RMQ consumer (@EventPattern) requiere el envelope { pattern, data }
      const message = { pattern: routingKey, data: payload };
      const buffer = Buffer.from(JSON.stringify(message));
      this.channel!.publish(EXCHANGE, routingKey, buffer, { persistent: true });
    } catch (err) {
      this.logger.error(`[RabbitMQ] Error publicando: ${(err as Error).message}`);
    }
  }
}
