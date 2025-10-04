import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getDatabase } from '../../../../server/database';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const db = getDatabase();

    // Check if any users exist
    const existingUser = db.getUserByUsername('admin'); // Check for admin user
    if (existingUser) {
      return NextResponse.json(
        { error: 'Admin user already exists' },
        { status: 409 }
      );
    }

    const body = await request.json() as { username?: string; password?: string };
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    // Hash password
    const saltRounds = 12;
    const password_hash = await bcrypt.hash(password, saltRounds);

    // Create admin user
    const result = db.createUser({
      username,
      password_hash
    });

    return NextResponse.json({
      success: true,
      message: 'Admin user created successfully',
      user: {
        id: result.lastInsertRowid,
        username
      }
    });

  } catch (error) {
    console.error('Setup error:', error);

    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      return NextResponse.json(
        { error: 'Username already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const db = getDatabase();

    // Check if any users exist
    const existingUser = db.getUserByUsername('admin');

    return NextResponse.json({
      needsSetup: !existingUser
    });

  } catch (error) {
    console.error('Setup check error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}