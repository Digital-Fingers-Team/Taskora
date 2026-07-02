import { Module } from "@nestjs/common";
import { LearningEngineService } from "./learning-engine.service";
import { CardsModule } from "../cards/cards.module";

/** مستمع خلفي بس (زي webhooks/notifications) — مفيش controller. */
@Module({
  imports: [CardsModule],
  providers: [LearningEngineService],
})
export class LearningEngineModule {}
