import { Store } from '../store';
import { AppUser, SUPER_ADMIN_EMAIL } from '../types';
import logger from '../logger';

export class UserService {
    private static instance: UserService;

    static getInstance(): UserService {
        if (!UserService.instance) {
            UserService.instance = new UserService();
        }
        return UserService.instance;
    }

    async getOrCreateUser(decodedToken: { uid: string; email?: string; name?: string }): Promise<AppUser> {
        const { uid, email, name } = decodedToken;
        const userEmail = email || '';
        const displayName = name || email || 'Unknown';

        let user = await Store.getUser(uid);

        if (user) {
            user.lastLoginAt = new Date().toISOString();
            if (displayName && displayName !== user.displayName) {
                user.displayName = displayName;
            }
            if (userEmail === SUPER_ADMIN_EMAIL) {
                user.role = 'super_admin';
                user.active = true;
            }
            await Store.saveUser(user);
            return user as AppUser;
        }

        const isSuperAdmin = userEmail === SUPER_ADMIN_EMAIL;
        const settings = await Store.getSettings().catch(() => ({}));
        const autoActivate = settings?.autoActivate !== false;
        const newUser: AppUser = {
            uid,
            email: userEmail,
            displayName,
            role: isSuperAdmin ? 'super_admin' : 'admin',
            active: isSuperAdmin || autoActivate,
            createdAt: new Date().toISOString(),
            lastLoginAt: new Date().toISOString()
        };

        await Store.saveUser(newUser);
        logger.info('New user auto-provisioned', { email: userEmail, role: newUser.role });
        return newUser;
    }

    async listUsers(): Promise<AppUser[]> {
        const users = await Store.getUsers();
        return users as AppUser[];
    }

    async getUser(uid: string): Promise<AppUser | null> {
        const user = await Store.getUser(uid);
        return user as AppUser | null;
    }

    async toggleUserActive(uid: string): Promise<AppUser | null> {
        const user = await Store.getUser(uid);
        if (!user) return null;
        
        if (user.email === SUPER_ADMIN_EMAIL) {
            return user as AppUser;
        }

        user.active = !user.active;
        await Store.saveUser(user);
        logger.info('User active toggled', { uid, active: user.active });
        return user as AppUser;
    }
}
