import { ConversationDocument, ConversationStatus } from '../schemas/conversation.schema';

export interface ConversationSummary {
  conversationId: string;
  routeId: string;
  otherUserId: string;
  otherUserRole: 'driver' | 'passenger';
  bookingId: string | null;
  status: ConversationStatus;
  lastMessageText: string | null;
  lastMessageAt: Date | null;
  unreadCount: number;
  updatedAt: Date;
}

export interface FindOrCreateResult {
  conversation: ConversationDocument;
  created: boolean;
}

/**
 * Interfaz abstracta para el repositorio de conversaciones.
 * Los servicios dependen de esta interfaz, no de la implementación concreta.
 */
export interface IConversationRepository {
  /**
   * Busca una conversación existente por (routeId, passengerId) o la crea.
   * Patrón findOrCreate atómico para evitar race conditions.
   */
  findOrCreate(
    routeId: string,
    driverId: string,
    passengerId: string,
  ): Promise<FindOrCreateResult>;

  /**
   * Busca una conversación por ID verificando que el usuario sea participante.
   * Retorna null si no existe o el usuario no pertenece a ella.
   */
  findByIdForUser(
    conversationId: string,
    userId: string,
  ): Promise<ConversationDocument | null>;

  /**
   * Lista las conversaciones de un usuario con resumen
   * (último mensaje, conteo de no leídos, etc.)
   */
  findByUser(
    userId: string,
    status?: ConversationStatus,
  ): Promise<ConversationSummary[]>;

  /**
   * Obtiene todas las conversaciones asociadas a una ruta.
   */
  findByRoute(routeId: string): Promise<ConversationDocument[]>;

  /**
   * Obtiene una conversación por routeId y passengerId.
   */
  findByRouteAndPassenger(
    routeId: string,
    passengerId: string,
  ): Promise<ConversationDocument | null>;

  /**
   * Vincula un bookingId a una conversación existente (fase 2).
   */
  updateBookingId(
    conversationId: string,
    bookingId: string,
  ): Promise<ConversationDocument | null>;

  /**
   * Cambia el estado de una conversación.
   */
  updateStatus(
    conversationId: string,
    status: ConversationStatus,
  ): Promise<ConversationDocument | null>;

  /**
   * Actualiza el timestamp `updatedAt` de la conversación (al enviar un mensaje).
   */
  touch(conversationId: string): Promise<void>;
}

/** Token de inyección para DI de NestJS */
export const CONVERSATION_REPOSITORY = Symbol('CONVERSATION_REPOSITORY');
