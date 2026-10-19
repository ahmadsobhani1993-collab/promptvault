import { NextResponse } from "next/server";
import { askAI } from "@/lib/groq";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { prompt, systemPrompt } = body;

    if (!prompt) {
      return NextResponse.json(
        { error: "متن پرامپت الزامی است" },
        { status: 400 }
      );
    }

    const result = await askAI(prompt, systemPrompt);
    return NextResponse.json({ result });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "خطای ناشناخته رخ داد" },
      { status: 500 }
    );
  }
}