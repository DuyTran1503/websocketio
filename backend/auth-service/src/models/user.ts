import mongoose, { Document, Schema, CallbackError } from 'mongoose';
import bcrypt from 'bcrypt';

// Định nghĩa interface cho dữ liệu người dùng (User)
export interface IUser extends Document {
  username: string;
  email: string;
  password: string;
  avatar: string;
  status: 'online' | 'offline' | 'away';
  createdAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

// Định nghĩa schema cho người dùng
const userSchema: Schema<IUser> = new Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    avatar: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['online', 'offline', 'away'],
      default: 'offline',
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Hash mật khẩu trước khi lưu người dùng
userSchema.pre<IUser>('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error: unknown) { // Ép kiểu `error` thành `unknown`
    if (error instanceof Error) { // Kiểm tra xem `error` có phải là đối tượng `Error` không
      next(error); // Gửi lỗi nếu có
    } else {
      next(new Error('An unknown error occurred')); // Nếu không phải lỗi `Error`, tạo lỗi mới
    }
  }
});

// Phương thức để so sánh mật khẩu
userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Tạo model và export
const User = mongoose.model<IUser>('User', userSchema);

export default User;
