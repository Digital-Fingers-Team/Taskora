import type { ConnectorDef } from "@taskora/shared";

/**
 * سجلّ الموصّلات (المرحلة 8). نبدأ بـ 2–3 موصّلات اللي العموديات محتاجاها فعلًا
 * (Sheets + Slack) — مش 10 مرة واحدة (فخّ نصّت عليه خطة المرحلة).
 * كل موصّل بيعرّف actions منظّمة + الحقول المطلوبة لكل action.
 */
export const CONNECTOR_REGISTRY: readonly ConnectorDef[] = [
  {
    id: "google_sheets",
    label: "Google Sheets",
    provider: "google_sheets",
    actions: [
      {
        id: "read_range",
        label: "Read range",
        fields: [
          { key: "spreadsheetId", label: "Spreadsheet ID", required: true },
          { key: "range", label: "Range (e.g. Sheet1!A1:C10)", required: true },
        ],
      },
      {
        id: "append_row",
        label: "Append row",
        fields: [
          { key: "spreadsheetId", label: "Spreadsheet ID", required: true },
          { key: "range", label: "Range (e.g. Sheet1!A1)", required: true },
          { key: "values", label: "Row values (comma-separated)", required: true },
        ],
      },
    ],
  },
  {
    id: "slack",
    label: "Slack",
    provider: "slack",
    actions: [
      {
        id: "post_message",
        label: "Post message",
        fields: [
          { key: "channel", label: "Channel ID", required: true },
          { key: "text", label: "Message text", required: true },
        ],
      },
    ],
  },
];

export function findConnector(id: string): ConnectorDef | undefined {
  return CONNECTOR_REGISTRY.find((c) => c.id === id);
}
