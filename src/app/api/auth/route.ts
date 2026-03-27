import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { username, password } = await request.json();
  const agentsRaw = process.env.AGENTS || '[]';
  let agents: { name: string; username: string; password: string; stage?: string }[] = [];
  
  try {
    agents = JSON.parse(agentsRaw);
  } catch (e) {
    console.error('Failed to parse AGENTS:', e);
  }

  const agent = agents.find(
    (a) => a.username.toLowerCase() === username.toLowerCase() && a.password === password
  );

  if (!agent) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const token = process.env.SESSION_TOKEN || 'bt_session';
  const isProd = process.env.NODE_ENV === 'production';
  const maxAge = 60 * 60 * 24 * 7;
  const stage = agent.stage || 'active';

  const response = NextResponse.json({ 
    success: true, 
    name: agent.name, 
    stage,
    script: `localStorage.setItem('bt_os_agent', '${agent.name}'); localStorage.setItem('bt_os_stage', '${stage}');`
  });
  
  response.cookies.set('bt_os_session', token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge,
    path: '/',
  });
  
  response.cookies.set('bt_os_agent', agent.name, {
    httpOnly: false,
    secure: isProd,
    sameSite: 'lax',
    maxAge,
    path: '/',
  });
  
  response.cookies.set('bt_os_stage', stage, {
    httpOnly: false,
    secure: isProd,
    sameSite: 'lax',
    maxAge,
    path: '/',
  });

  return response;
}
