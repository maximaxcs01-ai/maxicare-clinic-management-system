require('dotenv').config({ path: require('node:path').join(__dirname, '..', '.env'), quiet: true });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const readline = require('readline');
const User = require('../models/User');
const connectDB = require('../config/db');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const prompt = (question) => new Promise((resolve) => rl.question(question, resolve));

const validateEmail = (email) => {
  const re = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  return re.test(email);
};

(async () => {
  try {
    await connectDB();

    const firstName = (await prompt('First Name (required): ')).trim();
    const middleName = (await prompt('Middle Name (optional): ')).trim();
    const lastName = (await prompt('Last Name (required): ')).trim();
    const emailInput = (await prompt('Email (required): ')).trim();
    const password = (await prompt('Password 8-16 chars (required): ')).trim();

    // Validation
    if (!firstName) throw new Error('First name is required.');
    if (!lastName) throw new Error('Last name is required.');
    if (!validateEmail(emailInput)) throw new Error('Invalid email format.');
    if (password.length < 8 || password.length > 16) throw new Error('Password must be 8-16 characters.');

    // Normalization – match auth logic (lowercase trimmed)
    const email = emailInput.toLowerCase();

    const existing = await User.findOne({ email });
    if (existing) {
      console.log('An account with this email already exists. No changes made.');
      process.exit(0);
    }

    const hashed = await bcrypt.hash(password, 10);
    await User.create({
      firstName,
      middleName: middleName || undefined,
      lastName,
      email,
      password: hashed,
      role: 'admin',
      status: 'active',
      emailVerified: true,
      tokenVersion: 0,
    });

    console.log('Initial admin user created successfully.');
  } catch (err) {
    console.error('Error creating admin:', err.message);
  } finally {
    rl.close();
    await mongoose.disconnect();
    process.exit(0);
  }
})();
