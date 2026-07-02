import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter } from "node:events";
import type { DomainEvent } from "@taskora/shared";

/**
 * حمولة حدث المجال — كل حدث بيتبعت في المنصة بيمرّ من هنا (المرحلة 7).
 * `data` بيتحطّ في جسم الـ Webhook وفي `data` بتاعت الإشعار كما هي.
 */
export interface DomainEventEnvelope {
  event: DomainEvent;
  organizationId: string;
  /** مين سبّب الحدث (لو فيه) — بيتسجّل في الإشعار/التدقيق. */
  actorId?: string | null;
  data: Record<string, unknown>;
}

export type DomainEventHandler = (envelope: DomainEventEnvelope) => Promise<void> | void;

/**
 * ناقل أحداث داخلي (in-process) — نقطة واحدة بتصدر منها كل أحداث المجال،
 * والمستهلكين (Webhooks + Notifications) بيشتركوا فيها من غير ما يعرفوا بعض.
 * كافي دلوقتي؛ ممكن يترقّى لـ BullMQ/broker بعدين من غير ما يتغيّر الـ callers.
 */
@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);
  private readonly emitter = new EventEmitter();

  constructor() {
    // من غير الحدّ الافتراضي (10) بيطلّع تحذير مع كل مستهلك بيشترك.
    this.emitter.setMaxListeners(50);
  }

  emit(envelope: DomainEventEnvelope): void {
    this.emitter.emit("domain", envelope);
  }

  /** بيشترك في كل أحداث المجال. الأخطاء بتتبلّع وتتسجّل عشان مستهلك ما يكسرش التاني. */
  onDomainEvent(handler: DomainEventHandler): void {
    this.emitter.on("domain", (envelope: DomainEventEnvelope) => {
      void (async () => {
        try {
          await handler(envelope);
        } catch (err) {
          this.logger.error(
            `فشل معالجة الحدث ${envelope.event}: ${(err as Error).message}`,
          );
        }
      })();
    });
  }
}
