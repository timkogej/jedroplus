import { NextRequest, NextResponse } from 'next/server';

// TODO: Wire up a real persistence channel here when ready.
// Options:
//   1. Insert into `enterprise_inquiries` Supabase table (create it first).
//   2. Forward to n8n webhook → email the owner.
// For now, the request is logged on the server and the client receives a 200.

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, phone, message } = body as {
      name?: string;
      email?: string;
      phone?: string;
      message?: string;
    };

    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      return NextResponse.json({ ok: false, error: 'Missing required fields' }, { status: 400 });
    }

    // TODO: replace this log with a real action (Supabase insert / n8n webhook)
    console.log('[enterprise-inquiry] New inquiry:', {
      name,
      email,
      phone,
      message,
      receivedAt: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
