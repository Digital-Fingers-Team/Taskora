import { Module } from "@nestjs/common";
import { AiService } from "./ai.service";
import { CardGenerationQueue } from "./card-generation.queue";
import { AiController } from "./ai.controller";

@Module({
  providers: [AiService, CardGenerationQueue],
  controllers: [AiController],
  exports: [AiService],
})
export class AiModule {}
