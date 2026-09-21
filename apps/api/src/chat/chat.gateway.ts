import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Server as HttpServer } from 'http';
import { Server as IoServer, Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';
import { env } from '../env';
import { ChatService } from './chat.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * WebSocket Gateway — Socket.io ile gerçek zamanlı chat.
 *
 * Bağlantı akışı:
 *   1. Client socket.io'ya bağlanır, auth: { token: '<jwt>' } gönderir
 *   2. Server token'ı verify eder, userId'yi çıkarır
 *   3. Client 'conversation:join' event'ı ile conversation ID gönderir
 *   4. Server yetki kontrolü yapar, socket'i room'a ekler
 *   5. Client 'message:send' event'ı ile mesaj gönderir
 *   6. Server DB'ye yazar, room'a 'message:new' broadcast eder
 *   7. Karşı taraf 'message:new' alır, UI güncellenir
 *
 * Room yapısı: `conversation:<conversationId>`
 */
@Injectable()
export class ChatGateway implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChatGateway.name);
  private io: IoServer | null = null;

  constructor(
    private chatService: ChatService,
    private prisma: PrismaService,
  ) {}

  /**
   * HTTP server'a socket.io'yu mount et.
   * main.ts'ten çağrılır — bkz. attachToServer(httpServer).
   */
  attachToServer(httpServer: HttpServer) {
    this.io = new IoServer(httpServer, {
      cors: {
        origin: env.CORS_ORIGIN.split(',').map((s) => s.trim()),
        methods: ['GET', 'POST'],
        credentials: true,
      },
      path: '/socket.io',
    });

    this.io.use((socket: Socket, next) => this.authMiddleware(socket, next));
    this.io.on('connection', (socket: Socket) => this.handleConnection(socket));

    this.logger.log('Socket.io gateway attached');
  }

  onModuleInit() {
    // attachToServer main.ts'ten çağrılacak
  }

  onModuleDestroy() {
    if (this.io) {
      this.io.close();
      this.logger.log('Socket.io gateway closed');
    }
  }

  // --------------------------------------------------------------------------
  // AUTH MIDDLEWARE — JWT verify
  // --------------------------------------------------------------------------
  private async authMiddleware(socket: Socket, next: (err?: Error) => void) {
    try {
      const token = (socket.handshake.auth as any)?.token || (socket.handshake.headers as any)?.authorization?.replace('Bearer ', '');
      if (!token) {
        return next(new Error('Authentication required'));
      }
      const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as any;
      (socket as any).userId = payload.sub;
      (socket as any).role = payload.role;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  }

  // --------------------------------------------------------------------------
  // CONNECTION HANDLER
  // --------------------------------------------------------------------------
  private handleConnection(socket: Socket) {
    const userId = (socket as any).userId as string;
    this.logger.log(`Socket connected: ${socket.id} user=${userId}`);

    // Conversation'a katıl
    socket.on('conversation:join', async (conversationId: string, ack?: (r: any) => void) => {
      try {
        // Yetki kontrolü
        const conversation = await this.prisma.conversation.findUnique({
          where: { id: conversationId },
        });
        if (!conversation) {
          ack?.({ ok: false, error: 'Konuşma bulunamadı' });
          return;
        }

        // Kullanıcı bu conversation'a erişebilir mi?
        const isUser = conversation.userId === userId;
        const provider = await this.prisma.serviceProvider.findUnique({ where: { userId } });
        const isProvider = provider?.id === conversation.providerId;
        if (!isUser && !isProvider) {
          ack?.({ ok: false, error: 'Erişim yetkiniz yok' });
          return;
        }

        socket.join(`conversation:${conversationId}`);
        this.logger.log(`Socket ${socket.id} joined conversation:${conversationId}`);
        ack?.({ ok: true });
      } catch (err) {
        this.logger.error(`conversation:join error: ${err}`);
        ack?.({ ok: false, error: 'Sunucu hatası' });
      }
    });

    // Mesaj gönder
    socket.on('message:send', async (data: { conversationId: string; content: string }, ack?: (r: any) => void) => {
      try {
        if (!data?.conversationId || !data?.content) {
          ack?.({ ok: false, error: 'Geçersiz veri' });
          return;
        }

        const message = await this.chatService.sendMessage(userId, data.conversationId, data.content);

        // Room'a broadcast
        this.io?.to(`conversation:${data.conversationId}`).emit('message:new', {
          id: message.id,
          conversationId: message.conversationId,
          senderId: message.senderId,
          senderType: message.senderType,
          content: message.content,
          createdAt: message.createdAt,
        });

        ack?.({ ok: true, message });
      } catch (err) {
        this.logger.error(`message:send error: ${err}`);
        ack?.({ ok: false, error: 'Mesaj gönderilemedi' });
      }
    });

    // Yazıyor... indicator
    socket.on('typing:start', (conversationId: string) => {
      socket.to(`conversation:${conversationId}`).emit('typing:start', { userId });
    });
    socket.on('typing:stop', (conversationId: string) => {
      socket.to(`conversation:${conversationId}`).emit('typing:stop', { userId });
    });

    // Disconnect
    socket.on('disconnect', () => {
      this.logger.log(`Socket disconnected: ${socket.id}`);
    });
  }

  /**
   * Server tarafından mesaj gönder (örn. notification'dan).
   */
  broadcastMessage(conversationId: string, message: any) {
    this.io?.to(`conversation:${conversationId}`).emit('message:new', message);
  }
}
