import { Module } from "@nestjs/common";
import { PublicApiController } from "./public-api.controller";
import { ApiKeysModule } from "../api-keys/api-keys.module";
import { TasksModule } from "../tasks/tasks.module";
import { CardsModule } from "../cards/cards.module";

/** الـ Public API v1 (المرحلة 7) — بيعيد استخدام services القائمة عبر مفاتيح API. */
@Module({
  imports: [ApiKeysModule, TasksModule, CardsModule],
  controllers: [PublicApiController],
})
export class PublicApiModule {}
