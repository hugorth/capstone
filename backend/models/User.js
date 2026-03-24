const mongoose = require('mongoose');
const validator = require('validator');

const userSchema = new mongoose.Schema({
  // Authentication
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    validate: [validator.isEmail, 'Please provide a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false // Ne pas retourner le password par défaut
  },
  
  // Profile Information
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  avatar: {
    type: String,
    default: function() {
      return this.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
  },
  
  // Medical Information
  age: {
    type: Number,
    min: [0, 'Age cannot be negative'],
    max: [150, 'Age cannot exceed 150']
  },
  weight: {
    type: Number,
    min: [0, 'Weight cannot be negative'],
    max: [500, 'Weight cannot exceed 500 kg']
  },
  height: {
    type: Number,
    min: [0, 'Height cannot be negative'],
    max: [300, 'Height cannot exceed 300 cm']
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other', 'prefer-not-to-say'],
    default: 'prefer-not-to-say'
  },
  medicalConditions: [{
    type: String,
    trim: true
  }],
  allergies: [{
    type: String,
    trim: true
  }],
  
  // Emergency Contacts
  emergencyContacts: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    phone: {
      type: String,
      required: true,
      validate: {
        validator: function(v) {
          return /^[\d\s\+\-\(\)]+$/.test(v);
        },
        message: 'Please provide a valid phone number'
      }
    },
    relation: {
      type: String,
      enum: ['family', 'friend', 'doctor', 'caregiver', 'emergency', 'other'],
      default: 'family'
    },
    isPrimary: {
      type: Boolean,
      default: false
    }
  }],
  
  // Device Information
  deviceId: {
    type: String,
    sparse: true,
    unique: true
  },
  deviceModel: String,
  lastDeviceSync: Date,
  
  // Account Status
  isActive: {
    type: Boolean,
    default: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  role: {
    type: String,
    enum: ['user', 'caregiver', 'doctor', 'admin'],
    default: 'user'
  },
  
  // Security
  passwordChangedAt: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  emailVerificationToken: String,
  emailVerificationExpires: Date,
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: Date,
  
  // Refresh Tokens (pour JWT rotation)
  refreshTokens: [{
    token: String,
    createdAt: {
      type: Date,
      default: Date.now
    },
    expiresAt: Date,
    deviceInfo: {
      userAgent: String,
      ip: String
    }
  }],
  
  // Activity Tracking
  dailySteps: {
    type: Number,
    default: 0
  },
  falls: [{
    date: {
      type: Date,
      default: Date.now
    },
    location: {
      type: String,
      default: 'Position inconnue'
    },
    severity: {
      type: String,
      default: 'Élevée'
    }
  }],
  lastLogin: Date,
  lastLoginIP: String,
  loginHistory: [{
    timestamp: {
      type: Date,
      default: Date.now
    },
    ip: String,
    userAgent: String,
    success: Boolean
  }],
  
  // Preferences
  preferences: {
    notifications: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      sms: { type: Boolean, default: false }
    },
    privacy: {
      shareData: { type: Boolean, default: false },
      publicProfile: { type: Boolean, default: false }
    },
    language: {
      type: String,
      default: 'fr',
      enum: ['en', 'fr', 'es', 'de']
    },
    theme: {
      type: String,
      default: 'light',
      enum: ['light', 'dark', 'auto']
    },
    units: {
      distance: {
        type: String,
        default: 'metric',
        enum: ['metric', 'imperial']
      },
      temperature: {
        type: String,
        default: 'celsius',
        enum: ['celsius', 'fahrenheit']
      }
    }
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ============== INDEXES ==============
userSchema.index({ email: 1 });
userSchema.index({ deviceId: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ createdAt: -1 });

// ============== VIRTUALS ==============
userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

userSchema.virtual('bmi').get(function() {
  if (this.weight && this.height) {
    const heightInMeters = this.height / 100;
    return (this.weight / (heightInMeters * heightInMeters)).toFixed(1);
  }
  return null;
});

// ============== MIDDLEWARE ==============

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  const bcrypt = require('bcryptjs');
  this.password = await bcrypt.hash(this.password, parseInt(process.env.BCRYPT_ROUNDS) || 12);
  this.passwordChangedAt = Date.now() - 1000; // Soustraire 1s pour éviter les problèmes de timing avec JWT
  next();
});

// Update timestamps
userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// ============== METHODS ==============

// Compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  const bcrypt = require('bcryptjs');
  return await bcrypt.compare(candidatePassword, this.password);
};

// Check if password was changed after JWT was issued
userSchema.methods.changedPasswordAfter = function(JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

// Increment login attempts
userSchema.methods.incLoginAttempts = async function() {
  // Reset attempts if lock has expired
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return await this.updateOne({
      $set: { loginAttempts: 1 },
      $unset: { lockUntil: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  const maxAttempts = 5;
  const lockTime = 2 * 60 * 60 * 1000; // 2 hours
  
  // Lock account after max attempts
  if (this.loginAttempts + 1 >= maxAttempts && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + lockTime };
  }
  
  return await this.updateOne(updates);
};

// Reset login attempts
userSchema.methods.resetLoginAttempts = async function() {
  return await this.updateOne({
    $set: { loginAttempts: 0 },
    $unset: { lockUntil: 1 }
  });
};

// Add login to history
userSchema.methods.addLoginHistory = async function(ip, userAgent, success = true) {
  const maxHistoryLength = 50;
  
  return await this.updateOne({
    $push: {
      loginHistory: {
        $each: [{ timestamp: Date.now(), ip, userAgent, success }],
        $slice: -maxHistoryLength
      }
    },
    $set: {
      lastLogin: Date.now(),
      lastLoginIP: ip
    }
  });
};

// Generate password reset token
userSchema.methods.createPasswordResetToken = function() {
  const crypto = require('crypto');
  const resetToken = crypto.randomBytes(32).toString('hex');
  
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  
  return resetToken;
};

// Generate email verification token
userSchema.methods.createEmailVerificationToken = function() {
  const crypto = require('crypto');
  const verificationToken = crypto.randomBytes(32).toString('hex');
  
  this.emailVerificationToken = crypto
    .createHash('sha256')
    .update(verificationToken)
    .digest('hex');
  
  this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  
  return verificationToken;
};

// Clean expired refresh tokens
userSchema.methods.cleanExpiredTokens = async function() {
  return await this.updateOne({
    $pull: {
      refreshTokens: {
        expiresAt: { $lt: Date.now() }
      }
    }
  });
};

// Safe user object (without sensitive data)
userSchema.methods.toSafeObject = function() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.passwordResetToken;
  delete obj.passwordResetExpires;
  delete obj.emailVerificationToken;
  delete obj.emailVerificationExpires;
  delete obj.refreshTokens;
  delete obj.__v;
  return obj;
};

// ============== STATIC METHODS ==============

// Find user by credentials
userSchema.statics.findByCredentials = async function(email, password) {
  const user = await this.findOne({ email, isActive: true }).select('+password');
  
  if (!user) {
    throw new Error('Invalid credentials');
  }
  
  if (user.isLocked) {
    throw new Error('Account is locked due to too many failed login attempts. Please try again later.');
  }
  
  const isMatch = await user.comparePassword(password);
  
  if (!isMatch) {
    await user.incLoginAttempts();
    throw new Error('Invalid credentials');
  }
  
  await user.resetLoginAttempts();
  return user;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
