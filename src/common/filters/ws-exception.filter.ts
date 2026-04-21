import { Catch, ArgumentsHost, Logger } from '@nestjs/common';
import { BaseWsExceptionFilter, WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

/**
 * Filtro de excepciones para WebSocket (Socket.IO).
 * Captura errores en el gateway y los emite como evento 'error' al socket.
 */
@Catch()
export class WsExceptionFilter extends BaseWsExceptionFilter {
  private readonly logger = new Logger(WsExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const client: Socket = host.switchToWs().getClient();

    let message = 'Error interno del servidor';

    if (exception instanceof WsException) {
      const error = exception.getError();
      message = typeof error === 'string' ? error : (error as any)?.message ?? message;
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    this.logger.warn(`WS Error [${client.id}]: ${message}`);

    client.emit('error', { message });
  }
}
