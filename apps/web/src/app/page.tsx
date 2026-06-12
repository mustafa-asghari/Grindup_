/* eslint-disable */
'use server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';

type SubmissionSummary = {
  id: string;
  problemId: string;
  problem: { title: string; difficulty: string };
  status: string;
  submittedAt: Date;
};

type ExerciseAttemptSummary = {
  id: string;
  createdAt: Date;
  isCorrect: boolean | null;
  exerciseId: string;
  timeSpentSecs?: number | null;
  exercise: {
    title: string;
    difficulty?: string | null;
    subjectId: string;
    topic?: { name: string } | null;
    subject?: { name?: string; slug?: string } | null;
  };
};

type TopicProgressEvent = {
  status: string;
  lastPracticed: Date | null;
  subjectTopic?: {
    name?: string | null;
    slug?: string | null;
    subject?: { slug?: string | null; name?: string | null } | null;
  } | null;
};

type EnrolledSubjectSummary = {
  id: string;
  name: string;
  slug: string;
  icon?: string | null;
  color?: string | null;
  category?: string | null;
  estimatedHours?: number | null;
  progressPercent: number;
  xpEarned: number;
  streak: number;
  lastAccessedAt?: string | null;
  topics: string[];
};

type HomeworkQueueItem = {
  id: string;
  title: string;
  subjectName?: string;
  subjectSlug?: string;
  topicSlug?: string;
  topicName?: string;
  dueDate: string;
  estimatedMins: number;
  type?: 'exercise' | 'problem' | 'reading' | 'general';
  isLate: boolean;
  isCompleted: boolean;
  latePenalty: number;
};

type ActivityItem = {
  title: string;
  time: string;
  status?: 'accepted' | 'wrong_answer' | string;
  difficulty?: 'easy' | 'medium' | 'hard' | string;
  subjectId?: string;
  attemptId?: string;
  exerciseId?: string;
};
import { HomeDashboard } from '@/components/dashboard/home-dashboard';
import { LandingPage } from '@/components/landing-page';

// Check if user is enrolled in any coding/programming subjects
function hasCodingSubject(subjects: { category?: string | null; name: string }[]): boolean {
  const codingKeywords = ['programming', 'coding', 'algorithm', 'data structure', 'python', 'javascript', 'java', 'c++', 'system design', 'leetcode'];
  return subjects.some(s =>
    s.category === 'technology' ||
    codingKeywords.some(k => s.name.toLowerCase().includes(k))
  );
}

