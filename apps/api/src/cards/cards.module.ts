import { Module } from "@nestjs/common";
import { CardsService } from "./cards.service";
import { CardsController } from "./cards.controller";
import { CardVersionsService } from "./card-versions.service";
import { CardVersionsController } from "./card-versions.controller";
import { CardSimulationsService } from "./card-simulations.service";
import { AiModule } from "../ai/ai.module";

@Module({
  imports: [AiModule],
  providers: [CardsService, CardVersionsService, CardSimulationsService],
  controllers: [CardsController, CardVersionsController],
  exports: [CardVersionsService, CardsService, CardSimulationsService],
})
export class CardsModule {}
