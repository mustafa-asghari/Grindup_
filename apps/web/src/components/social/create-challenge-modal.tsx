
'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Swords, Coins, Clock } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface CreateChallengeModalProps {
    targetUser: { id: string; name: string };
    trigger?: React.ReactNode;
}

export function CreateChallengeModal({ targetUser, trigger }: CreateChallengeModalProps) {
    const [open, setOpen] = useState(false);
    const [type, setType] = useState('study_time');
    const [stake, setStake] = useState('50');
    const [duration, setDuration] = useState('24');
    const [targetValue, setTargetValue] = useState('60'); // Minutes default
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [problems, setProblems] = useState<{ id: string; title: string; difficulty: string }[]>([]);
    const [targetProblemId, setTargetProblemId] = useState('');
    const [problemSearch, setProblemSearch] = useState('');
    const [showProblemDropdown, setShowProblemDropdown] = useState(false);

    useEffect(() => {
        if (open && type === 'leetcode_race') {
            fetch('/api/social/challenges/problems')
                .then(res => res.json())
                .then(data => {
                    if (Array.isArray(data)) setProblems(data);
                })
                .catch(console.error);
        }
    }, [open, type]);

    // Filter problems based on search
    const filteredProblems = problems
        .filter(p => p.title.toLowerCase().includes(problemSearch.toLowerCase()))
        .slice(0, 8);

    const selectedProblem = problems.find(p => p.id === targetProblemId);

    const handleSubmit = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/social/challenges', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    targetUserId: targetUser.id,
                    type,
                    stake: parseInt(stake),
                    duration: parseInt(duration),
                    targetValue: type === 'leetcode_race' ? 1 : parseInt(targetValue),
                    targetProblemId: type === 'leetcode_race' ? targetProblemId : undefined
                })
            });

            if (res.ok) {
                toast({ title: "Challenge Sent!", description: `Challenged ${targetUser.name} to a duel!` });
                setOpen(false);
            } else {
                const body = await res.text();
                let errorMsg = "Failed to send request";
                try {
                    const data = JSON.parse(body);
                    errorMsg = data.error || errorMsg;
                } catch {
                    errorMsg = body || errorMsg;
                }
                toast({ title: "Cannot Challenge", description: errorMsg, variant: "destructive" });
            }
        } catch (_error) {
            toast({ title: "Error", description: "Failed to create challenge", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || <Button size="sm" variant="secondary"><Swords className="h-4 w-4 mr-2" /> Challenge</Button>}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Challenge {targetUser.name}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Type</label>
                        <Select value={type} onValueChange={setType}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="study_time">Study Time Race</SelectItem>
                                <SelectItem value="exercise_count">Problems Solved</SelectItem>
                                <SelectItem value="xp_race">XP Race</SelectItem>
                                <SelectItem value="leetcode_race">LeetCode Problem Race</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {type === 'leetcode_race' && (
                        <div className="space-y-2 relative">
                            <label className="text-sm font-medium">Search Problem</label>
                            <Input
                                type="text"
                                placeholder="Search by problem name..."
                                value={problemSearch}
                                onChange={(e) => {
                                    setProblemSearch(e.target.value);
                                    setShowProblemDropdown(true);
                                }}
                                onFocus={() => setShowProblemDropdown(true)}
                                className="w-full"
                            />
                            {selectedProblem && (
                                <div className="text-xs text-muted-foreground mt-1">
                                    Selected: <span className="font-medium">{selectedProblem.title}</span>
                                    <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${selectedProblem.difficulty === 'easy' ? 'bg-green-500/20 text-green-300' :
                                            selectedProblem.difficulty === 'medium' ? 'bg-yellow-500/20 text-yellow-300' :
                                                'bg-red-500/20 text-red-300'
                                        }`}>
                                        {selectedProblem.difficulty}
                                    </span>
                                </div>
                            )}
                            {showProblemDropdown && filteredProblems.length > 0 && (
                                <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-[300px] overflow-y-auto">
                                    {filteredProblems.map((p) => (
                                        <button
                                            key={p.id}
                                            type="button"
                                            onClick={() => {
                                                setTargetProblemId(p.id);
                                                setProblemSearch(p.title);
                                                setShowProblemDropdown(false);
                                            }}
                                            className="w-full text-left px-3 py-2 hover:bg-accent transition-colors flex items-center justify-between"
                                        >
                                            <span className="text-sm">{p.title}</span>
                                            <span className={`text-xs px-2 py-0.5 rounded ${p.difficulty === 'easy' ? 'bg-green-500/20 text-green-300' :
                                                    p.difficulty === 'medium' ? 'bg-yellow-500/20 text-yellow-300' :
                                                        'bg-red-500/20 text-red-300'
                                                }`}>
                                                {p.difficulty}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                            {showProblemDropdown && problemSearch && filteredProblems.length === 0 && (
                                <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg p-3">
                                    <p className="text-sm text-muted-foreground">{`No problems found matching "${problemSearch}"`}</p>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium flex items-center gap-2">
                                <Coins className="h-4 w-4 text-yellow-500" /> Stake (XP)
                            </label>
                            <Input type="number" value={stake} onChange={e => setStake(e.target.value)} min={10} max={1000} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium flex items-center gap-2">
                                <Clock className="h-4 w-4" /> Duration (Hours)
                            </label>
                            <Input type="number" value={duration} onChange={e => setDuration(e.target.value)} min={1} max={168} />
                        </div>
                    </div>

                    <div className="space-y-2">
                        {type !== 'leetcode_race' && (
                            <>
                                <label className="text-sm font-medium">Target Goal {type === 'study_time' ? '(Minutes)' : type === 'xp_race' ? '(XP)' : '(Count)'}</label>
                                <Input type="number" value={targetValue} onChange={e => setTargetValue(e.target.value)} />
                            </>
                        )}
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={handleSubmit} disabled={loading} className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white font-bold">
                        {loading ? 'Throwing Gauntlet...' : 'Throw Gauntlet! ⚔️'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
