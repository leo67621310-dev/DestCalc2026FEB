import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";

// Vercel Serverless Function (Node.js Runtime)
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    // Vercel automatically parses JSON body in Node.js runtime
    const { imageBase64, mimeType, model, reasoning } = req.body;

    // SECURE: Access Key from Server Environment Only
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "Server Configuration Error: Missing API Key" });
    }

    const ai = new GoogleGenAI({ apiKey: apiKey });

    // Schema definition
    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        groups: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              logic: { type: Type.STRING, enum: ["MAX", "SUM"] },
              currency: { type: Type.STRING },
              is_storage: { type: Type.BOOLEAN },
              min_days: { type: Type.NUMBER },
              rows: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    rate: { type: Type.NUMBER },
                    divisor: { type: Type.NUMBER },
                    unit: { type: Type.STRING },
                    condition: { type: Type.STRING, enum: ["NONE", "MIN", "HEAVY", "LIGHT", "OVER_5X"] },
                    desc: { type: Type.STRING },
                    round_up: { type: Type.BOOLEAN },
                    round_up_decimals: { type: Type.NUMBER }
                  }
                }
              }
            }
          }
        }
      }
    };

    let config: any = {
      responseMimeType: "application/json",
      responseSchema: responseSchema
    };

    if (model.includes("gemini-3")) {
        if (reasoning === "low") config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
        else if (reasoning === "high") config.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };
    }

    const response = await ai.models.generateContent({
      model: model || 'gemini-2.5-flash',
      contents: {
        parts: [
          { inlineData: { mimeType: mimeType, data: imageBase64 } },
          { text: `Analyze freight charge sheet. Extract data into 'Charge Groups'.
                  RULES:
                      1. GROUPING:
                         - Charges with multiple conditions (e.g. LCL Rate vs LCL Min, or Pier Heavy vs Light) should be ONE group with logic="MAX".
                         - Single isolated charges (e.g. Doc Fee) should be their own group with logic="SUM".
                      2. STORAGE:
                         - Set 'is_storage'=true. Extract 'min_days' if present. 
                         - Put the daily rate in 'rows'.
                      3. CONDITIONS:
                         - 'HEAVY': >20kg/pkg. 'LIGHT': <20kg/pkg. 
                         - 'OVER_5X': Ratio > 5:1. Usually paired with RT/CBM/TON units.
                         - 'MIN': Minimum charge.
                      4. UNITS:
                         - Normalize to: FLAT, SHPT, RT, CBM, TON, KGS, PKG, BL, % ITEM, % TOTAL.
                         - Note: 'KGS' is allowed (for Per 100 KGS etc).
                      5. DIVISOR:
                         - If a rate is "Per X Units" (e.g. 30 per 333 KGS), set 'divisor' to X (333). Default is 1.
                      6. PERCENTAGE CHARGES:
                         - If a charge adds a percentage to the specific item/group (e.g. 'Fuel Surcharge on Freight'), use unit '% ITEM'.
                         - If a charge adds a percentage to the entire invoice total (e.g. 'VAT', 'ERS', 'Exchange Rate Surcharge', 'Collect Fee'), use unit '% TOTAL'.
                         - 'Collect Fee' is usually MAX(% TOTAL, Min Flat).
                      7. ROUNDING:
                         - If the image specifies that a weight/cbm/RT must be "rounded up to a full hundred kgs" or similar, set 'round_up'=true and 'round_up_decimals' to the appropriate decimal place (e.g. 1 for 0.1 tons, 0 for whole numbers). For "rounded up to a full hundred kgs" when unit is TON, set round_up_decimals=1.
                      8. CURRENCY:
                         - Use 3-letter ISO Currency Codes (e.g. EUR, USD, GBP, RMB).` 
          }
        ]
      },
      config: config
    });

    return res.status(200).json({ text: response.text });

  } catch (error: any) {
    console.error("API Error:", error);
    return res.status(500).json({ error: error.message || "Internal Server Error" });
  }
}
