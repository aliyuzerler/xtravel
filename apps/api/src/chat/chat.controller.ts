import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles, ResponseInterceptor, RequestUser } from '../common';
import { UserRole } from '@turizm-pazaryeri/shared';
import { ChatService } from './chat.service';
import { IsString, MaxLength, MinLength } from 'class-validator';

class SendMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content!: string;
}

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.USER, UserRole.PROVIDER, UserRole.SUPER_ADMIN)
@UseInterceptors(ResponseInterceptor)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  /**
   * POST /api/reservations/:id/conversation
   * Rezervasyon için konuşma başlat veya mevcut olanı döndür.
   */
  @Post('reservations/:id/conversation')
  @HttpCode(HttpStatus.OK)
  async getOrCreateConversation(
    @Req() req: Express.Request & { user: RequestUser },
    @Param('id') reservationId: string,
  ) {
    return this.chatService.getOrCreateConversation(req.user.sub, reservationId);
  }

  /**
   * GET /api/conversations
   * Kullanıcının konuşmalarını listele.
   */
  @Get('conversations')
  async listConversations(
    @Req() req: Express.Request & { user: RequestUser },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.chatService.listConversations(req.user.sub, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  /**
   * GET /api/conversations/:id/messages
   * Konuşmadaki mesajları listele.
   */
  @Get('conversations/:id/messages')
  async listMessages(
    @Req() req: Express.Request & { user: RequestUser },
    @Param('id') conversationId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.chatService.listMessages(req.user.sub, conversationId, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  /**
   * POST /api/conversations/:id/messages
   * Mesaj gönder (HTTP fallback; WebSocket için ayrı gateway).
   */
  @Post('conversations/:id/messages')
  @HttpCode(HttpStatus.CREATED)
  async sendMessage(
    @Req() req: Express.Request & { user: RequestUser },
    @Param('id') conversationId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.sendMessage(req.user.sub, conversationId, dto.content);
  }

  /**
   * POST /api/conversations/:id/read
   * Mesajları okundu işaretle.
   */
  @Post('conversations/:id/read')
  @HttpCode(HttpStatus.OK)
  async markAsRead(
    @Req() req: Express.Request & { user: RequestUser },
    @Param('id') conversationId: string,
  ) {
    return this.chatService.markAsRead(req.user.sub, conversationId);
  }

  /**
   * GET /api/conversations/unread-count
   * Okunmamış mesaj sayısı (badge için).
   */
  @Get('conversations/unread-count')
  async getUnreadCount(@Req() req: Express.Request & { user: RequestUser }) {
    return this.chatService.getUnreadCount(req.user.sub);
  }
}
