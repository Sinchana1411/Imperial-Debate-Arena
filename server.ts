import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = 3000;

// Lazy initialization of Gemini API Client
let aiClient: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      console.warn("WARNING: GEMINI_API_KEY environment variable is not defined. AI Judge will fallback to offline scoring.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key || "MOCK_KEY",
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// 1. API Route: AI Judge assessment
app.post("/api/debate/judge", async (req, res) => {
  const { topic, speakerName, team, speechText, previousSpeeches } = req.body;

  if (!speechText) {
    return res.status(400).json({ error: "Speech text is required." });
  }

  const prompt = `
    You are the AI Chief Justice, an elite rhetorical arbitrator from the 19th-century parliamentary debates.
    Evaluate the following speech text under the debate topic.

    Topic: "${topic}"
    Speaker: ${speakerName} (Team: ${team})
    Speech Text: "${speechText}"

    Context (previous arguments for flow alignment):
    ${JSON.stringify(previousSpeeches || [])}

    You must grade the speech on three criteria (0 to 10 scale):
    1. Rhetorical Impact (The eloquence of speech, command of language, metaphor)
    2. Clarity (Articulate flow, immediate intelligibility, absence of clutter)
    3. Logical Consistency (Soundness of reasoning, structured syllogism, response to counter-arguments)

    Explain your judgment in a paragraph using a vintage tone. Example: "The honorable speaker Vance delivers a monumental appeal, though heavily romanticized...".
    
    Respond STRICTLY in JSON format following this schema:
    {
      "scores": {
        "rhetoricalImpact": number,
        "clarity": number,
        "logicalConsistency": number
      },
      "commentary": string (use a refined, vintage-styled voice of an objective 1800s judge)
    }
  `;

  try {
    const ai = getAI();
    // Check if the API key is actually useful
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("No API key");
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["scores", "commentary"],
          properties: {
            scores: {
              type: Type.OBJECT,
              required: ["rhetoricalImpact", "clarity", "logicalConsistency"],
              properties: {
                rhetoricalImpact: { type: Type.INTEGER, description: "Eloquence of speech from 0 to 10" },
                clarity: { type: Type.INTEGER, description: "Intelligibility from 0 to 10" },
                logicalConsistency: { type: Type.INTEGER, description: "Reasoning and soundness from 0 to 10" },
              }
            },
            commentary: { type: Type.STRING, description: "Refined vintage judgment of the debate speech" }
          }
        }
      }
    });

    const parsed = JSON.parse(response.text || "{}");
    res.json(parsed);
  } catch (error) {
    console.error("AI Judge API failed:", error);
    // Graceful offline fallback with vintage-sounding scores
    const fallbacks = [
      { r: 8, c: 7, l: 8, msg: "The Chief Justice notes: An elegant exposition with high grammatical poise, though missing a resolute refutation of the opposition's claims." },
      { r: 7, c: 9, l: 7, msg: "The Chief Justice notes: Admirable clarity of expression, direct as a telegraph wire, though lacking the ornamental flourishes of classical rhetoric." },
      { r: 9, c: 8, l: 9, msg: "The Chief Justice notes: A masterful demonstration of logical deduction and forensic rhetoric. The arguments stand as firm as an oak beam." }
    ];
    const picked = fallbacks[Math.floor(Math.random() * fallbacks.length)];
    res.json({
      scores: {
        rhetoricalImpact: picked.r,
        clarity: picked.c,
        logicalConsistency: picked.l
      },
      commentary: `${picked.msg} (Offline fallback mode)`
    });
  }
});

