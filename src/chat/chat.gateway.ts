import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger, UseFilters, UsePipes, ValidationPipe } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { ChatService } from './chat.service';
import { RabbitMQPublisherService } from '../events/rabbitmq-publisher.service';
import { JwtPayload } from '../auth/interfaces';
import { WsExceptionFilter } from '../common/filters/ws-exception.filter';

interface SocketUser {
  userId: string;
  role?: 'user' | 'admin';
}

/**
 * Gateway de Socket.IO para el chat en tiempo real.
 *
 * Eventos entrantes:
 *   - conversation:join    → unirse al room de una conversación
 *   - conversation:leave   → salir del room
 *   - message:send         → enviar un mensaje
 *   - message:delivered     → confirmar recepción de un mensaje
 *   - message:read          → marcar conversación como leída
 *
 * Eventos salientes:
 *   - message:new           → nuevo mensaje (al room de la conversación)
 *   - message:status        → cambio de estado de un mensaje
 *   - notification:new      → notificación al usuario destinatario
 *   - error                 → error al socket que lo causó
 */
@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
  namespace: '/',
})
@UseFilters(new WsExceptionFilter())
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly configService: ConfigService,
    private readonly rabbitPublisher: RabbitMQPublisherService,
  ) {}

  // ──────────────────────────────────────────────
  //  Conexión / Desconexión
  // ──────────────────────────────────────────────

  async handleConnection(client: Socket): Promise<void> {
    try {
      const user = this.authenticateSocket(client);
      client.data.user = user;

      // Unir al room personal del usuario (para notificaciones)
      const userRoom = `user:${user.userId}`;
      client.join(userRoom);

      this.logger.log(`Socket conectado: ${client.id} (user: ${user.userId})`);
    } catch {
      this.logger.warn(`Socket rechazado: ${client.id} — token invalido`);
      client.emit('error', { message: 'Autenticacion fallida' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    const userId = client.data?.user?.userId;
    this.logger.log(`Socket desconectado: ${client.id} (user: ${userId ?? 'unknown'})`);
  }

  /**
   * Valida JWT en el handshake del socket.
   * Soporta auth.token, header Authorization, y cookie accessToken.
   */
  private authenticateSocket(client: Socket): SocketUser {
    const token = this.extractTokenFromSocket(client);

    if (!token) {
      throw new Error('Token no proporcionado');
    }

    const secret = this.configService.get<string>('jwt.accessSecret');
    const decoded = jwt.verify(token, secret!) as JwtPayload;

    // Normalizar: loggueo_service emite "sub" (email), otros servicios pueden usar "user_id"
    const userId = decoded.user_id ?? decoded.sub;

    if (!userId) {
      throw new Error('Token sin user_id');
    }

    return {
      userId,
      role: decoded.role,
    };
  }

  private extractTokenFromSocket(client: Socket): string | undefined {
    // 1. Desde auth del handshake
    const auth = client.handshake.auth as { token?: string } | undefined;
    if (auth?.token) return auth.token;

    // 2. Header Authorization
    const authHeader = client.handshake.headers?.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // 3. Cookie access_token (nombre estándar definido por el API Gateway)
    const cookieHeader = client.handshake.headers?.cookie;
    if (cookieHeader) {
      const match = cookieHeader
        .split(';')
        .find((c) => c.trim().startsWith('access_token='));
      if (match) {
        return match.split('=')[1]?.trim();
      }
    }

    return undefined;
  }

  // ──────────────────────────────────────────────
  //  Eventos de conversación
  // ──────────────────────────────────────────────

  @SubscribeMessage('conversation:join')
  async handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string },
  ): Promise<void> {
    const userId = client.data?.user?.userId;
    if (!userId || !payload?.conversationId) return;

    try {
      // Verificar que el usuario es participante
      await this.chatService.getConversationForUser(
        payload.conversationId,
        userId,
      );

      const room = `conversation:${payload.conversationId}`;
      client.join(room);

      // Marcar mensajes pendientes como DELIVERED al unirse
      const deliveredCount = await this.chatService.markManyDelivered(
        payload.conversationId,
        userId,
      );

      if (deliveredCount > 0) {
        // Notificar al room que hay mensajes delivered
        this.server.to(room).emit('message:status', {
          conversationId: payload.conversationId,
          bulkStatus: 'DELIVERED',
          count: deliveredCount,
          userId,
        });
      }

      this.logger.debug(
        `User ${userId} joined conversation:${payload.conversationId}`,
      );
    } catch {
      client.emit('error', {
        message: 'No se pudo unir a la conversacion',
      });
    }
  }

  @SubscribeMessage('conversation:leave')
  handleLeaveConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string },
  ): void {
    if (!payload?.conversationId) return;

    const room = `conversation:${payload.conversationId}`;
    client.leave(room);

    this.logger.debug(
      `User ${client.data?.user?.userId} left conversation:${payload.conversationId}`,
    );
  }

  // ──────────────────────────────────────────────
  //  Envío de mensajes
  // ──────────────────────────────────────────────

  @SubscribeMessage('message:send')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string; content: string },
  ): Promise<{ success: boolean; message?: any; error?: string }> {
    const userId = client.data?.user?.userId;

    if (!userId || !payload?.conversationId || !payload?.content) {
      return { success: false, error: 'Datos incompletos' };
    }

    // Validar longitud del mensaje
    if (payload.content.length > 2000) {
      return {
        success: false,
        error: 'El mensaje es demasiado largo (maximo 2000 caracteres)',
      };
    }

    try {
      const result = await this.chatService.sendMessage(
        payload.conversationId,
        userId,
        payload.content,
      );

      const messageData = {
        messageId: result.message._id.toString(),
        conversationId: result.conversationId,
        senderId: result.message.senderId,
        content: result.message.content,
        status: result.message.status,
        createdAt: result.message.createdAt,
      };

      // Emitir al room de la conversación
      const room = `conversation:${payload.conversationId}`;
      this.server.to(room).emit('message:new', messageData);

      // Notificación al destinatario
      const recipientRoom = `user:${result.recipientUserId}`;
      const preview =
        payload.content.length > 120
          ? `${payload.content.slice(0, 117)}...`
          : payload.content;

      this.server.to(recipientRoom).emit('notification:new', {
        type: 'chat_message',
        conversationId: result.conversationId,
        messageId: result.message._id.toString(),
        senderId: userId,
        preview,
        createdAt: result.message.createdAt,
      });

      // Notificación global vía RabbitMQ → notifications-service (toasts fuera de /chat)
      void this.rabbitPublisher.publish('chat.message', {
        messageId: result.message._id.toString(),
        conversationId: result.conversationId,
        senderId: userId,
        recipientId: result.recipientUserId,
        senderName: userId,
        preview,
        createdAt: result.message.createdAt.toISOString(),
      });

      // Retornar ACK con el mensaje creado
      return { success: true, message: messageData };
    } catch (error) {
      this.logger.error(
        `Error al enviar mensaje: ${(error as Error).message}`,
      );
      return { success: false, error: 'No se pudo enviar el mensaje' };
    }
  }

  // ──────────────────────────────────────────────
  //  Estados de entrega (FR-CHAT-06)
  // ──────────────────────────────────────────────

  @SubscribeMessage('message:delivered')
  async handleMessageDelivered(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { messageId: string },
  ): Promise<void> {
    if (!payload?.messageId) return;

    try {
      const updated = await this.chatService.markMessageDelivered(
        payload.messageId,
      );

      if (updated) {
        const room = `conversation:${updated.conversationId.toString()}`;
        this.server.to(room).emit('message:status', {
          messageId: updated._id.toString(),
          conversationId: updated.conversationId.toString(),
          status: updated.status,
          deliveredAt: updated.deliveredAt,
        });
      }
    } catch {
      client.emit('error', {
        message: 'No se pudo actualizar estado del mensaje',
      });
    }
  }

  @SubscribeMessage('message:read')
  async handleMessageRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string },
  ): Promise<void> {
    const userId = client.data?.user?.userId;
    if (!userId || !payload?.conversationId) return;

    try {
      const count = await this.chatService.markConversationAsRead(
        payload.conversationId,
        userId,
      );

      if (count > 0) {
        const room = `conversation:${payload.conversationId}`;
        this.server.to(room).emit('message:status', {
          conversationId: payload.conversationId,
          bulkStatus: 'READ',
          count,
          userId,
        });
      }
    } catch {
      client.emit('error', {
        message: 'No se pudo marcar la conversacion como leida',
      });
    }
  }
}
