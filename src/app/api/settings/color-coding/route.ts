import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const { enabled } = await request.json();

    if (typeof enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'Enabled must be a boolean value' },
        { status: 400 }
      );
    }

    // Path to the .env file
    const envPath = path.join(process.cwd(), '.env');
    
    // Read existing .env file
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }

    // Check if SERVER_COLOR_CODING_ENABLED already exists
    const colorCodingRegex = /^SERVER_COLOR_CODING_ENABLED=.*$/m;
    const colorCodingMatch = colorCodingRegex.exec(envContent);
    
    if (colorCodingMatch) {
      // Replace existing SERVER_COLOR_CODING_ENABLED
      envContent = envContent.replace(colorCodingRegex, `SERVER_COLOR_CODING_ENABLED=${enabled}`);
    } else {
      // Add new SERVER_COLOR_CODING_ENABLED
      envContent += (envContent.endsWith('\n') ? '' : '\n') + `SERVER_COLOR_CODING_ENABLED=${enabled}\n`;
    }

    // Write back to .env file
    fs.writeFileSync(envPath, envContent);

    return NextResponse.json({ success: true, message: 'Color coding setting saved successfully' });
  } catch (error) {
    console.error('Error saving color coding setting:', error);
    return NextResponse.json(
      { error: 'Failed to save color coding setting' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // Path to the .env file
    const envPath = path.join(process.cwd(), '.env');
    
    if (!fs.existsSync(envPath)) {
      return NextResponse.json({ enabled: false });
    }

    const envContent = fs.readFileSync(envPath, 'utf8');
    
    // Extract SERVER_COLOR_CODING_ENABLED
    const colorCodingRegex = /^SERVER_COLOR_CODING_ENABLED=(.*)$/m;
    const colorCodingMatch = colorCodingRegex.exec(envContent);
    const enabled = colorCodingMatch ? colorCodingMatch[1]?.trim().toLowerCase() === 'true' : false;
    
    return NextResponse.json({ enabled });
  } catch (error) {
    console.error('Error reading color coding setting:', error);
    return NextResponse.json(
      { error: 'Failed to read color coding setting' },
      { status: 500 }
    );
  }
}
