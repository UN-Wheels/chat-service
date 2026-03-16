import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateConversationDto, SendMessageDto, LinkBookingDto } from './dto';

@ApiTags('Chat')
@ApiBearerAuth()
@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  // ──────────────────────────────────────────────
  //  Conversaciones
  // ──────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear o recuperar una conversacion',
    description:
      'Crea una conversacion entre conductor y pasajero para una ruta, ' +
      'o retorna la existente si ya fue creada (findOrCreate).',
  })
  @ApiResponse({ status: 201, description: 'Conversacion creada o recuperada exitosamente' })
  @ApiResponse({ status: 403, description: 'No puedes chatear contigo mismo' })
  async createConversation(
    @Body() dto: CreateConversationDto,
    @Req() req: any,
  ) {
    const { conversation, created } = await this.chatService.createOrGetConversation(
      dto.routeId,
      dto.driverId,
      dto.passengerId,
    );

    return {
      conversation,
      created,
    };
  }

  @Get('user/:userId')
  @ApiOperation({
    summary: 'Listar conversaciones del usuario',
    description:
      'Devuelve todas las conversaciones en las que participa el usuario, ' +
      'ordenadas por última actividad, con último mensaje y conteo de no leídos.',
  })
  @ApiParam({ name: 'userId', description: 'ID del usuario autenticado' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['ACTIVE', 'ARCHIVED', 'CLOSED'],
    description: 'Filtrar por estado de la conversación',
  })
  @ApiResponse({ status: 200, description: 'Lista de conversaciones' })
  async getUserConversations(
    @Param('userId') userId: string,
    @Query('status') status?: string,
    @Req() req?: any,
  ) {
    const conversations = await this.chatService.getUserConversations(
      userId,
      status as any,
    );
    return conversations;
  }

  @Get('route/:routeId')
  @ApiOperation({
    summary: 'Obtener conversaciones por ruta',
    description: 'Lista todas las conversaciones asociadas a una ruta.',
  })
  @ApiParam({ name: 'routeId', description: 'ID de la ruta' })
  @ApiResponse({ status: 200, description: 'Lista de conversaciones de la ruta' })
  async getRouteConversations(@Param('routeId') routeId: string) {
    return this.chatService.getRouteConversations(routeId);
  }

  // ──────────────────────────────────────────────
  //  Mensajes
  // ──────────────────────────────────────────────

  @Get(':conversationId/messages')
  @ApiOperation({
    summary: 'Obtener mensajes de una conversacion',
    description:
      'Devuelve los mensajes paginados de una conversación. ' +
      'Solo participantes pueden acceder.',
  })
  @ApiParam({ name: 'conversationId', description: 'ID de la conversación' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Página (default: 1)' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Mensajes por página (default: 50, max: 100)',
  })
  @ApiResponse({ status: 200, description: 'Mensajes paginados' })
  @ApiResponse({ status: 404, description: 'Conversación no encontrada' })
  async getMessages(
    @Param('conversationId') conversationId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Req() req?: any,
  ) {
    const userId = req.user.userId;
    const pageNum = Math.max(parseInt(page || '1', 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit || '50', 10) || 50, 1), 100);

    return this.chatService.getConversationMessages(
      conversationId,
      userId,
      pageNum,
      limitNum,
    );
  }

  @Post(':conversationId/messages')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Enviar un mensaje (REST fallback)',
    description:
      'Envía un mensaje en una conversación existente. ' +
      'Preferir WebSocket para tiempo real; este endpoint sirve como fallback.',
  })
  @ApiParam({ name: 'conversationId', description: 'ID de la conversación' })
  @ApiResponse({ status: 201, description: 'Mensaje enviado exitosamente' })
  @ApiResponse({ status: 404, description: 'Conversación no encontrada' })
  async sendMessage(
    @Param('conversationId') conversationId: string,
    @Body() dto: SendMessageDto,
    @Req() req: any,
  ) {
    const userId = req.user.userId;

    const result = await this.chatService.sendMessage(
      conversationId,
      userId,
      dto.content,
    );

    return {
      messageId: result.message._id.toString(),
      conversationId: result.conversationId,
      senderId: result.message.senderId,
      content: result.message.content,
      status: result.message.status,
      createdAt: result.message.createdAt,
    };
  }

  // ──────────────────────────────────────────────
  //  Estados
  // ──────────────────────────────────────────────

  @Patch(':conversationId/read')
  @ApiOperation({
    summary: 'Marcar conversacion como leida',
    description:
      'Marca todos los mensajes no leídos de la conversación como READ ' +
      'para el usuario autenticado.',
  })
  @ApiParam({ name: 'conversationId', description: 'ID de la conversación' })
  @ApiResponse({ status: 200, description: 'Conversación marcada como leída' })
  async markAsRead(
    @Param('conversationId') conversationId: string,
    @Req() req: any,
  ) {
    const userId = req.user.userId;
    const count = await this.chatService.markConversationAsRead(
      conversationId,
      userId,
    );

    return {
      message: 'Conversacion marcada como leida',
      messagesUpdated: count,
    };
  }

  @Patch(':conversationId/booking')
  @ApiOperation({
    summary: 'Vincular booking a conversacion (fase 2)',
    description:
      'Asocia un bookingId a una conversación existente. ' +
      'Preparado para cuando se integre el API Gateway.',
  })
  @ApiParam({ name: 'conversationId', description: 'ID de la conversación' })
  @ApiResponse({ status: 200, description: 'Booking vinculado exitosamente' })
  @ApiResponse({ status: 404, description: 'Conversación no encontrada' })
  async linkBooking(
    @Param('conversationId') conversationId: string,
    @Body() dto: LinkBookingDto,
    @Req() req: any,
  ) {
    const userId = req.user.userId;
    const conversation = await this.chatService.linkBooking(
      conversationId,
      dto.bookingId,
      userId,
    );

    return {
      message: 'Booking vinculado exitosamente',
      conversation,
    };
  }
}
