import User from '../models/user';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';
const JWT_EXPIRES_IN = '7d';

interface IResponse {
  status: number;
  data: {
    message?: string;
    token?: string;
    user?: {
      id: string;
      username: string;
      email: string;
      avatar: string;
      status?: string;
    };
    error?: string;
  };
}

interface IRegisterCredentials {
  username: string;
  email: string;
  password: string;
}

interface ILoginCredentials {
  email?: string;
  username?: string;
  password: string;
}

class AuthController {
  async register(userData: IRegisterCredentials): Promise<IResponse> {
    try {
      const existingUser = await User.findOne({
        $or: [
          { email: userData.email },
          { username: userData.username },
        ],
      });

      if (existingUser) {
        return {
          status: 400,
          data: { error: 'Email or username already in use' },
        };
      }

      const user = new User(userData);
      await user.save();

      const token = jwt.sign({ id: user._id.toString() }, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN,
      });

      return {
        status: 201,
        data: {
          message: 'User registered successfully',
          token,
          user: {
            id: user._id.toString(),
            username: user.username,
            email: user.email,
            avatar: user.avatar,
          },
        },
      };
    } catch (error) {
      console.error('Registration error:', error);
      return {
        status: 500,
        data: { error: 'Registration failed' },
      };
    }
  }

  async login(credentials: ILoginCredentials): Promise<IResponse> {
    try {
      const user = await User.findOne({
        $or: [{ email: credentials.email }, { username: credentials.username }],
      });

      if (!user) {
        return {
          status: 404,
          data: { error: 'User not found' },
        };
      }

      const isMatch = await user.comparePassword(credentials.password);
      if (!isMatch) {
        return {
          status: 401,
          data: { error: 'Invalid credentials' },
        };
      }

      user.status = 'online';
      await user.save();

      const token = jwt.sign({ id: user._id.toString() }, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN,
      });

      return {
        status: 200,
        data: {
          message: 'Login successful',
          token,
          user: {
            id: user._id.toString(),
            username: user.username,
            email: user.email,
            avatar: user.avatar,
            status: user.status,
          },
        },
      };
    } catch (error) {
      console.error('Login error:', error);
      return {
        status: 500,
        data: { error: 'Login failed' },
      };
    }
  }

  async getProfile(userId: string): Promise<IResponse> {
    try {
      const user = await User.findById(userId).select('-password');

      if (!user) {
        return {
          status: 404,
          data: { error: 'User not found' },
        };
      }

      return {
        status: 200,
        data: {
          user: {
            id: user._id.toString(),
            username: user.username,
            email: user.email,
            avatar: user.avatar,
            status: user.status,
          },
        },
      };
    } catch (error) {
      console.error('Get profile error:', error);
      return {
        status: 500,
        data: { error: 'Failed to get profile' },
      };
    }
  }
}

export default new AuthController();
