import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import type { NotificationType } from './notification.constants';
import { UsersService } from '../users/users.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

export interface NotifyInput {
  type: NotificationType;
  title: string;
  body?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification) private readonly repo: Repository<Notification>,
    private readonly usersService: UsersService,
    private readonly realtime: RealtimeGateway,
  ) {}

  /** Notifica a un usuario concreto (persiste + push). Best-effort. */
  async notifyUser(userId: string, input: NotifyInput) {
    try {
      await this.repo.save(this.buildRow(userId, input));
      this.realtime.pushToUser(userId, { title: input.title });
    } catch (err) {
      this.logger.error(`notifyUser ${userId} falló: ${String(err)}`);
    }
  }

  /** Notifica a todos los usuarios activos de un rol (una fila por usuario + un push a la sala). */
  async notifyRole(roleName: string, input: NotifyInput) {
    try {
      const users = await this.usersService.findActiveByRoleName(roleName);
      if (users.length > 0) {
        await this.repo.save(users.map((u) => this.buildRow(u.id, input)));
      }
      this.realtime.pushToRole(roleName, { title: input.title });
    } catch (err) {
      this.logger.error(`notifyRole ${roleName} falló: ${String(err)}`);
    }
  }

  findForUser(userId: string) {
    return this.repo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 30,
    });
  }

  async unreadCount(userId: string) {
    const count = await this.repo.count({ where: { userId, isRead: false } });
    return { count };
  }

  async markRead(id: string, userId: string) {
    const notification = await this.repo.findOne({ where: { id, userId } });
    if (!notification) throw new NotFoundException('Notificación no encontrada');
    notification.isRead = true;
    return this.repo.save(notification);
  }

  async markAllRead(userId: string) {
    await this.repo.update({ userId, isRead: false }, { isRead: true });
    return { count: 0 };
  }

  private buildRow(userId: string, input: NotifyInput) {
    return this.repo.create({
      userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      resourceType: input.resourceType ?? null,
      resourceId: input.resourceId ?? null,
      isRead: false,
    });
  }
}
