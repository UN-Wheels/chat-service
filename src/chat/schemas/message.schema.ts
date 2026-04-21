import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type MessageDocument = HydratedDocument<Message>;

export enum MessageStatus {
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  READ = 'READ',
}

@Schema({
  timestamps: { createdAt: true, updatedAt: false },
  collection: 'messages',
})
export class Message {
  /** Referencia a la conversación */
  @Prop({ type: Types.ObjectId, ref: 'Conversation', required: true, index: true })
  conversationId: Types.ObjectId;

  /** user_id del remitente */
  @Prop({ required: true })
  senderId: string;

  /** Contenido del mensaje (1–2000 caracteres) */
  @Prop({ required: true, minlength: 1, maxlength: 2000 })
  content: string;

  /** Estado de entrega del mensaje */
  @Prop({
    type: String,
    enum: Object.values(MessageStatus),
    default: MessageStatus.SENT,
  })
  status: MessageStatus;

  /** Fecha en que el destinatario confirmó recepción (ACK) */
  @Prop({ type: Date, default: null })
  deliveredAt: Date | null;

  /** Fecha en que el destinatario leyó el mensaje */
  @Prop({ type: Date, default: null })
  readAt: Date | null;

  /** Timestamp de creación (gestionado por Mongoose) */
  createdAt: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);

// Índice compuesto para consultas paginadas por conversación
MessageSchema.index({ conversationId: 1, createdAt: 1 });

// Índice para queries de unread count
MessageSchema.index({ conversationId: 1, senderId: 1, status: 1 });
