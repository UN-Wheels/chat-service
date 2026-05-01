import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';

const EXCHANGE = 'uniwheels.events';

@Injectable()
export class RabbitMQService implements OnModuleInit {
  private readonly logger = new Logger(RabbitMQService.name);
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.ConfirmChannel | null = null;
  private reconnecting = false;
  private readonly RECONNECT_DELAY_MS = 5000;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    this.scheduleConnect(0);
  }

  private scheduleConnect(delayMs: number): void {
    if (this.reconnecting) return;
    this.reconnecting = true;
    setTimeout(() => {
      this.connect()
        .then(() => { this.reconnecting = false; })
        .catch((err) => {
          this.reconnecting = false;
          this.logger.warn(`[RabbitMQ] Reintento de conexion fallo: ${(err as Error).message}`);
          this.scheduleConnect(this.RECONNECT_DELAY_MS);
        });
    }, delayMs);
  }

  async connect(): Promise<void> {
    const url = this.configService.get<string>('rabbitmq.url') || 'amqp://admin:admin@localhost:5672';
    // heartbeat=30 mantiene viva la conexion AMQP frente a timeouts del bridge Docker.
    this.connection = await amqp.connect(url, { heartbeat: 30 });
    this.channel = await this.connection.createConfirmChannel();
    await this.channel.assertExchange(EXCHANGE, 'topic', { durable: true });
    this.logger.log('[RabbitMQ] Conexión establecida');

    const onLost = (reason: string) => (err?: Error) => {
      this.logger.warn(`[RabbitMQ] Conexion ${reason}: ${err?.message ?? 'sin detalle'}`);
      this.connection = null;
      this.channel = null;
      this.scheduleConnect(this.RECONNECT_DELAY_MS);
    };
    this.connection.on('error', onLost('error'));
    this.connection.on('close', onLost('close'));
  }

  async publish(routingKey: string, payload: Record<string, unknown>): Promise<void> {
    if (!this.channel) {
      this.logger.warn(`[RabbitMQ] Canal no disponible al publicar ${routingKey}; reintentando conexion`);
      this.scheduleConnect(0);
      return;
    }
    try {
      // NestJS RMQ consumer (@EventPattern) requiere el envelope { pattern, data }
      const message = { pattern: routingKey, data: payload };
      const buffer = Buffer.from(JSON.stringify(message));
      this.channel.publish(EXCHANGE, routingKey, buffer, { persistent: true });
    } catch (err) {
      this.logger.error(`[RabbitMQ] Error publicando: ${(err as Error).message}`);
      this.scheduleConnect(this.RECONNECT_DELAY_MS);
    }
  }
}