// 2. API Route: Simulated Transcription Service
// Cleans up oral transcripts or drafts a fully formed polished paragraph in classical style if the user puts short notes 
app.post("/api/debate/transcribe", async (req, res) => {
  const { notes, characterName, team } = req.body;

  if (!notes) {
    return res.status(400).json({ error: "Speech notes are required." });
  }

  const prompt = `
    Take the following spoken notes/draft and transcribe it into a highly eloquent, formal 19th-century speech.
    The speaker is "${characterName}" arguing for the "${team}" team.
    
    User spoken notes: "${notes}"

    Make it sound like an authentic debating contribution from a distinguished scholar. Maintain the speaker's main points but embellish with vintage flair and scholarly conviction. Keep it around 3 to 5 sentences long.
    
    Respond in JSON format:
    {
      "polishedSpeech": string
    }
  `;

  try {
    const ai = getAI();
    if (!process.env.GEMINI_API_KEY) throw new Error("No API key");

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["polishedSpeech"],
          properties: {
            polishedSpeech: { type: Type.STRING, description: "A beautifully polished vintage style paragraph representing the transcribed argument." }
          }
        }
      }
    });

    const parsed = JSON.parse(response.text || "{}");
    res.json(parsed);
  } catch (error) {
    console.error("Transcription API failed:", error);
    // Offline transcription generator fallback
    const styles = [
      `"Let it be known that my esteemed colleague overlooks the most fundamental tenet of human coordination! We cannot simply yield our traditional crafts directly to the steel teeth of gears without losing our very souls. I urge you all to resist this relentless automation!"`,
      `"I stand before this distinguished room to declare that progress is not a tide we can simply stem with wooden barrier dams. Digital networks do not enslave the human eye, rather they expand our horizons to infinity, democratizing knowledge across the wild plains!"`,
      `"Consider, if you will, the sensory intimacy of paper under physical candles. The digital screen is a fleeting phantom—here one moment, gone the next with a pulse of electricity. We must ground ourselves in everlasting books!"`
    ];
    const selectedText = styles[Math.floor(Math.random() * styles.length)];
    res.json({
      polishedSpeech: selectedText + ` [Simulated Transcription of: ${notes}]`
    });
  }
});

// 3. API Route: Debate Summary Report
app.post("/api/debate/summary", async (req, res) => {
  const { topic, speeches } = req.body;

  const prompt = `
    Analyze the following debate transaction records.
    Topic: "${topic}"
    Speeches: ${JSON.stringify(speeches || [])}

    Generate a highly refined, classical "Post-Debate Summary Report".
    You must compute appropriate aggregate scores and identify the 'Best Speaker', the central 'Clash Points', and a vintage closing 'Conclusion'.

    Respond STRICTLY in JSON format following this schema:
    {
      "overallTopic": "Topic name",
      "conclusion": "A detailed 19th-century closing evaluation and summary of the debate outcome.",
      "bestSpeaker": "The name of the speaker who scored highest or had the most rhetorical presence.",
      "favourAverageScore": number (average out of 10, e.g. 8.4),
      "againstAverageScore": number (average out of 10, e.g. 7.9),
      "rhetoricalNotes": "A critical summary of the stylistic forms used (e.g. ad hominem, metaphors, emotional appeals).",
      "clashPoints": ["Clash point A", "Clash point B", "Clash point C"]
    }
  `;

  try {
    const ai = getAI();
    if (!process.env.GEMINI_API_KEY) throw new Error("No API key");

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["overallTopic", "conclusion", "bestSpeaker", "favourAverageScore", "againstAverageScore", "rhetoricalNotes", "clashPoints"],
          properties: {
            overallTopic: { type: Type.STRING },
            conclusion: { type: Type.STRING },
            bestSpeaker: { type: Type.STRING },
            favourAverageScore: { type: Type.NUMBER },
            againstAverageScore: { type: Type.NUMBER },
            rhetoricalNotes: { type: Type.STRING },
            clashPoints: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        }
      }
    });

    const parsed = JSON.parse(response.text || "{}");
    res.json(parsed);
  } catch (error) {
    console.error("Summary API failed:", error);
    // Offline intelligent report fallback
    res.json({
      overallTopic: topic,
      conclusion: "Thus, the assembly concludes. The arguments presented by both modern defenders and ancestral preservationists have demonstrated the exquisite scale of human deliberation. While the Gutenberg Fellowship championed sensory romance, the Silicon Vanguard carried the day on democratic utility.",
      bestSpeaker: speeches?.[0]?.speakerName || "Dr. Thaddeus Vance",
      favourAverageScore: 8.5,
      againstAverageScore: 8.3,
      rhetoricalNotes: "Both sides avoided base vulgarity, preferring grand metaphors of cathedrals, candles, and railway lines.",
      clashPoints: [
        "The sensory value of tactile media versus pure accessibility",
        "Individual property ownership versus collective technological dividends",
        "Democratization of knowledge versus preservation of cognitive depth"
      ]
    });
  }
});

// Vite middleware for development or static file server for production
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
