import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';

const EXCHANGE = 'uniwheels.events';

@Injectable()
export class RabbitMQPublisherService implements OnModuleInit {
  private readonly logger = new Logger(RabbitMQPublisherService.name);
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.ConfirmChannel | null = null;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    await this.connect();
  }

  private async connect(): Promise<void> {
    const url =
      this.configService.get<string>('RABBITMQ_URL') ||
      process.env.RABBITMQ_URL;

    if (!url) {
      this.logger.warn('RABBITMQ_URL no configurado — chat.message deshabilitado');
      return;
    }

    try {
      this.connection = await amqp.connect(url);
      this.channel = await this.connection.createConfirmChannel();
      await this.channel.assertExchange(EXCHANGE, 'topic', { durable: true });
      this.logger.log('RabbitMQ publisher conectado');

      this.connection.on('error', (err) => {
        this.logger.error(`RabbitMQ conexión: ${err.message}`);
        this.connection = null;
        this.channel = null;
      });
    } catch (err) {
      this.logger.error(`RabbitMQ no disponible: ${(err as Error).message}`);
      this.connection = null;
      this.channel = null;
    }
  }

  async publish(routingKey: string, payload: Record<string, unknown>): Promise<void> {
    if (!this.channel) {
      await this.connect();
    }
    if (!this.channel) {
      this.logger.warn(`No se publicó ${routingKey}: sin canal RabbitMQ`);
      return;
    }

    try {
      const message = { pattern: routingKey, data: payload };
      const buffer = Buffer.from(JSON.stringify(message));
      this.channel.publish(EXCHANGE, routingKey, buffer, { persistent: true });
      this.logger.log(`Publicado: ${routingKey}`);
    } catch (err) {
      this.logger.error(`Error publicando ${routingKey}: ${(err as Error).message}`);
    }
  }
}
