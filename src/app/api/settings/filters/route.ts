import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const { filters } = await request.json();

    if (!filters || typeof filters !== 'object') {
      return NextResponse.json(
        { error: 'Filters object is required' },
        { status: 400 }
      );
    }

    // Validate filter structure
    const requiredFields = ['searchQuery', 'showUpdatable', 'selectedTypes', 'sortBy', 'sortOrder'];
    for (const field of requiredFields) {
      if (!(field in filters)) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Path to the .env file
    const envPath = path.join(process.cwd(), '.env');
    
    // Read existing .env file
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }

    // Serialize filters to JSON string
    const filtersJson = JSON.stringify(filters);
    
    // Check if FILTERS already exists
    const filtersRegex = /^FILTERS=.*$/m;
    const filtersMatch = filtersRegex.exec(envContent);
    
    if (filtersMatch) {
      // Replace existing FILTERS
      envContent = envContent.replace(filtersRegex, `FILTERS=${filtersJson}`);
    } else {
      // Add new FILTERS
      envContent += (envContent.endsWith('\n') ? '' : '\n') + `FILTERS=${filtersJson}\n`;
    }

    // Write back to .env file
    fs.writeFileSync(envPath, envContent);

    return NextResponse.json({ success: true, message: 'Filters saved successfully' });
  } catch (error) {
    console.error('Error saving filters:', error);
    return NextResponse.json(
      { error: 'Failed to save filters' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // Path to the .env file
    const envPath = path.join(process.cwd(), '.env');
    
    if (!fs.existsSync(envPath)) {
      return NextResponse.json({ filters: null });
    }

    // Read .env file and extract FILTERS
    const envContent = fs.readFileSync(envPath, 'utf8');
    const filtersRegex = /^FILTERS=(.*)$/m;
    const filtersMatch = filtersRegex.exec(envContent);
    
    if (!filtersMatch) {
      return NextResponse.json({ filters: null });
    }

    try {
      const filtersJson = filtersMatch[1]?.trim();
      
      // Check if filters JSON is empty or invalid
      if (!filtersJson || filtersJson === '') {
        return NextResponse.json({ filters: null });
      }
      
      const filters = JSON.parse(filtersJson);
      
      // Validate the parsed filters
      const requiredFields = ['searchQuery', 'showUpdatable', 'selectedTypes', 'sortBy', 'sortOrder'];
      const isValid = requiredFields.every(field => field in filters);
      
      if (!isValid) {
        return NextResponse.json({ filters: null });
      }
      
      return NextResponse.json({ filters });
    } catch (parseError) {
      console.error('Error parsing saved filters:', parseError);
      return NextResponse.json({ filters: null });
    }
  } catch (error) {
    console.error('Error reading filters:', error);
    return NextResponse.json(
      { error: 'Failed to read filters' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    // Path to the .env file
    const envPath = path.join(process.cwd(), '.env');
    
    if (!fs.existsSync(envPath)) {
      return NextResponse.json({ success: true, message: 'No filters to clear' });
    }

    // Read existing .env file
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    // Remove FILTERS line
    const filtersRegex = /^FILTERS=.*$/m;
    const filtersMatch = filtersRegex.exec(envContent);
    if (filtersMatch) {
      envContent = envContent.replace(filtersRegex, '');
    }
    
    // Clean up extra newlines
    envContent = envContent.replace(/\n\n+/g, '\n');
    
    // Write back to .env file
    fs.writeFileSync(envPath, envContent);

    return NextResponse.json({ success: true, message: 'Filters cleared successfully' });
  } catch (error) {
    console.error('Error clearing filters:', error);
    return NextResponse.json(
      { error: 'Failed to clear filters' },
      { status: 500 }
    );
  }
}
