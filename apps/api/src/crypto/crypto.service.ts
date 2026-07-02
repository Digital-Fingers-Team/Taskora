import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * تشفير بيانات الاعتماد (المرحلة 8) — AES-256-GCM.
 * المفتاح بييجي من `TASKORA_ENCRYPTION_KEY` (نص سرّي، بيتحوّل لـ 32-byte عبر SHA-256).
 * الحمولة المخزّنة: base64(iv) . base64(authTag) . base64(ciphertext).
 */
@Injectable()
export class CryptoService {
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    const secret = config.get<string>("TASKORA_ENCRYPTION_KEY");
    if (!secret) {
      throw new InternalServerErrorException(
        "TASKORA_ENCRYPTION_KEY مطلوب لتشفير بيانات الاعتماد",
      );
    }
    // اشتقاق مفتاح 32-byte ثابت من السرّ، عشان أي طول للسرّ يشتغل.
    this.key = createHash("sha256").update(secret).digest();
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString("base64")}.${tag.toString("base64")}.${ciphertext.toString("base64")}`;
  }

  decrypt(payload: string): string {
    const [ivB64, tagB64, dataB64] = payload.split(".");
    if (!ivB64 || !tagB64 || !dataB64) {
      throw new InternalServerErrorException("حمولة مشفّرة غير صالحة");
    }
    const decipher = createDecipheriv(
      "aes-256-gcm",
      this.key,
      Buffer.from(ivB64, "base64"),
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64")),
      decipher.final(),
    ]).toString("utf8");
  }
}
