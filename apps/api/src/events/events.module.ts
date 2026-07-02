import { Global, Module } from "@nestjs/common";
import { EventsService } from "./events.service";

/**
 * ناقل الأحداث المركزي (المرحلة 7). Global عشان أي service يقدر يصدر أحداث
 * (tasks / billing / cards) من غير ما يستورد الموديول صراحةً.
 */
@Global()
@Module({
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
