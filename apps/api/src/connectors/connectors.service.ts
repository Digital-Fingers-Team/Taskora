import { BadRequestException, Injectable } from "@nestjs/common";
import type { ConnectorDef, ConnectorResult, ExecuteConnectorInput } from "@taskora/shared";
import { CredentialsService } from "../credentials/credentials.service";
import { CONNECTOR_REGISTRY, findConnector } from "./connector-registry";

/** الوقت الأقصى لأي نداء أداة خارجية. */
const TOOL_TIMEOUT_MS = 10_000;

@Injectable()
export class ConnectorsService {
  constructor(private readonly credentials: CredentialsService) {}

  listConnectors(): readonly ConnectorDef[] {
    return CONNECTOR_REGISTRY;
  }

  async execute(
    organizationId: string,
    input: ExecuteConnectorInput,
  ): Promise<ConnectorResult> {
    const connector = findConnector(input.connectorId);
    if (!connector) throw new BadRequestException("موصّل غير معروف");
    const action = connector.actions.find((a) => a.id === input.actionId);
    if (!action) throw new BadRequestException("إجراء غير معروف لهذا الموصّل");

    // كل الحقول المطلوبة موجودة؟
    for (const field of action.fields) {
      if (field.required && input.params[field.key] == null) {
        throw new BadRequestException(`الحقل «${field.key}» مطلوب`);
      }
    }

    const { provider, secret } = await this.credentials.getSecret(
      organizationId,
      input.credentialId,
    );
    if (provider !== connector.provider) {
      throw new BadRequestException("بيانات الاعتماد لا تطابق مزوّد الموصّل");
    }

    try {
      const output = await this.dispatch(connector.id, action.id, secret, input.params);
      return { ok: true, output };
    } catch (err) {
      return { ok: false, output: null, error: err instanceof Error ? err.message : "فشل التنفيذ" };
    }
  }

  /** يوجّه لكل أداة حقيقية. السرّ = OAuth/Bot token بحسب المزوّد. */
  private async dispatch(
    connectorId: string,
    actionId: string,
    secret: string,
    params: Record<string, unknown>,
  ): Promise<unknown> {
    if (connectorId === "slack" && actionId === "post_message") {
      return this.slackPostMessage(secret, String(params.channel), String(params.text));
    }
    if (connectorId === "google_sheets" && actionId === "read_range") {
      return this.sheetsRead(secret, String(params.spreadsheetId), String(params.range));
    }
    if (connectorId === "google_sheets" && actionId === "append_row") {
      const values = String(params.values)
        .split(",")
        .map((v) => v.trim());
      return this.sheetsAppend(secret, String(params.spreadsheetId), String(params.range), values);
    }
    throw new BadRequestException("إجراء غير مدعوم");
  }

  private async slackPostMessage(token: string, channel: string, text: string): Promise<unknown> {
    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ channel, text }),
      signal: AbortSignal.timeout(TOOL_TIMEOUT_MS),
    });
    const body = (await res.json()) as { ok: boolean; error?: string; ts?: string };
    if (!body.ok) throw new Error(`Slack: ${body.error ?? "unknown"}`);
    return { ts: body.ts };
  }

  private async sheetsRead(token: string, spreadsheetId: string, range: string): Promise<unknown> {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId,
    )}/values/${encodeURIComponent(range)}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(TOOL_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Google Sheets: ${res.status}`);
    const body = (await res.json()) as { values?: unknown[][] };
    return { values: body.values ?? [] };
  }

  private async sheetsAppend(
    token: string,
    spreadsheetId: string,
    range: string,
    values: string[],
  ): Promise<unknown> {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId,
    )}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ values: [values] }),
      signal: AbortSignal.timeout(TOOL_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Google Sheets: ${res.status}`);
    return await res.json();
  }
}
