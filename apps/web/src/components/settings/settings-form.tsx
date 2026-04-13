'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { User, Save, Trash2, Shield, Loader2 } from 'lucide-react';
import { updateProfile, deleteAccount } from '@/app/actions/settings';

interface SettingsFormProps {
    user: {
        id: string;
        name: string | null;
        username: string | null;
        email: string | null;
    };
}

export function SettingsForm({ user }: SettingsFormProps) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [showConfirm, setShowConfirm] = useState(false);

    const handleSubmit = async (formData: FormData) => {
        setIsLoading(true);
        setMessage(null);

        try {
            const result = await updateProfile(formData);
            if (result.error) {
                setMessage({ type: 'error', text: result.error });
            } else {
                setMessage({ type: 'success', text: 'Profile updated successfully!' });
                router.refresh();
            }
        } catch (e) {
            setMessage({ type: 'error', text: 'Something went wrong.' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async () => {
        setIsLoading(true);
        try {
            const result = await deleteAccount();
            if (result.error) {
                setMessage({ type: 'error', text: result.error });
                setIsLoading(false);
            } else {
                setMessage({ type: 'success', text: 'Account deleted. Redirecting…' });
                setShowConfirm(false);
                setTimeout(() => router.push('/'), 800);
            }
        } catch (e) {
            setMessage({ type: 'error', text: 'Failed to delete account.' });
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-8">
            {message && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-4 rounded-lg border ${message.type === 'success'
                            ? 'bg-green-500/10 border-green-500/20 text-green-400'
                            : 'bg-red-500/10 border-red-500/20 text-red-400'
                        }`}
                >
                    {message.text}
                </motion.div>
            )}

            {/* Profile Section */}
            <section className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-6 space-y-6">
                <div className="flex items-center gap-3 border-b border-zinc-800 pb-4">
                    <User className="w-5 h-5 text-indigo-400" />
                    <h2 className="text-lg font-semibold text-white">Profile Settings</h2>
                </div>

                <form action={handleSubmit} className="space-y-4">
                    <div className="grid gap-2">
                        <label className="text-sm font-medium text-zinc-400">Email</label>
                        <input
                            type="email"
                            value={user.email || ''}
                            disabled
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-zinc-500 cursor-not-allowed"
                        />
                        <p className="text-xs text-zinc-600">Email cannot be changed.</p>
                    </div>

                    <div className="grid gap-2">
                        <label className="text-sm font-medium text-zinc-400">Display Name</label>
                        <input
                            name="name"
                            defaultValue={user.name || ''}
                            placeholder="Your Name"
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                        />
                    </div>

                    <div className="grid gap-2">
                        <label className="text-sm font-medium text-zinc-400">Username</label>
                        <input
                            name="username"
                            defaultValue={user.username || ''}
                            placeholder="username"
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                        />
                    </div>

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Save Changes
                        </button>
                    </div>
                </form>
            </section>

            {/* Danger Zone */}
            <section className="bg-red-500/5 rounded-xl border border-red-500/10 p-6 space-y-6">
                <div className="flex items-center gap-3 border-b border-red-500/10 pb-4">
                    <Shield className="w-5 h-5 text-red-500" />
                    <h2 className="text-lg font-semibold text-red-500">Danger Zone</h2>
                </div>

                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-white font-medium">Delete Account</h3>
                        <p className="text-sm text-zinc-500 mt-1">
                            Permanently delete your account and all associated data.
                        </p>
                    </div>
                    <button
                        onClick={() => setShowConfirm(true)}
                        disabled={isLoading}
                        className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/50 px-4 py-2 rounded-lg font-medium transition-all disabled:opacity-50"
                    >
                        <Trash2 className="w-4 h-4" />
                        Delete Account
                    </button>
                </div>
            </section>

            {showConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.96, y: 12 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        className="w-full max-w-md bg-zinc-950 border border-zinc-800/80 rounded-xl shadow-2xl p-6 space-y-4"
                    >
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                                <Shield className="w-5 h-5 text-red-400" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-white">Delete account?</h3>
                                <p className="text-sm text-zinc-500">
                                    This action is permanent and removes all your data. You will be signed out.
                                </p>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                onClick={() => setShowConfirm(false)}
                                disabled={isLoading}
                                className="px-4 py-2 rounded-lg border border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:text-white transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={isLoading}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition-colors disabled:opacity-50"
                            >
                                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                Delete
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
}
