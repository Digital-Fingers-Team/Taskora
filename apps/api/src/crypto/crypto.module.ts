import { Global, Module } from "@nestjs/common";
import { CryptoService } from "./crypto.service";

/** عالمي عشان أي موصّل/خدمة تحتاج فكّ تشفير بيانات اعتماد تحقنه مباشرة. */
@Global()
@Module({
  providers: [CryptoService],
  exports: [CryptoService],
})
export class CryptoModule {}
