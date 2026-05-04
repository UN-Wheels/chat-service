import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import * as amqp from 'amqplib';

const EXCHANGE = 'uniwheels.events';

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMQService.name);
  private connection: any = null;
  private channel: any = null;

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    if (this.channel) await this.channel.close();
    if (this.connection) await this.connection.close();
  }

  private async connect() {
    const url = process.env.RABBITMQ_URL || 'amqp://admin:admin@localhost:5672';
    try {
      this.connection = await amqp.connect(url);
      this.channel = await this.connection.createConfirmChannel();

      await this.channel.assertExchange(EXCHANGE, 'topic', { durable: true });
      this.logger.log('Conexión establecida a RabbitMQ');

      this.connection.on('error', (err: any) => {
        this.logger.error(`Error de conexión: ${err.message}`);
        this.connection = null;
        this.channel = null;
      });
    } catch (err) {
      this.logger.error(`Fallo inicial de conexión: ${(err as Error).message}`);
    }
  }

  async publish(routingKey: string, payload: any) {
    if (!this.channel) {
      try {
        await this.connect();
      } catch (err) {
        this.logger.error(`No se pudo reconectar: ${(err as Error).message}`);
        return;
      }
    }

    if (!this.channel) return;

    try {
      // NestJS RMQ consumer (@EventPattern) requiere el envelope { pattern, data }
      const message = { pattern: routingKey, data: payload };
      const buffer = Buffer.from(JSON.stringify(message));
      this.channel.publish(EXCHANGE, routingKey, buffer, { persistent: true });
      this.logger.log(`Publicado desde chat-service: ${routingKey}`);
    } catch (err) {
      this.logger.error(`Error publicando: ${(err as Error).message}`);
    }
  }
}
