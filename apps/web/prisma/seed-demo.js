const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const now = new Date();
const daysAgo = (days) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
const daysFromNow = (days) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

async function main() {
  const passwordHash = await bcrypt.hash('DemoPassword123!', 12);

  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@grindup.local' },
    update: {
      name: 'Demo Learner',
      username: 'demo',
      passwordHash,
      xp: 2480,
      level: 12,
      currentStreak: 9,
      skillRating: 1360,
      lastLogin: now,
    },
    create: {
      email: 'demo@grindup.local',
      name: 'Demo Learner',
      username: 'demo',
      passwordHash,
      xp: 2480,
      level: 12,
      currentStreak: 9,
      skillRating: 1360,
      lastLogin: now,
    },
  });

  const rival = await prisma.user.upsert({
    where: { email: 'riley@grindup.local' },
    update: { name: 'Riley Chen', username: 'riley', xp: 3320, level: 15, currentStreak: 14, passwordHash },
    create: { email: 'riley@grindup.local', name: 'Riley Chen', username: 'riley', xp: 3320, level: 15, currentStreak: 14, passwordHash },
  });

  const friend = await prisma.user.upsert({
    where: { email: 'sam@grindup.local' },
    update: { name: 'Sam Patel', username: 'sam', xp: 1870, level: 9, currentStreak: 5, passwordHash },
    create: { email: 'sam@grindup.local', name: 'Sam Patel', username: 'sam', xp: 1870, level: 9, currentStreak: 5, passwordHash },
  });

  await prisma.onboardingProfile.upsert({
    where: { userId: demoUser.id },
    update: {
      status: 'complete',
      track: 'Computer Science',
      goal: 'Prepare for technical interviews and build study habits',
      hoursPerWeek: 8,
      deadline: daysFromNow(90),
      difficultyPreference: 'intermediate',
      learningStyle: 'practice-first',
      aiPersona: 'direct-coach',
      diagnosticResponses: [{ topicName: 'Arrays', score: 7 }, { topicName: 'Dynamic Programming', score: 3 }],
      baselineMastery: { arrays: 70, graphs: 45, dp: 30 },
      updatedAt: now,
    },
    create: {
      userId: demoUser.id,
      status: 'complete',
      track: 'Computer Science',
      goal: 'Prepare for technical interviews and build study habits',
      hoursPerWeek: 8,
      deadline: daysFromNow(90),
      difficultyPreference: 'intermediate',
      learningStyle: 'practice-first',
      aiPersona: 'direct-coach',
      diagnosticResponses: [{ topicName: 'Arrays', score: 7 }, { topicName: 'Dynamic Programming', score: 3 }],
      baselineMastery: { arrays: 70, graphs: 45, dp: 30 },
      updatedAt: now,
    },
  });

  const dsa = await prisma.subject.upsert({
    where: { slug: 'data-structures-algorithms' },
    update: {
      name: 'Data Structures & Algorithms',
      description: 'Interview-focused algorithms practice with lessons, quizzes, flashcards, and coding problems.',
      icon: 'code',
      color: '#3b82f6',
      category: 'technology',
      exerciseTypes: ['coding', 'mcq', 'flashcard'],
      estimatedHours: 120,
      difficultyLevel: 'intermediate',
      isActive: true,
    },
    create: {
      name: 'Data Structures & Algorithms',
      slug: 'data-structures-algorithms',
      description: 'Interview-focused algorithms practice with lessons, quizzes, flashcards, and coding problems.',
      icon: 'code',
      color: '#3b82f6',
      category: 'technology',
      exerciseTypes: ['coding', 'mcq', 'flashcard'],
      estimatedHours: 120,
      difficultyLevel: 'intermediate',
      isActive: true,
    },
  });

  const biology = await prisma.subject.upsert({
    where: { slug: 'biology-101' },
    update: {
      name: 'Biology 101',
      description: 'Cell biology and genetics with short lessons, checks, and recall cards.',
      icon: 'dna',
      color: '#22c55e',
      category: 'stem',
      exerciseTypes: ['mcq', 'flashcard'],
      estimatedHours: 28,
      difficultyLevel: 'beginner',
      isActive: true,
    },
    create: {
      name: 'Biology 101',
      slug: 'biology-101',
      description: 'Cell biology and genetics with short lessons, checks, and recall cards.',
      icon: 'dna',
      color: '#22c55e',
      category: 'stem',
      exerciseTypes: ['mcq', 'flashcard'],
      estimatedHours: 28,
      difficultyLevel: 'beginner',
      isActive: true,
    },
  });

  const arrays = await prisma.subjectTopic.upsert({
    where: { subjectId_slug: { subjectId: dsa.id, slug: 'arrays-strings' } },
    update: {
      name: 'Arrays & Strings',
      description: 'Indexing, two pointers, sliding windows, and frequency maps.',
      order: 1,
      level: 0,
      estimatedMins: 90,
      content: '# Arrays & Strings\n\nArrays are contiguous collections. Common interview patterns include two pointers, prefix sums, and sliding windows.\n\n```mermaid\ngraph LR\nA[Input] --> B[Choose window]\nB --> C[Update counts]\nC --> D[Check answer]\n```\n\n:::question\nWhy does a sliding window usually move each pointer at most `n` times?\n:::',
    },
    create: {
      subjectId: dsa.id,
      name: 'Arrays & Strings',
      slug: 'arrays-strings',
      description: 'Indexing, two pointers, sliding windows, and frequency maps.',
      order: 1,
      level: 0,
      estimatedMins: 90,
      content: '# Arrays & Strings\n\nArrays are contiguous collections. Common interview patterns include two pointers, prefix sums, and sliding windows.\n\n```mermaid\ngraph LR\nA[Input] --> B[Choose window]\nB --> C[Update counts]\nC --> D[Check answer]\n```\n\n:::question\nWhy does a sliding window usually move each pointer at most `n` times?\n:::',
    },
  });

  const sliding = await prisma.subjectTopic.upsert({
    where: { subjectId_slug: { subjectId: dsa.id, slug: 'sliding-window' } },
    update: {
      name: 'Sliding Window',
      description: 'Maintain a moving range to answer substring and subarray questions efficiently.',
      parentId: arrays.id,
      level: 1,
      order: 1,
      estimatedMins: 45,
      content: '## Sliding Window\n\nUse a window when the answer depends on a contiguous range. Expand right to include new data, shrink left when constraints are violated.',
    },
    create: {
      subjectId: dsa.id,
      name: 'Sliding Window',
      slug: 'sliding-window',
      description: 'Maintain a moving range to answer substring and subarray questions efficiently.',
      parentId: arrays.id,
      level: 1,
      order: 1,
      estimatedMins: 45,
      content: '## Sliding Window\n\nUse a window when the answer depends on a contiguous range. Expand right to include new data, shrink left when constraints are violated.',
    },
  });

  const dp = await prisma.subjectTopic.upsert({
    where: { subjectId_slug: { subjectId: dsa.id, slug: 'dynamic-programming' } },
    update: {
      name: 'Dynamic Programming',
      description: 'Break problems into overlapping subproblems and store results.',
      order: 2,
      level: 0,
      estimatedMins: 120,
      content: '# Dynamic Programming\n\nDP is useful when brute force repeats the same subproblems. Define state, transition, base cases, and order.',
    },
    create: {
      subjectId: dsa.id,
      name: 'Dynamic Programming',
      slug: 'dynamic-programming',
      description: 'Break problems into overlapping subproblems and store results.',
      order: 2,
      level: 0,
      estimatedMins: 120,
      content: '# Dynamic Programming\n\nDP is useful when brute force repeats the same subproblems. Define state, transition, base cases, and order.',
    },
  });

  const cells = await prisma.subjectTopic.upsert({
    where: { subjectId_slug: { subjectId: biology.id, slug: 'cell-structure' } },
    update: {
      name: 'Cell Structure',
      description: 'Organelles, membranes, and cellular transport.',
      order: 1,
      level: 0,
      estimatedMins: 60,
      content: '# Cell Structure\n\nCells contain organelles that perform specialized jobs. The nucleus stores DNA, mitochondria produce ATP, and membranes regulate transport.',
    },
    create: {
      subjectId: biology.id,
      name: 'Cell Structure',
      slug: 'cell-structure',
      description: 'Organelles, membranes, and cellular transport.',
      order: 1,
      level: 0,
      estimatedMins: 60,
      content: '# Cell Structure\n\nCells contain organelles that perform specialized jobs. The nucleus stores DNA, mitochondria produce ATP, and membranes regulate transport.',
    },
  });

  await prisma.userSubject.upsert({
    where: { userId_subjectId: { userId: demoUser.id, subjectId: dsa.id } },
    update: {
      progressPercent: 42,
      xpEarned: 920,
      streak: 6,
      totalTimeSpent: 16200,
      exercisesCompleted: 7,
      goalHoursPerWeek: 8,
      targetDeadline: daysFromNow(90),
      lastAccessedAt: daysAgo(0),
    },
    create: {
      userId: demoUser.id,
      subjectId: dsa.id,
      progressPercent: 42,
      xpEarned: 920,
      streak: 6,
      totalTimeSpent: 16200,
      exercisesCompleted: 7,
      goalHoursPerWeek: 8,
      targetDeadline: daysFromNow(90),
      lastAccessedAt: daysAgo(0),
    },
  });

  await prisma.userSubject.upsert({
    where: { userId_subjectId: { userId: demoUser.id, subjectId: biology.id } },
    update: { progressPercent: 18, xpEarned: 180, streak: 2, totalTimeSpent: 3600, exercisesCompleted: 2, goalHoursPerWeek: 3 },
    create: { userId: demoUser.id, subjectId: biology.id, progressPercent: 18, xpEarned: 180, streak: 2, totalTimeSpent: 3600, exercisesCompleted: 2, goalHoursPerWeek: 3 },
  });

  for (const [topic, mastery, status, completed, total] of [
    [arrays, 72, 'in_progress', 4, 6],
    [sliding, 55, 'in_progress', 2, 4],
    [dp, 25, 'not_started', 1, 6],
    [cells, 38, 'in_progress', 2, 5],
  ]) {
    await prisma.userTopicProgress.upsert({
      where: { userId_topicId: { userId: demoUser.id, topicId: topic.id } },
      update: { masteryPercent: mastery, status, exercisesCompleted: completed, exercisesTotal: total, lastPracticed: daysAgo(1) },
      create: { id: `demo-progress-${topic.slug}`, userId: demoUser.id, topicId: topic.id, masteryPercent: mastery, status, exercisesCompleted: completed, exercisesTotal: total, lastPracticed: daysAgo(1) },
    });
  }

  const mcq = await prisma.exercise.upsert({
    where: { id: 'demo-ex-arrays-mcq' },
    update: {
      subjectId: dsa.id,
      topicId: arrays.id,
      title: 'Two Pointer Invariant',
      type: 'mcq',
      difficulty: 'medium',
      points: 15,
      estimatedMins: 8,
      content: {
        question: 'What makes a two-pointer solution valid?',
        options: ['The pointers move randomly', 'Each move preserves a condition that cannot discard the answer', 'It always sorts the input', 'It uses recursion'],
        correctAnswers: [1],
        explanation: 'A valid pointer move rules out impossible candidates while keeping the correct answer reachable.',
      },
      updatedAt: now,
    },
    create: {
      id: 'demo-ex-arrays-mcq',
      subjectId: dsa.id,
      topicId: arrays.id,
      title: 'Two Pointer Invariant',
      type: 'mcq',
      difficulty: 'medium',
      points: 15,
      estimatedMins: 8,
      content: {
        question: 'What makes a two-pointer solution valid?',
        options: ['The pointers move randomly', 'Each move preserves a condition that cannot discard the answer', 'It always sorts the input', 'It uses recursion'],
        correctAnswers: [1],
        explanation: 'A valid pointer move rules out impossible candidates while keeping the correct answer reachable.',
      },
      updatedAt: now,
    },
  });

  const flashcard = await prisma.exercise.upsert({
    where: { id: 'demo-ex-window-flashcard' },
    update: {
      subjectId: dsa.id,
      topicId: sliding.id,
      title: 'Window Shrink Rule',
      type: 'flashcard',
      difficulty: 'easy',
      points: 5,
      estimatedMins: 3,
      content: { front: 'When do you shrink a sliding window?', back: 'When the current window violates the problem constraint or can no longer improve the answer.' },
      updatedAt: now,
    },
    create: {
      id: 'demo-ex-window-flashcard',
      subjectId: dsa.id,
      topicId: sliding.id,
      title: 'Window Shrink Rule',
      type: 'flashcard',
      difficulty: 'easy',
      points: 5,
      estimatedMins: 3,
      content: { front: 'When do you shrink a sliding window?', back: 'When the current window violates the problem constraint or can no longer improve the answer.' },
      updatedAt: now,
    },
  });

  const bioFlashcard = await prisma.exercise.upsert({
    where: { id: 'demo-ex-cell-flashcard' },
    update: {
      subjectId: biology.id,
      topicId: cells.id,
      title: 'Mitochondria',
      type: 'flashcard',
      difficulty: 'easy',
      points: 5,
      content: { front: 'Which organelle produces most ATP?', back: 'The mitochondrion.' },
      updatedAt: now,
    },
    create: {
      id: 'demo-ex-cell-flashcard',
      subjectId: biology.id,
      topicId: cells.id,
      title: 'Mitochondria',
      type: 'flashcard',
      difficulty: 'easy',
      points: 5,
      content: { front: 'Which organelle produces most ATP?', back: 'The mitochondrion.' },
      updatedAt: now,
    },
  });

  await prisma.exerciseAttempt.deleteMany({ where: { id: { in: ['demo-attempt-1', 'demo-attempt-2', 'demo-attempt-3'] } } });
  await prisma.exerciseAttempt.createMany({
    data: [
      { id: 'demo-attempt-1', userId: demoUser.id, exerciseId: mcq.id, response: { selectedIndices: [1] }, isCorrect: true, score: 15, feedback: 'Good invariant reasoning.', timeSpentSecs: 360, createdAt: daysAgo(1) },
      { id: 'demo-attempt-2', userId: demoUser.id, exerciseId: flashcard.id, response: { rating: 'AGAIN' }, isCorrect: false, score: 0, feedback: 'Review the shrink condition.', timeSpentSecs: 90, createdAt: daysAgo(2) },
      { id: 'demo-attempt-3', userId: demoUser.id, exerciseId: bioFlashcard.id, response: { rating: 'GOOD' }, isCorrect: true, score: 5, feedback: 'Correct.', timeSpentSecs: 60, createdAt: daysAgo(3) },
    ],
  });

  await prisma.homeworkAssignment.deleteMany({ where: { id: { startsWith: 'demo-homework-' } } });
  await prisma.homeworkAssignment.createMany({
    data: [
      { id: 'demo-homework-arrays', userId: demoUser.id, subjectId: dsa.id, topicId: arrays.id, title: 'Solve two array pattern drills', description: 'Complete two short problems using two pointers or a frequency map.', dueDate: daysFromNow(1), assignmentType: 'exercise', estimatedMins: 35, xpReward: 80 },
      { id: 'demo-homework-dp', userId: demoUser.id, subjectId: dsa.id, topicId: dp.id, title: 'Write DP state definitions', description: 'For three problems, define state, transition, and base case before coding.', dueDate: daysAgo(1), assignmentType: 'reading', estimatedMins: 25, lateDays: 1, xpReward: 60 },
      { id: 'demo-homework-bio', userId: demoUser.id, subjectId: biology.id, topicId: cells.id, title: 'Label cell organelles', description: 'Identify the function of each organelle from the lesson.', dueDate: daysFromNow(3), assignmentType: 'general', estimatedMins: 20, xpReward: 40 },
    ],
  });

  await prisma.homeworkSubmissions.deleteMany({ where: { id: 'demo-homework-submission-1' } });
  await prisma.homeworkSubmissions.create({
    data: {
      id: 'demo-homework-submission-1',
      homeworkId: 'demo-homework-arrays',
      userId: demoUser.id,
      submissionType: 'text',
      content: 'Used left/right pointers and explained why each movement is safe.',
      aiFeedback: 'Clear explanation. Add edge cases for empty arrays.',
      aiScore: 86,
      isGraded: true,
      gradedAt: daysAgo(1),
      submittedAt: daysAgo(1),
    },
  });

  await prisma.reviewCards.deleteMany({ where: { id: { startsWith: 'demo-review-' } } });
  await prisma.reviewCards.createMany({
    data: [
      { id: 'demo-review-window', userId: demoUser.id, cardType: 'concept', content: { exerciseId: flashcard.id }, nextReview: daysAgo(1), intervalDays: 1, repetitions: 1 },
      { id: 'demo-review-arrays', userId: demoUser.id, cardType: 'concept', content: { exerciseId: mcq.id }, nextReview: daysAgo(0), intervalDays: 2, repetitions: 2 },
    ],
  });

  const graphTopic = await prisma.topic.upsert({
    where: { name: 'Graphs' },
    update: { level: 'topic' },
    create: { id: 'demo-topic-graphs', name: 'Graphs', level: 'topic' },
  });
  const arraysTopic = await prisma.topic.upsert({
    where: { name: 'Arrays' },
    update: { level: 'topic' },
    create: { id: 'demo-topic-arrays', name: 'Arrays', level: 'topic' },
  });

  const twoSum = await prisma.problem.upsert({
    where: { id: 'demo-problem-two-sum' },
    update: {
      title: 'Two Sum',
      description: 'Given an array of integers `nums` and an integer `target`, return indices of two numbers such that they add up to target.',
      difficulty: 'easy',
      status: 'active',
      constraints: ['2 <= nums.length <= 10^4', 'Exactly one solution exists'],
    },
    create: {
      id: 'demo-problem-two-sum',
      title: 'Two Sum',
      description: 'Given an array of integers `nums` and an integer `target`, return indices of two numbers such that they add up to target.',
      difficulty: 'easy',
      status: 'active',
      constraints: ['2 <= nums.length <= 10^4', 'Exactly one solution exists'],
    },
  });

  const islands = await prisma.problem.upsert({
    where: { id: 'demo-problem-islands' },
    update: {
      title: 'Number of Islands',
      description: 'Given a grid of `1`s and `0`s, count connected groups of land using DFS or BFS.',
      difficulty: 'medium',
      status: 'active',
      constraints: ['1 <= m,n <= 300'],
    },
    create: {
      id: 'demo-problem-islands',
      title: 'Number of Islands',
      description: 'Given a grid of `1`s and `0`s, count connected groups of land using DFS or BFS.',
      difficulty: 'medium',
      status: 'active',
      constraints: ['1 <= m,n <= 300'],
    },
  });

  await prisma.problemTopic.deleteMany({ where: { problemId: { in: [twoSum.id, islands.id] } } });
  await prisma.problemTopic.createMany({
    data: [
      { problemId: twoSum.id, topicId: arraysTopic.id },
      { problemId: islands.id, topicId: graphTopic.id },
    ],
  });

  await prisma.testCases.deleteMany({ where: { problemId: { in: [twoSum.id, islands.id] } } });
  await prisma.testCases.createMany({
    data: [
      { id: 'demo-tc-two-sum-1', problemId: twoSum.id, input: 'nums=[2,7,11,15]; target=9', expectedOutput: '[0,1]', isHidden: false, order: 1 },
      { id: 'demo-tc-two-sum-2', problemId: twoSum.id, input: 'nums=[3,2,4]; target=6', expectedOutput: '[1,2]', isHidden: true, order: 2 },
      { id: 'demo-tc-islands-1', problemId: islands.id, input: 'grid=[["1","1","0"],["0","1","0"],["1","0","1"]]', expectedOutput: '3', isHidden: false, order: 1 },
    ],
  });

  await prisma.hintLadders.deleteMany({ where: { problemId: { in: [twoSum.id, islands.id] } } });
  await prisma.hintLadders.createMany({
    data: [
      { id: 'demo-hint-two-sum-1', problemId: twoSum.id, level: 1, content: 'Think about what complement each number needs.' },
      { id: 'demo-hint-two-sum-2', problemId: twoSum.id, level: 2, content: 'Use a hash map from value to index.' },
      { id: 'demo-hint-islands-1', problemId: islands.id, level: 1, content: 'Start a traversal whenever you find unvisited land.' },
    ],
  });

  await prisma.submission.deleteMany({ where: { id: { startsWith: 'demo-submission-' } } });
  await prisma.submission.createMany({
    data: [
      { id: 'demo-submission-accepted', userId: demoUser.id, problemId: twoSum.id, problemVersion: 1, code: 'function solution(nums, target) { return [0, 1]; }', language: 'javascript', status: 'accepted', runtimeMs: 42, memoryKb: 42100, testResults: [{ passed: true }], correlationId: 'demo-corr-1', submittedAt: daysAgo(1) },
      { id: 'demo-submission-wrong', userId: demoUser.id, problemId: islands.id, problemVersion: 1, code: 'function solution(grid) { return 0; }', language: 'javascript', status: 'wrong_answer', runtimeMs: 25, memoryKb: 39200, testResults: [{ passed: false }], correlationId: 'demo-corr-2', submittedAt: daysAgo(2) },
    ],
  });

  await prisma.problemScratchpads.upsert({
    where: { userId_problemId: { userId: demoUser.id, problemId: twoSum.id } },
    update: { notes: 'Use complement map. Watch duplicate values.', approach: 'Iterate once; before inserting current value, check target - nums[i].', updatedAt: now },
    create: { id: 'demo-scratch-two-sum', userId: demoUser.id, problemId: twoSum.id, notes: 'Use complement map. Watch duplicate values.', approach: 'Iterate once; before inserting current value, check target - nums[i].', updatedAt: now },
  });

  await prisma.contest.upsert({
    where: { id: 'demo-contest-weekly' },
    update: { title: 'Weekly Sprint Demo', startsAt: daysAgo(1), endsAt: daysFromNow(2), isRated: true, createdById: demoUser.id },
    create: { id: 'demo-contest-weekly', title: 'Weekly Sprint Demo', startsAt: daysAgo(1), endsAt: daysFromNow(2), isRated: true, createdById: demoUser.id },
  });
  await prisma.contestProblems.deleteMany({ where: { contestId: 'demo-contest-weekly' } });
  await prisma.contestProblems.createMany({
    data: [
      { contestId: 'demo-contest-weekly', problemId: twoSum.id, points: 100, order: 1 },
      { contestId: 'demo-contest-weekly', problemId: islands.id, points: 200, order: 2 },
    ],
  });
  await prisma.contestParticipant.upsert({
    where: { contestId_userId: { contestId: 'demo-contest-weekly', userId: demoUser.id } },
    update: {},
    create: { contestId: 'demo-contest-weekly', userId: demoUser.id },
  });

  await prisma.contestLobby.deleteMany({ where: { id: 'demo-lobby-live' } });
  await prisma.contestLobby.create({
    data: {
      id: 'demo-lobby-live',
      title: 'Demo Study Race',
      createdById: demoUser.id,
      visibility: 'PUBLIC',
      mode: 'STUDY_TIME',
      targetValue: 60,
      status: 'STARTED',
      durationMinutes: 90,
      startedAt: daysAgo(0),
      endedAt: daysFromNow(1),
      participants: {
        create: [
          { id: 'demo-lobby-p1', userId: demoUser.id, role: 'HOST' },
          { id: 'demo-lobby-p2', userId: friend.id, role: 'MEMBER' },
        ],
      },
      messages: {
        create: [
          { userId: demoUser.id, message: 'Demo lobby is live. Testing chat and participant states.' },
          { userId: friend.id, message: 'Ready to race.' },
        ],
      },
    },
  });

  await prisma.friendship.upsert({
    where: { requesterId_addresseeId: { requesterId: demoUser.id, addresseeId: friend.id } },
    update: { status: 'accepted' },
    create: { requesterId: demoUser.id, addresseeId: friend.id, status: 'accepted' },
  });
  await prisma.friendship.upsert({
    where: { requesterId_addresseeId: { requesterId: rival.id, addresseeId: demoUser.id } },
    update: { status: 'pending' },
    create: { requesterId: rival.id, addresseeId: demoUser.id, status: 'pending' },
  });

  await prisma.directMessage.deleteMany({ where: { OR: [{ senderId: friend.id, receiverId: demoUser.id }, { senderId: demoUser.id, receiverId: friend.id }] } });
  await prisma.directMessage.createMany({
    data: [
      { senderId: friend.id, receiverId: demoUser.id, content: 'Want to review sliding window tonight?', isRead: false, createdAt: daysAgo(0) },
      { senderId: demoUser.id, receiverId: friend.id, content: 'Yes, after I finish the homework queue.', isRead: true, createdAt: daysAgo(0) },
    ],
  });

  await prisma.studyChallenge.deleteMany({ where: { id: { startsWith: 'demo-challenge-' } } });
  await prisma.studyChallenge.create({
    data: {
      id: 'demo-challenge-pending',
      challengerId: rival.id,
      challengedId: demoUser.id,
      challengeType: 'leetcode_race',
      xpStake: 75,
      targetValue: 1,
      targetProblemId: twoSum.id,
      duration: 24,
      status: 'pending',
      createdAt: daysAgo(0),
    },
  });
  await prisma.studyChallenge.create({
    data: {
      id: 'demo-challenge-active',
      challengerId: demoUser.id,
      challengedId: friend.id,
      challengeType: 'study_time',
      xpStake: 50,
      targetValue: 90,
      duration: 24,
      status: 'active',
      startsAt: daysAgo(0),
      endsAt: daysFromNow(1),
      results: {
        create: [
          { userId: demoUser.id, score: 40, progress: { studyMins: 40 } },
          { userId: friend.id, score: 25, progress: { studyMins: 25 } },
        ],
      },
    },
  });

  await prisma.weeklyLearningReports.upsert({
    where: { userId_weekStart: { userId: demoUser.id, weekStart: daysAgo(6) } },
    update: {
      weekEnd: now,
      totalMinutes: 420,
      problemsSolved: 4,
      exercisesCompleted: 8,
      topicsImproved: [{ topic: 'Arrays', delta: 12 }],
      weakAreas: [{ topic: 'Dynamic Programming', mastery: 25 }],
      recommendations: ['Do two DP state-definition drills', 'Review graph traversal mistakes'],
      metaInsights: 'You are consistent, but DP needs focused repetition.',
    },
    create: {
      id: 'demo-weekly-report',
      userId: demoUser.id,
      weekStart: daysAgo(6),
      weekEnd: now,
      totalMinutes: 420,
      problemsSolved: 4,
      exercisesCompleted: 8,
      topicsImproved: [{ topic: 'Arrays', delta: 12 }],
      weakAreas: [{ topic: 'Dynamic Programming', mastery: 25 }],
      recommendations: ['Do two DP state-definition drills', 'Review graph traversal mistakes'],
      metaInsights: 'You are consistent, but DP needs focused repetition.',
    },
  });

  await prisma.wellbeingChecks.deleteMany({ where: { id: 'demo-wellbeing-1' } });
  await prisma.wellbeingChecks.create({
    data: {
      id: 'demo-wellbeing-1',
      userId: demoUser.id,
      checkType: 'fatigue',
      score: 0.68,
      indicators: { longSessions: 3, lateSubmissions: 1 },
      action: 'Take a short break before another timed problem.',
      createdAt: daysAgo(0),
    },
  });

  await prisma.xpTransactions.deleteMany({ where: { id: { startsWith: 'demo-xp-' } } });
  await prisma.xpTransactions.createMany({
    data: [
      { id: 'demo-xp-1', userId: demoUser.id, amount: 100, reason: 'problem_accepted', metadata: { problemId: twoSum.id }, createdAt: daysAgo(1) },
      { id: 'demo-xp-2', userId: demoUser.id, amount: 40, reason: 'flashcard_review', metadata: { exerciseId: flashcard.id }, createdAt: daysAgo(2) },
      { id: 'demo-xp-3', userId: demoUser.id, amount: 385, reason: '7-day streak bonus', metadata: { streakDays: 7, multiplier: 1.1 }, createdAt: daysAgo(2) },
      { id: 'demo-xp-4', userId: demoUser.id, amount: 60, reason: 'homework_completed', metadata: { homeworkId: 'demo-homework-arrays' }, createdAt: daysAgo(1) },
    ],
  });

  await prisma.badges.upsert({
    where: { id: 'demo-badge-week-warrior' },
    update: { name: 'Week Warrior', description: 'Maintained a 7-day learning streak.', iconUrl: 'flame', criteria: { streakDays: 7 } },
    create: { id: 'demo-badge-week-warrior', name: 'Week Warrior', description: 'Maintained a 7-day learning streak.', iconUrl: 'flame', criteria: { streakDays: 7 } },
  });
  await prisma.badges.upsert({
    where: { id: 'demo-badge-first-solve' },
    update: { name: 'First Accepted Solve', description: 'Solved a coding problem with an accepted submission.', iconUrl: 'trophy', criteria: { acceptedSubmissions: 1 } },
    create: { id: 'demo-badge-first-solve', name: 'First Accepted Solve', description: 'Solved a coding problem with an accepted submission.', iconUrl: 'trophy', criteria: { acceptedSubmissions: 1 } },
  });
  await prisma.badges.upsert({
    where: { id: 'demo-badge-review-ready' },
    update: { name: 'Review Ready', description: 'Completed spaced repetition reviews.', iconUrl: 'brain', criteria: { reviewsCompleted: 2 } },
    create: { id: 'demo-badge-review-ready', name: 'Review Ready', description: 'Completed spaced repetition reviews.', iconUrl: 'brain', criteria: { reviewsCompleted: 2 } },
  });
  await prisma.userBadges.deleteMany({
    where: {
      userId: demoUser.id,
      badgeId: { in: ['demo-badge-week-warrior', 'demo-badge-first-solve', 'demo-badge-review-ready'] },
    },
  });
  await prisma.userBadges.createMany({
    data: [
      { userId: demoUser.id, badgeId: 'demo-badge-week-warrior', awardedAt: daysAgo(2) },
      { userId: demoUser.id, badgeId: 'demo-badge-first-solve', awardedAt: daysAgo(1) },
      { userId: demoUser.id, badgeId: 'demo-badge-review-ready', awardedAt: daysAgo(0) },
    ],
  });

  await prisma.personalBests.deleteMany({ where: { id: { startsWith: 'demo-pb-' } } });
  await prisma.personalBests.createMany({
    data: [
      { id: 'demo-pb-fast-two-sum', userId: demoUser.id, category: 'fastest_accepted_runtime_ms', problemId: twoSum.id, value: 42, achievedAt: daysAgo(1) },
      { id: 'demo-pb-longest-study-session', userId: demoUser.id, category: 'longest_study_session_minutes', value: 94, achievedAt: daysAgo(3) },
      { id: 'demo-pb-weekly-xp', userId: demoUser.id, category: 'most_xp_in_week', value: 640, achievedAt: daysAgo(2) },
    ],
  });

  await prisma.events.deleteMany({ where: { id: { startsWith: 'demo-event-' } } });
  await prisma.events.createMany({
    data: [
      { id: 'demo-event-lesson-viewed', userId: demoUser.id, eventType: 'lesson_viewed', payload: { subjectSlug: dsa.slug, topicSlug: arrays.slug, minutes: 18 }, createdAt: daysAgo(0) },
      { id: 'demo-event-topic-started', userId: demoUser.id, eventType: 'topic_started', payload: { subjectSlug: dsa.slug, topicSlug: dp.slug }, createdAt: daysAgo(1) },
      { id: 'demo-event-problem-started', userId: demoUser.id, eventType: 'problem_started', payload: { problemId: islands.id, title: islands.title }, createdAt: daysAgo(2) },
      { id: 'demo-event-review-completed', userId: demoUser.id, eventType: 'review_completed', payload: { cards: 2 }, createdAt: daysAgo(0) },
      { id: 'demo-event-streak-milestone', userId: demoUser.id, eventType: 'streak_milestone', payload: { streakDays: 7, xpAwarded: 385 }, createdAt: daysAgo(2) },
    ],
  });

  await prisma.userActivities.deleteMany({ where: { id: { startsWith: 'demo-activity-' } } });
  await prisma.userActivities.createMany({
    data: [
      { id: 'demo-activity-study-session', userId: demoUser.id, activityType: 'study_session', refId: arrays.id, date: daysAgo(0), duration: 48, metadata: { subject: dsa.name, topic: arrays.name } },
      { id: 'demo-activity-code-session', userId: demoUser.id, activityType: 'coding_practice', refId: twoSum.id, date: daysAgo(1), duration: 34, metadata: { problem: twoSum.title, status: 'accepted' } },
      { id: 'demo-activity-review-session', userId: demoUser.id, activityType: 'review_session', refId: flashcard.id, date: daysAgo(2), duration: 12, metadata: { cardsReviewed: 2 } },
    ],
  });

  await prisma.userKnowledgeGraph.deleteMany({ where: { id: { startsWith: 'demo-kg-' } } });
  await prisma.userKnowledgeGraph.createMany({
    data: [
      { id: 'demo-kg-arrays', userId: demoUser.id, topicId: arraysTopic.id, status: 'strength', confidence: 0.74, lastAssessed: daysAgo(1) },
      { id: 'demo-kg-graphs', userId: demoUser.id, topicId: graphTopic.id, status: 'weakness', confidence: 0.41, lastAssessed: daysAgo(2) },
    ],
  });

  await prisma.mistakeCards.deleteMany({ where: { id: { startsWith: 'demo-mistake-' } } });
  await prisma.mistakeCards.createMany({
    data: [
      {
        id: 'demo-mistake-boundary',
        userId: demoUser.id,
        submissionId: 'demo-submission-wrong',
        mistakeTag: 'boundary-condition',
        category: 'implementation',
        description: 'Returned a fixed value instead of traversing all connected components.',
        correctedConcept: 'Track visited cells and start DFS/BFS from each unvisited land cell.',
        occurrenceCount: 2,
        lastOccurred: daysAgo(2),
        mastered: false,
      },
      {
        id: 'demo-mistake-window',
        userId: demoUser.id,
        mistakeTag: 'window-shrink-rule',
        category: 'concept',
        description: 'Shrank the sliding window before recording the best valid range.',
        correctedConcept: 'Record valid windows before shrinking, unless the constraint is already violated.',
        occurrenceCount: 1,
        lastOccurred: daysAgo(4),
        mastered: true,
      },
    ],
  });

  await prisma.mistakeClosures.deleteMany({ where: { id: { startsWith: 'demo-closure-' } } });
  await prisma.mistakeClosures.create({
    data: {
      id: 'demo-closure-window',
      mistakeCardId: 'demo-mistake-window',
      userId: demoUser.id,
      closureType: 'explained_fix',
      closureNote: 'I now check validity before moving the left pointer.',
      thenCode: 'while (count > k) left++; best = Math.max(best, right-left+1);',
      nowCode: 'best = Math.max(best, right-left+1); while (count > k) left++;',
      createdAt: daysAgo(1),
    },
  });

  await prisma.certificates.deleteMany({ where: { id: { startsWith: 'demo-cert-' } } });
  await prisma.certificates.create({
    data: {
      id: 'demo-cert-foundations',
      userId: demoUser.id,
      type: 'milestone',
      title: 'Algorithms Foundations Milestone',
      verificationCode: 'DEMO-ALG-FOUNDATIONS',
      issuedAt: daysAgo(1),
    },
  });

  await prisma.streakBonuses.deleteMany({ where: { id: { startsWith: 'demo-streak-' } } });
  await prisma.streakBonuses.create({
    data: {
      id: 'demo-streak-7',
      userId: demoUser.id,
      streakDays: 7,
      multiplier: 1.1,
      bonusXp: 385,
      awardedAt: daysAgo(2),
    },
  });

  await prisma.dailySnapshots.deleteMany({ where: { id: { startsWith: 'demo-daily-' } } });
  await prisma.dailySnapshots.createMany({
    data: [
      { id: 'demo-daily-0', userId: demoUser.id, date: daysAgo(0), problemsSolved: 1, exercisesCompleted: 2, reviewsCompleted: 2, minutesStudied: 58, xpEarned: 140, streakMaintained: true },
      { id: 'demo-daily-1', userId: demoUser.id, date: daysAgo(1), problemsSolved: 1, exercisesCompleted: 1, reviewsCompleted: 0, minutesStudied: 74, xpEarned: 160, streakMaintained: true },
      { id: 'demo-daily-2', userId: demoUser.id, date: daysAgo(2), problemsSolved: 0, exercisesCompleted: 2, reviewsCompleted: 1, minutesStudied: 41, xpEarned: 425, streakMaintained: true },
    ],
  });

  await prisma.learningMilestones.deleteMany({ where: { id: { startsWith: 'demo-milestone-' } } });
  await prisma.learningMilestones.createMany({
    data: [
      { id: 'demo-milestone-first-solve', userId: demoUser.id, milestoneType: 'first_accepted_problem', description: 'Solved Two Sum with an accepted submission.', createdAt: daysAgo(1) },
      { id: 'demo-milestone-review-streak', userId: demoUser.id, milestoneType: 'review_consistency', description: 'Completed review cards on schedule.', createdAt: daysAgo(0) },
    ],
  });

  const existingLearners = await prisma.user.findMany({
    where: {
      email: {
        notIn: ['demo@grindup.local', 'riley@grindup.local', 'sam@grindup.local'],
      },
    },
  });

  for (const learner of existingLearners) {
    const key = learner.id.slice(0, 8);

    await prisma.user.update({
      where: { id: learner.id },
      data: {
        name: learner.name || 'Local Demo User',
        username: learner.username || `local_${key}`,
        xp: Math.max(learner.xp, 1640),
        level: Math.max(learner.level, 8),
        currentStreak: Math.max(learner.currentStreak, 6),
        skillRating: Math.max(learner.skillRating, 1210),
        lastLogin: now,
      },
    });

    await prisma.onboardingProfile.upsert({
      where: { userId: learner.id },
      update: {
        status: 'complete',
        track: 'Computer Science',
        goal: 'Use seeded data to inspect the UI refactor flow',
        hoursPerWeek: 6,
        deadline: daysFromNow(60),
        difficultyPreference: 'intermediate',
        learningStyle: 'practice-first',
        aiPersona: 'direct-coach',
        updatedAt: now,
      },
      create: {
        userId: learner.id,
        status: 'complete',
        track: 'Computer Science',
        goal: 'Use seeded data to inspect the UI refactor flow',
        hoursPerWeek: 6,
        deadline: daysFromNow(60),
        difficultyPreference: 'intermediate',
        learningStyle: 'practice-first',
        aiPersona: 'direct-coach',
        updatedAt: now,
      },
    });

    await prisma.userSubject.upsert({
      where: { userId_subjectId: { userId: learner.id, subjectId: dsa.id } },
      update: {
        progressPercent: 36,
        xpEarned: 640,
        streak: 4,
        totalTimeSpent: 10800,
        exercisesCompleted: 5,
        goalHoursPerWeek: 6,
        targetDeadline: daysFromNow(60),
        lastAccessedAt: now,
      },
      create: {
        userId: learner.id,
        subjectId: dsa.id,
        progressPercent: 36,
        xpEarned: 640,
        streak: 4,
        totalTimeSpent: 10800,
        exercisesCompleted: 5,
        goalHoursPerWeek: 6,
        targetDeadline: daysFromNow(60),
        lastAccessedAt: now,
      },
    });

    await prisma.userSubject.upsert({
      where: { userId_subjectId: { userId: learner.id, subjectId: biology.id } },
      update: {
        progressPercent: 14,
        xpEarned: 120,
        streak: 1,
        totalTimeSpent: 2400,
        exercisesCompleted: 1,
        goalHoursPerWeek: 2,
      },
      create: {
        userId: learner.id,
        subjectId: biology.id,
        progressPercent: 14,
        xpEarned: 120,
        streak: 1,
        totalTimeSpent: 2400,
        exercisesCompleted: 1,
        goalHoursPerWeek: 2,
      },
    });

    for (const [topic, mastery, status, completed, total] of [
      [arrays, 61, 'in_progress', 3, 6],
      [sliding, 48, 'in_progress', 1, 4],
      [dp, 20, 'not_started', 0, 6],
      [cells, 34, 'in_progress', 1, 5],
    ]) {
      await prisma.userTopicProgress.upsert({
        where: { userId_topicId: { userId: learner.id, topicId: topic.id } },
        update: { masteryPercent: mastery, status, exercisesCompleted: completed, exercisesTotal: total, lastPracticed: daysAgo(1) },
        create: { id: `demo-local-progress-${key}-${topic.slug}`, userId: learner.id, topicId: topic.id, masteryPercent: mastery, status, exercisesCompleted: completed, exercisesTotal: total, lastPracticed: daysAgo(1) },
      });
    }

    await prisma.exerciseAttempt.deleteMany({ where: { id: { startsWith: `demo-local-attempt-${key}-` } } });
    await prisma.exerciseAttempt.createMany({
      data: [
        { id: `demo-local-attempt-${key}-1`, userId: learner.id, exerciseId: mcq.id, response: { selectedIndices: [1] }, isCorrect: true, score: 15, feedback: 'Good invariant reasoning.', timeSpentSecs: 300, createdAt: daysAgo(1) },
        { id: `demo-local-attempt-${key}-2`, userId: learner.id, exerciseId: flashcard.id, response: { rating: 'AGAIN' }, isCorrect: false, score: 0, feedback: 'Review the shrink condition.', timeSpentSecs: 120, createdAt: daysAgo(0) },
      ],
    });

    await prisma.homeworkAssignment.deleteMany({ where: { id: { startsWith: `demo-local-homework-${key}-` } } });
    await prisma.homeworkAssignment.createMany({
      data: [
        { id: `demo-local-homework-${key}-arrays`, userId: learner.id, subjectId: dsa.id, topicId: arrays.id, title: 'Local demo: solve two array drills', description: 'Seeded task for analytics and dashboard review.', dueDate: daysFromNow(1), assignmentType: 'exercise', estimatedMins: 30, xpReward: 70 },
        { id: `demo-local-homework-${key}-dp`, userId: learner.id, subjectId: dsa.id, topicId: dp.id, title: 'Local demo: define DP states', description: 'Seeded overdue task to test UI states.', dueDate: daysAgo(1), assignmentType: 'reading', estimatedMins: 25, lateDays: 1, xpReward: 55 },
      ],
    });

    await prisma.reviewCards.deleteMany({ where: { id: { startsWith: `demo-local-review-${key}-` } } });
    await prisma.reviewCards.createMany({
      data: [
        { id: `demo-local-review-${key}-window`, userId: learner.id, cardType: 'concept', content: { exerciseId: flashcard.id }, nextReview: daysAgo(1), intervalDays: 1, repetitions: 1 },
        { id: `demo-local-review-${key}-arrays`, userId: learner.id, cardType: 'concept', content: { exerciseId: mcq.id }, nextReview: daysAgo(0), intervalDays: 2, repetitions: 2 },
      ],
    });

    await prisma.submission.deleteMany({ where: { id: { startsWith: `demo-local-submission-${key}-` } } });
    await prisma.submission.createMany({
      data: [
        { id: `demo-local-submission-${key}-accepted`, userId: learner.id, problemId: twoSum.id, problemVersion: 1, code: 'function solution(nums, target) { return [0, 1]; }', language: 'javascript', status: 'accepted', runtimeMs: 44, memoryKb: 42000, testResults: [{ passed: true }], correlationId: `demo-local-corr-${key}-1`, submittedAt: daysAgo(1) },
        { id: `demo-local-submission-${key}-wrong`, userId: learner.id, problemId: islands.id, problemVersion: 1, code: 'function solution(grid) { return 0; }', language: 'javascript', status: 'wrong_answer', runtimeMs: 28, memoryKb: 39500, testResults: [{ passed: false }], correlationId: `demo-local-corr-${key}-2`, submittedAt: daysAgo(2) },
      ],
    });

    await prisma.userActivities.deleteMany({ where: { id: { startsWith: `demo-local-activity-${key}-` } } });
    await prisma.userActivities.createMany({
      data: [
        { id: `demo-local-activity-${key}-study`, userId: learner.id, activityType: 'study_session', refId: arrays.id, date: daysAgo(0), duration: 42, metadata: { subject: dsa.name, topic: arrays.name } },
        { id: `demo-local-activity-${key}-code`, userId: learner.id, activityType: 'coding_practice', refId: twoSum.id, date: daysAgo(1), duration: 31, metadata: { problem: twoSum.title, status: 'accepted' } },
      ],
    });

    await prisma.events.deleteMany({ where: { id: { startsWith: `demo-local-event-${key}-` } } });
    await prisma.events.createMany({
      data: [
        { id: `demo-local-event-${key}-lesson`, userId: learner.id, eventType: 'lesson_viewed', payload: { subjectSlug: dsa.slug, topicSlug: arrays.slug }, createdAt: daysAgo(0) },
        { id: `demo-local-event-${key}-problem`, userId: learner.id, eventType: 'problem_started', payload: { problemId: twoSum.id }, createdAt: daysAgo(1) },
      ],
    });

    await prisma.xpTransactions.deleteMany({ where: { id: { startsWith: `demo-local-xp-${key}-` } } });
    await prisma.xpTransactions.createMany({
      data: [
        { id: `demo-local-xp-${key}-solve`, userId: learner.id, amount: 100, reason: 'problem_accepted', metadata: { problemId: twoSum.id }, createdAt: daysAgo(1) },
        { id: `demo-local-xp-${key}-streak`, userId: learner.id, amount: 300, reason: 'streak bonus', metadata: { streakDays: 6 }, createdAt: daysAgo(0) },
      ],
    });

    await prisma.userBadges.deleteMany({
      where: {
        userId: learner.id,
        badgeId: { in: ['demo-badge-week-warrior', 'demo-badge-first-solve'] },
      },
    });
    await prisma.userBadges.createMany({
      data: [
        { userId: learner.id, badgeId: 'demo-badge-week-warrior', awardedAt: daysAgo(2) },
        { userId: learner.id, badgeId: 'demo-badge-first-solve', awardedAt: daysAgo(1) },
      ],
    });
  }

  console.log('Demo data seeded.');
  console.log('Login: demo@grindup.local');
  console.log('Password: DemoPassword123!');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
