import { Module } from "@nestjs/common";
import { ConnectorsService } from "./connectors.service";
import { ConnectorsController } from "./connectors.controller";
import { CredentialsModule } from "../credentials/credentials.module";

@Module({
  imports: [CredentialsModule],
  providers: [ConnectorsService],
  controllers: [ConnectorsController],
  exports: [ConnectorsService],
})
export class ConnectorsModule {}
