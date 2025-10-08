import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const { enabled } = await request.json();

    if (typeof enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'Enabled value must be a boolean' },
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

    // Check if SAVE_FILTER already exists
    const saveFilterRegex = /^SAVE_FILTER=.*$/m;
    
    if (saveFilterRegex.test(envContent)) {
      // Replace existing SAVE_FILTER
      envContent = envContent.replace(saveFilterRegex, `SAVE_FILTER=${enabled}`);
    } else {
      // Add new SAVE_FILTER
      envContent += (envContent.endsWith('\n') ? '' : '\n') + `SAVE_FILTER=${enabled}\n`;
    }

    // Write back to .env file
    fs.writeFileSync(envPath, envContent);

    return NextResponse.json({ success: true, message: 'Save filter setting saved successfully' });
  } catch (error) {
    console.error('Error saving save filter setting:', error);
    return NextResponse.json(
      { error: 'Failed to save save filter setting' },
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

    // Read .env file and extract SAVE_FILTER
    const envContent = fs.readFileSync(envPath, 'utf8');
    const saveFilterMatch = envContent.match(/^SAVE_FILTER=(.*)$/m);
    
    const enabled = saveFilterMatch ? saveFilterMatch[1] === 'true' : false;
    
    return NextResponse.json({ enabled });
  } catch (error) {
    console.error('Error reading save filter setting:', error);
    return NextResponse.json(
      { error: 'Failed to read save filter setting' },
      { status: 500 }
    );
  }
}
