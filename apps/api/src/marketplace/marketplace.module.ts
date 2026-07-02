import { Module } from "@nestjs/common";
import { MarketplaceService } from "./marketplace.service";
import { MarketplaceController, OrgMarketplaceController } from "./marketplace.controller";
import { CardsModule } from "../cards/cards.module";

@Module({
  imports: [CardsModule],
  providers: [MarketplaceService],
  controllers: [MarketplaceController, OrgMarketplaceController],
})
export class MarketplaceModule {}
