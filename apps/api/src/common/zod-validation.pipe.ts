import { PipeTransform, BadRequestException } from "@nestjs/common";
import { ZodSchema } from "zod";

/** Pipe بيتحقق من الـ body باستخدام Zod schema من الـ @taskora/shared. */
export class ZodValidationPipe<T> implements PipeTransform {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: "بيانات غير صحيحة",
        errors: result.error.flatten(),
      });
    }
    return result.data;
  }
}
