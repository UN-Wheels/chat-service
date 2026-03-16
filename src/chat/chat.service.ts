import {
  Injectable,
  Inject,
  Logger,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  IConversationRepository,
  CONVERSATION_REPOSITORY,
  ConversationSummary,
} from './repositories/conversation.repository.interface';
import {
  IMessageRepository,
  MESSAGE_REPOSITORY,
  PaginatedMessages,
} from './repositories/message.repository.interface';
import {
  IRouteValidation,
  ROUTE_VALIDATION,
} from '../route-validation/route-validation.interface';
import { ConversationDocument, ConversationStatus } from './schemas/conversation.schema';
import { MessageDocument, MessageStatus } from './schemas/message.schema';

export interface SendMessageResult {
  message: MessageDocument;
  conversationId: string;
  recipientUserId: string;
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @Inject(CONVERSATION_REPOSITORY)
    private readonly conversationRepo: IConversationRepository,

    @Inject(MESSAGE_REPOSITORY)
    private readonly messageRepo: IMessageRepository,

    @Inject(ROUTE_VALIDATION)
    private readonly routeValidation: IRouteValidation,
  ) {}

  // ──────────────────────────────────────────────
  //  Conversaciones
  // ──────────────────────────────────────────────

  /**
   * Crea o recupera una conversación para una ruta + pasajero.
   * FR-CHAT-02, FR-CHAT-03.
   */
  async createOrGetConversation(
    routeId: string,
    driverId: string,
    passengerId: string,
  ): Promise<{ conversation: ConversationDocument; created: boolean }> {
    // Validación: no puedes chatear contigo mismo
    if (driverId === passengerId) {
      throw new ForbiddenException('No puedes iniciar una conversacion contigo mismo');
    }

    // Validación de ruta (no-op en MVP, HTTP en fase 2)
    await this.routeValidation.validateRoute(routeId);

    const result = await this.conversationRepo.findOrCreate(
      routeId,
      driverId,
      passengerId,
    );

    if (result.created) {
      this.logger.log(
        `Conversacion creada: route=${routeId}, driver=${driverId}, passenger=${passengerId}`,
      );
    }

    return result;
  }

  /**
   * Obtiene una conversación verificando que el usuario sea participante.
   */
  async getConversationForUser(
    conversationId: string,
    userId: string,
  ): Promise<ConversationDocument> {
    const conversation = await this.conversationRepo.findByIdForUser(
      conversationId,
      userId,
    );

    if (!conversation) {
      throw new NotFoundException('Conversacion no encontrada');
    }

    return conversation;
  }

  /**
   * Lista las conversaciones de un usuario con resumen.
   */
  async getUserConversations(
    userId: string,
    status?: ConversationStatus,
  ): Promise<ConversationSummary[]> {
    return this.conversationRepo.findByUser(userId, status);
  }

  /**
   * Obtiene conversaciones asociadas a una ruta.
   */
  async getRouteConversations(routeId: string): Promise<ConversationDocument[]> {
    return this.conversationRepo.findByRoute(routeId);
  }

  /**
   * Vincula un bookingId a una conversación (fase 2).
   */
  async linkBooking(
    conversationId: string,
    bookingId: string,
    userId: string,
  ): Promise<ConversationDocument> {
    // Verificar que el usuario es participante
    await this.getConversationForUser(conversationId, userId);

    const updated = await this.conversationRepo.updateBookingId(
      conversationId,
      bookingId,
    );

    if (!updated) {
      throw new NotFoundException('Conversacion no encontrada');
    }

    this.logger.log(
      `Booking ${bookingId} vinculado a conversacion ${conversationId}`,
    );

    return updated;
  }

  // ──────────────────────────────────────────────
  //  Mensajes
  // ──────────────────────────────────────────────

  /**
   * Envía un mensaje en una conversación.
   * FR-CHAT-04, FR-CHAT-05.
   */
  async sendMessage(
    conversationId: string,
    senderId: string,
    content: string,
  ): Promise<SendMessageResult> {
    // Verificar que el usuario pertenece a la conversación
    const conversation = await this.getConversationForUser(conversationId, senderId);

    // Crear el mensaje
    const message = await this.messageRepo.create(conversationId, senderId, content);

    // Actualizar timestamp de la conversación
    await this.conversationRepo.touch(conversationId);

    // Determinar el destinatario
    const recipientUserId =
      conversation.driverId === senderId
        ? conversation.passengerId
        : conversation.driverId;

    return {
      message,
      conversationId,
      recipientUserId,
    };
  }

  /**
   * Obtiene mensajes paginados de una conversación.
   */
  async getConversationMessages(
    conversationId: string,
    userId: string,
    page = 1,
    limit = 50,
  ): Promise<PaginatedMessages> {
    // Verificar que el usuario pertenece a la conversación
    await this.getConversationForUser(conversationId, userId);

    return this.messageRepo.findByConversation(conversationId, page, limit);
  }

  // ──────────────────────────────────────────────
  //  Estados de entrega (FR-CHAT-06)
  // ──────────────────────────────────────────────

  /**
   * Marca un mensaje individual como DELIVERED.
   * Llamado cuando el cliente confirma recepción (ACK de Socket.IO).
   */
  async markMessageDelivered(messageId: string): Promise<MessageDocument | null> {
    return this.messageRepo.markAsDelivered(messageId);
  }

  /**
   * Marca múltiples mensajes como DELIVERED en bulk.
   * Útil cuando el cliente se reconecta y confirma recepción de todos los pendientes.
   */
  async markManyDelivered(
    conversationId: string,
    recipientUserId: string,
  ): Promise<number> {
    // Verificar participación
    await this.getConversationForUser(conversationId, recipientUserId);

    return this.messageRepo.markManyAsDelivered(conversationId, recipientUserId);
  }

  /**
   * Marca todos los mensajes no leídos como READ.
   */
  async markConversationAsRead(
    conversationId: string,
    readerUserId: string,
  ): Promise<number> {
    // Verificar participación
    await this.getConversationForUser(conversationId, readerUserId);

    return this.messageRepo.markAsRead(conversationId, readerUserId);
  }

  /**
   * Determina el destinatario de un mensaje en una conversación.
   */
  getRecipientUserId(conversation: ConversationDocument, senderId: string): string {
    return conversation.driverId === senderId
      ? conversation.passengerId
      : conversation.driverId;
  }
}
