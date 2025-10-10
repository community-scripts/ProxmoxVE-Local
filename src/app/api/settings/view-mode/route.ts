import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const { viewMode } = await request.json();

    if (!viewMode || !['card', 'list'].includes(viewMode)) {
      return NextResponse.json(
        { error: 'View mode must be either "card" or "list"' },
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

    // Check if VIEW_MODE already exists
    const viewModeRegex = /^VIEW_MODE=.*$/m;
    const viewModeMatch = viewModeRegex.exec(envContent);
    
    if (viewModeMatch) {
      // Replace existing VIEW_MODE
      envContent = envContent.replace(viewModeRegex, `VIEW_MODE=${viewMode}`);
    } else {
      // Add new VIEW_MODE
      envContent += (envContent.endsWith('\n') ? '' : '\n') + `VIEW_MODE=${viewMode}\n`;
    }

    // Write back to .env file
    fs.writeFileSync(envPath, envContent);

    return NextResponse.json({ success: true, message: 'View mode saved successfully' });
  } catch (error) {
    console.error('Error saving view mode:', error);
    return NextResponse.json(
      { error: 'Failed to save view mode' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // Path to the .env file
    const envPath = path.join(process.cwd(), '.env');
    
    if (!fs.existsSync(envPath)) {
      return NextResponse.json({ viewMode: 'card' }); // Default to card view
    }

    // Read .env file and extract VIEW_MODE
    const envContent = fs.readFileSync(envPath, 'utf8');
    const viewModeRegex = /^VIEW_MODE=(.*)$/m;
    const viewModeMatch = viewModeRegex.exec(envContent);
    
    if (!viewModeMatch) {
      return NextResponse.json({ viewMode: 'card' }); // Default to card view
    }

    const viewMode = viewModeMatch[1]?.trim();
    
    // Validate the view mode
    if (!viewMode || !['card', 'list'].includes(viewMode)) {
      return NextResponse.json({ viewMode: 'card' }); // Default to card view
    }
    
    return NextResponse.json({ viewMode });
  } catch (error) {
    console.error('Error reading view mode:', error);
    return NextResponse.json({ viewMode: 'card' }); // Default to card view
  }
}