function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default async function Home() {
  const session = await auth();

  if (!session?.user?.id) {
    return <LandingPage />;
  }

  const onboarding = await prisma.onboardingProfile.findUnique({
    where: { userId: session.user.id },
    select: { status: true, goal: true },
  });

  if (!onboarding || onboarding.status === 'incomplete') {
    redirect('/onboarding');
  }

  // Fetch full user data
  const userData = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      username: true,
      name: true,
      email: true,
      xp: true,
      level: true,
      currentStreak: true,
      image: true,
    },
  });

  // Fetch enrolled subjects
  const userSubjects = await prisma.userSubject.findMany({
    where: { userId: session.user.id },
    include: {
      subject: {
        select: {
          id: true,
          name: true,
          slug: true,
          icon: true,
          color: true,
          category: true,
          estimatedHours: true,
          topics: {
            select: { name: true }
          }
        },
      },
    },
    orderBy: { lastAccessedAt: 'desc' },
  });

  const enrolledSubjects: EnrolledSubjectSummary[] = userSubjects.map((us) => ({
    id: us.subject.id,
    name: us.subject.name,
    slug: us.subject.slug,
    icon: us.subject.icon,
    color: us.subject.color,
    category: us.subject.category,
    estimatedHours: us.subject.estimatedHours,
    progressPercent: us.progressPercent,
    xpEarned: us.xpEarned,
    streak: us.streak,
    lastAccessedAt: us.lastAccessedAt?.toISOString(),
    topics: us.subject.topics.map((t) => t.name),
  }));

  // Check if user has coding subjects
  const showCodingFeatures = hasCodingSubject(enrolledSubjects);

  // Fetch Exercise Attempts (for ALL subjects)
  let exerciseAttempts: ExerciseAttemptSummary[] = [];
  let topicProgressEvents: TopicProgressEvent[] = [];
  try {
    exerciseAttempts = await prisma.exerciseAttempt.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        exercise: {
          include: { topic: true, subject: true }
        }
      }
    });
    topicProgressEvents = await prisma.userTopicProgress.findMany({
      where: { userId: session.user.id, lastPracticed: { not: null } },
      orderBy: { lastPracticed: 'desc' },
      take: 20,
      include: {
        subjectTopic: {
          select: { name: true, slug: true, subject: { select: { slug: true, name: true } } }
        }
      }
    });
  } catch (e) {
    console.error("Failed to fetch exercise attempts", e);
  }

  // Fetch Homework Submissions (Assessments)
  let homeworkSubmissions: any[] = [];
  try {
    homeworkSubmissions = await prisma.homeworkSubmissions.findMany({
      where: { userId: session.user.id },
      orderBy: { submittedAt: 'desc' },
      take: 20,
      include: {
        homeworkAssignment: {
          select: { title: true, subject: true }
        }
      }
    });
  } catch (e) {
    console.error("Failed to fetch homework submissions", e);
  }


  let submissions: SubmissionSummary[] = [];
  const problemTopicsByProblemId = new Map<string, string[]>();
  let problemsSolved = 0;

  // Only fetch coding data if user has coding subjects
  if (showCodingFeatures) {
    // Fetch recent submissions
    submissions = await prisma.submission.findMany({
      where: { userId: session.user.id },
      orderBy: { submittedAt: 'desc' },
      take: 100,
      select: {
        id: true,
        problemId: true,
        status: true,
        submittedAt: true,
        problem: {
          select: {
            title: true,
            difficulty: true,
          },
        },
      },
    });

    if (submissions.length > 0) {
      const problemIds = Array.from(new Set(submissions.map(s => s.problemId)));
      const problemTopics = await prisma.problemTopic.findMany({
        where: {
          problemId: {
            in: problemIds,
          },
        },
        include: {
          topic: {
            select: {
              name: true,
            },
          },
        },
      }) as { problemId: string; topic: { name: string | null } }[];

      problemTopics.forEach((pt) => {
        const topicName = pt.topic?.name;
        if (!topicName) return;
        const existing = problemTopicsByProblemId.get(pt.problemId) ?? [];
        existing.push(topicName);
        problemTopicsByProblemId.set(pt.problemId, existing);
      });
    }

    // Calculate stats
    // Count unique problems solved
    const solvedProblems = await prisma.submission.findMany({
      where: { userId: session.user.id, status: 'accepted' },
      select: { problemId: true },
      distinct: ['problemId'],
    });
    problemsSolved = solvedProblems.length;
  }

  // Format recent activity 
  // Combine submissions and exercise attempts
  const combinedActivity = [
    ...submissions.map(s => ({ type: 'problem', data: s, date: new Date(s.submittedAt) })),
    ...(exerciseAttempts || []).map(a => ({ type: 'exercise', data: a, date: new Date(a.createdAt) })),
    ...(topicProgressEvents || []).map(p => ({ type: 'topic', data: p, date: p.lastPracticed ? new Date(p.lastPracticed) : new Date() })),
    ...homeworkSubmissions.map(h => ({ type: 'homework', data: h, date: new Date(h.submittedAt) }))
  ].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 10);

  const recentActivity: ActivityItem[] = combinedActivity.map(item => {
    if (item.type === 'problem') {
      const sub = item.data as typeof submissions[0];
      const problemTopicNames = problemTopicsByProblemId.get(sub.problemId) ?? [];
      const matchedSubject = enrolledSubjects.find((s) =>
        s.topics?.some((topicName: string) => problemTopicNames.includes(topicName))
      );
      const codingSubject = enrolledSubjects.find((s) =>
        s.category === 'technology' ||
        ['programming', 'coding'].some((k: string) => s.name.toLowerCase().includes(k))
      );
      return {
        title: sub.problem.title,
        status: sub.status,
        time: getRelativeTime(sub.submittedAt),
        difficulty: sub.problem.difficulty ?? undefined,
        subjectId: matchedSubject?.id ?? codingSubject?.id ?? undefined,
      };
    } else if (item.type === 'exercise') {
      const attempt = item.data as typeof exerciseAttempts[0];
      return {
        title: attempt.exercise.title,
        status: attempt.isCorrect ? 'accepted' : 'wrong_answer', // map to UI status
        time: getRelativeTime(attempt.createdAt),
        difficulty: attempt.exercise.difficulty ?? undefined,
        subjectId: attempt.exercise.subjectId,
        attemptId: attempt.id,
        exerciseId: attempt.exerciseId,
      };
    } else if (item.type === 'homework') {
      const sub = item.data as typeof homeworkSubmissions[0];
      return {
        title: sub.homeworkAssignment.title,
        status: 'accepted', // All submitted homework counts as accepted for activity feed or add grading logic
        time: getRelativeTime(sub.submittedAt),
        difficulty: undefined,
        subjectId: sub.homeworkAssignment.subject?.id,
      };
    } else {
      const progress = item.data as typeof topicProgressEvents[0];
      return {
        title: progress.subjectTopic?.name || 'Topic progress',
        status: progress.status === 'mastered' ? 'accepted' : 'in_progress',
        time: progress.lastPracticed ? getRelativeTime(progress.lastPracticed) : 'just now',
        difficulty: undefined,
        subjectId: progress.subjectTopic?.subject?.slug ?? undefined,
      };
    }
  });

  // User display info
  const displayName = userData?.name || userData?.username || session?.user?.name || 'Guest';
  const displayInitial = displayName.charAt(0).toUpperCase();
  const userStats = {
    streak: userData?.currentStreak || 0,
    xp: userData?.xp || 0,
    level: userData?.level || 1,
    problemsSolved,
  };

  // Estimate study time via Attempts (TimeSpent) + Coding Estimate
  const today = new Date();

  // Filter for Today and Weekly
  const submissionsToday = submissions.filter(s => {
    const d = new Date(s.submittedAt);
    return d.toDateString() === today.toDateString();
  });
  const attemptsToday = (exerciseAttempts || []).filter(a => {
    const d = new Date(a.createdAt);
    return d.toDateString() === today.toDateString();
  });

  const getProblemMins = (diff: string) => diff === 'easy' ? 5 : diff === 'medium' ? 10 : 15;

  // Calculate Daily Minutes
  let dailyMins = 0;
  const uniqueDailyProblems = new Set(submissionsToday.map(s => s.problemId));
  uniqueDailyProblems.forEach(pid => {
    const sub = submissionsToday.find(s => s.problemId === pid);
    if (sub) dailyMins += getProblemMins(sub.problem.difficulty);
  });
  attemptsToday.forEach(a => {
    dailyMins += (a.timeSpentSecs || 60) / 60; // seconds to minutes
  });

  // Calculate Weekly Minutes
  let weeklyMins = 0;
  const submissionsWeek = submissions.filter(s => {
    const diff = today.getTime() - new Date(s.submittedAt).getTime();
    return diff < 7 * 24 * 60 * 60 * 1000;
  });
  const attemptsWeek = (exerciseAttempts || []).filter(a => {
    const diff = today.getTime() - new Date(a.createdAt).getTime();
    return diff < 7 * 24 * 60 * 60 * 1000;
  });

  const uniqueWeeklyProblems = new Set(submissionsWeek.map(s => s.problemId));
  uniqueWeeklyProblems.forEach(pid => {
    const sub = submissionsWeek.find(s => s.problemId === pid);
    if (sub) weeklyMins += getProblemMins(sub.problem.difficulty);
  });
  attemptsWeek.forEach(a => {
    weeklyMins += (a.timeSpentSecs || 60) / 60;
  });

  const dailyHoursCompleted = Math.round((dailyMins / 60) * 10) / 10;
  const weeklyHoursCompleted = Math.round((weeklyMins / 60) * 10) / 10;

  // Fetch active homework assignments
  let homeworkQueue: HomeworkQueueItem[] = [];
  try {
    const assignments = await prisma.homeworkAssignment.findMany({
      where: {
        userId: session.user.id,
        completedAt: null,
      },
      orderBy: { dueDate: 'asc' },
      take: 10,
      include: {
        subject: {
          select: { name: true, slug: true },
        },
        topic: {
          select: { slug: true, name: true },
        },
      },
    }) as {
      id: string;
      title: string;
      subject?: { name?: string | null; slug?: string | null } | null;
      topic?: { slug?: string | null; name?: string | null } | null;
      dueDate: Date;
      estimatedMins?: number | null;
      assignmentType?: string | null;
    }[];

    const now = new Date();
    const allowedTypes = new Set(['exercise', 'problem', 'reading', 'general']);
    homeworkQueue = assignments.map((a) => {
      const normalizedType = allowedTypes.has((a.assignmentType || '').toLowerCase())
        ? (a.assignmentType as HomeworkQueueItem['type'])
        : 'exercise';
      return {
        id: a.id,
        title: a.title,
        subjectName: a.subject?.name ?? undefined,
        subjectSlug: a.subject?.slug ?? undefined,
        topicSlug: a.topic?.slug ?? undefined,
        topicName: a.topic?.name ?? undefined,
        dueDate: a.dueDate.toISOString(),
        estimatedMins: a.estimatedMins || 30,
        type: normalizedType,
        isLate: new Date(a.dueDate) < now,
        isCompleted: false,
        latePenalty: 0,
      };
    });
  } catch (e) {
    console.error('Failed to fetch homework', e);
  }

  return (
    <HomeDashboard
      displayName={displayName}
      enrolledSubjects={enrolledSubjects}
      recentActivity={recentActivity}
      homeworkQueue={homeworkQueue}
      studyStats={{
        dailyGoal: 2,
        dailyCompleted: dailyHoursCompleted,
        weeklyGoal: 10,
        weeklyCompleted: weeklyHoursCompleted
      }}
    />
  );
}
