import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ConversationDocument = HydratedDocument<Conversation>;

export enum ConversationStatus {
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
  CLOSED = 'CLOSED',
}

@Schema({
  timestamps: true,
  collection: 'conversations',
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
})
export class Conversation {
  /** ID de la ruta publicada por el conductor */
  @Prop({ required: true, index: true })
  routeId: string;

  /** user_id del conductor (dueño de la ruta) */
  @Prop({ required: true, index: true })
  driverId: string;

  /** user_id del pasajero interesado */
  @Prop({ required: true, index: true })
  passengerId: string;

  /**
   * ID del booking asociado. null al crear la conversación;
   * se vincula cuando se confirma la reserva (fase 2 con API Gateway).
   */
  @Prop({ type: String, default: null })
  bookingId: string | null;

  /** Estado de la conversación */
  @Prop({
    type: String,
    enum: Object.values(ConversationStatus),
    default: ConversationStatus.ACTIVE,
    index: true,
  })
  status: ConversationStatus;

  /** Timestamps gestionados por Mongoose */
  createdAt: Date;
  updatedAt: Date;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);

// Índice único: una sola conversación por pasajero por ruta
ConversationSchema.index({ routeId: 1, passengerId: 1 }, { unique: true });

// Índices compuestos para listar conversaciones de un usuario
ConversationSchema.index({ driverId: 1, status: 1 });
ConversationSchema.index({ passengerId: 1, status: 1 });
